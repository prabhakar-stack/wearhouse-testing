import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, folderLink, orderFolderId, type, uploadedById, reason, manifestId } = body;

    const trackingAwb = orderId || manifestId;
    if (!trackingAwb) {
      return NextResponse.json({ error: 'Missing orderId or manifestId in request body' }, { status: 400 });
    }

    console.log(`[Finalize Upload] Finalizing for AWB/Order: ${trackingAwb}`, body);

    // 1. Resolve and Dynamically Upsert the Manifest record
    let manifest = await prisma.manifest.findFirst({
      where: {
        OR: [
          { trackingAwb: trackingAwb },
          { id: manifestId || '' }
        ]
      }
    });

    const isRejection = type === 'RECEIVER_REJECTION';
    const targetStatus = isRejection ? 'EXPECTED' : 'INSPECTED';
    const targetReceivedAt = isRejection ? null : new Date();

    if (!manifest) {
      manifest = await prisma.manifest.create({
        data: {
          trackingAwb: trackingAwb,
          status: targetStatus,
          courierName: 'Unknown',
          expectedDate: new Date(),
          receivedAt: targetReceivedAt,
        }
      });
      console.log(`[Database Dynamic Create] Created missing Manifest for AWB: ${trackingAwb}`);
    } else {
      manifest = await prisma.manifest.update({
        where: { id: manifest.id },
        data: {
          status: targetStatus,
          receivedAt: isRejection ? undefined : (manifest.receivedAt || targetReceivedAt)
        }
      });
      console.log(`[Database Dynamic Update] Updated status of Manifest for AWB: ${trackingAwb} to ${targetStatus}`);
    }

    // Auth with Google using OAuth2 Refresh Token credentials to avoid Service Account quota limits
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const allFilesToProcess: { id: string; name: string; mimeType: string; webViewLink: string; lpn?: string }[] = [];

    // 2. Scan Rejections flat folder for any files matching tracking AWB in name (with Shared Drive support)
    const rejectionsFolderId = process.env.GOOGLE_DRIVE_REJECTIONS_FOLDER_ID;
    if (rejectionsFolderId) {
      try {
        const rejList = await drive.files.list({
          q: `'${rejectionsFolderId}' in parents and name contains '${trackingAwb}' and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const rejFiles = rejList.data.files || [];
        for (const file of rejFiles) {
          allFilesToProcess.push({
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            webViewLink: file.webViewLink!,
          });
        }
      } catch (e) {
        console.error('Failed to list files in Google Drive rejections folder:', e);
      }
    }

    // 3. Scan the standard order folder (if it exists, with Shared Drive support)
    if (orderFolderId && orderFolderId !== rejectionsFolderId) {
      try {
        const listRes = await drive.files.list({
          q: `'${orderFolderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const directChildren = listRes.data.files || [];
        for (const item of directChildren) {
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            // It's a subfolder, treat its name as the LPN!
            const lpnValue = item.name!;
            const subList = await drive.files.list({
              q: `'${item.id}' in parents and trashed = false`,
              fields: 'files(id, name, mimeType, webViewLink)',
              spaces: 'drive',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });
            const subFiles = subList.data.files || [];
            for (const subFile of subFiles) {
              allFilesToProcess.push({
                id: subFile.id!,
                name: subFile.name!,
                mimeType: subFile.mimeType!,
                webViewLink: subFile.webViewLink!,
                lpn: lpnValue,
              });
            }
          } else {
            allFilesToProcess.push({
              id: item.id!,
              name: item.name!,
              mimeType: item.mimeType!,
              webViewLink: item.webViewLink!,
            });
          }
        }
      } catch (e) {
        console.error('Failed to list files in Google Drive order folder:', e);
      }
    }

    // 4. Scan Local System Storage uploads/ directory for any local fallbacks containing tracking AWB
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const localFiles = fs.readdirSync(uploadsDir);
        for (const filename of localFiles) {
          if (filename.includes(trackingAwb)) {
            // Determine content MIME type
            let mimeType = 'application/octet-stream';
            if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
              mimeType = 'image/jpeg';
            } else if (filename.endsWith('.png')) {
              mimeType = 'image/png';
            } else if (filename.endsWith('.webm')) {
              mimeType = 'video/webm';
            } else if (filename.endsWith('.mp4')) {
              mimeType = 'video/mp4';
            }

            // Parse LPN from filename if it has one (e.g. lpn_LPN-AMZ-9991_)
            let parsedLpn: string | undefined = undefined;
            const lpnMatch = filename.match(/lpn_([a-zA-Z0-9-]+)/i);
            if (lpnMatch && lpnMatch[1]) {
              parsedLpn = lpnMatch[1];
            }

            // Avoid adding if already added from Google Drive (match by original file name)
            const baseName = filename.substring(filename.indexOf('_') + 1); // strip out timestamp prefix
            const isAlreadyProcessed = allFilesToProcess.some(f => f.name === baseName);

            if (!isAlreadyProcessed) {
              allFilesToProcess.push({
                id: `local_${filename}`,
                name: baseName,
                mimeType: mimeType,
                webViewLink: `/api/uploads/${filename}`,
                lpn: parsedLpn,
              });
            }
          }
        }
      }
    } catch (localError) {
      console.error('Failed to scan local system storage uploads directory:', localError);
    }

    console.log(`[Finalize Scan] Resolved ${allFilesToProcess.length} total files (Drive + Local) for AWB ${trackingAwb}`);

    // Validate uploadedById exists in database to prevent foreign key constraint violations
    const headerUserId = req.headers.get('x-user-id');
    const rawUploadedById = uploadedById || headerUserId || null;

    let resolvedUploadedById: string | null = null;
    if (rawUploadedById && typeof rawUploadedById === 'string' && rawUploadedById.trim() !== '' && rawUploadedById !== 'undefined' && rawUploadedById !== 'null') {
      try {
        const userExists = await prisma.user.findUnique({
          where: { id: rawUploadedById }
        });
        if (userExists) {
          resolvedUploadedById = rawUploadedById;
        } else {
          console.warn(`[Finalize] Provided uploadedById "${rawUploadedById}" does not exist in User table. Falling back to null.`);
        }
      } catch (err) {
        console.error(`[Finalize] Error validating user "${rawUploadedById}":`, err);
      }
    }

    const evidenceRecordsCreated = [];

    // 5. Scan and resolve all ReturnItem records for LPNs found in the files
    for (const file of allFilesToProcess) {
      if (file.lpn) {
        let returnItem = await prisma.returnItem.findFirst({
          where: {
            lpn: file.lpn,
            manifestId: manifest.id,
          },
        });

        if (!returnItem) {
          // Find or create Order dynamically
          const platformOrderId = trackingAwb;
          let order = await prisma.order.findUnique({
            where: { platformOrderId },
          });

          if (!order) {
            order = await prisma.order.create({
              data: {
                platformOrderId: platformOrderId,
                marketplace: 'AMAZON',
                purchaseDate: new Date(),
              },
            });
            console.log(`[Database Dynamic Create] Created missing Order for ID: ${platformOrderId}`);
          }

          // Create missing ReturnItem
          returnItem = await prisma.returnItem.create({
            data: {
              orderId: order.id,
              manifestId: manifest.id,
              sku: file.lpn, // Default SKU to the LPN string
              lpn: file.lpn,
              quantity: 1,
              returnReason: 'Inspected Damage',
              condition: 'PRODUCT_DAMAGED',
            },
          });
          console.log(`[Database Dynamic Create] Created missing ReturnItem for LPN: ${file.lpn}`);
        }
      }
    }

    // 6. Create/Upsert a SINGLE Evidence record for the entire Order ID (AWB)
    const evidenceType = isRejection ? 'RECEIVER_REJECTION' : 'INSPECTION_VIDEO';
    
    // For single order id there is a single input row in db, no multiple rows
    let existingEvidence = await prisma.evidence.findFirst({
      where: {
        manifestId: manifest.id,
        type: evidenceType,
      },
    });

    let ev;
    if (!existingEvidence) {
      ev = await prisma.evidence.create({
        data: {
          driveFileId: orderFolderId || 'local_fallback',
          driveLink: folderLink || 'local_fallback',
          type: evidenceType,
          reason: reason || (isRejection ? 'Package failed visual inspection' : 'Complete Order Inspection Folder'),
          uploadedById: resolvedUploadedById,
          manifestId: manifest.id,
        },
      });
      console.log(`[Database Single Evidence Create] Created single Evidence row for AWB: ${trackingAwb}`);
      evidenceRecordsCreated.push(ev);
    } else {
      ev = await prisma.evidence.update({
        where: { id: existingEvidence.id },
        data: {
          driveFileId: orderFolderId || existingEvidence.driveFileId,
          driveLink: folderLink || existingEvidence.driveLink,
          reason: reason || existingEvidence.reason,
          uploadedById: resolvedUploadedById || existingEvidence.uploadedById,
        },
      });
      console.log(`[Database Single Evidence Update] Updated single Evidence row for AWB: ${trackingAwb}`);
      evidenceRecordsCreated.push(ev);
    }

    return NextResponse.json({
      success: true,
      message: 'Evidence successfully registered in the database',
      evidenceCount: evidenceRecordsCreated.length,
      evidence: evidenceRecordsCreated,
    });
  } catch (error: any) {
    console.error('🔥 UPLOAD FINALIZE FAILED:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
