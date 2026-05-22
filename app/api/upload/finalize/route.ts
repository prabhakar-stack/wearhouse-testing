import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const ALLOWED_CONDITIONS = new Set([
  'GOOD_SELLABLE',
  'PACKAGING_DAMAGED',
  'PRODUCT_DAMAGED',
  'WRONG_ITEM',
  'MISSING',
  'BAD_FAKE_PRODUCT',
]);

function normalizeLpn(value: string) {
  return value.trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, folderLink, orderFolderId, type, uploadedById, reason, manifestId, orderPlatformId, lpnConditions } = body;

    const trackingId = orderId || manifestId;
    if (!trackingId) {
      return NextResponse.json({ error: 'Missing orderId or manifestId in request body' }, { status: 400 });
    }

    console.log(`[Finalize Upload] Finalizing for Tracking ID: ${trackingId}`, body);

    // 1. Resolve and Dynamically Upsert the Manifest record (evidence linkage only — NO status change)
    let manifest = await prisma.manifest.findFirst({
      where: {
        OR: [
          { trackingId: trackingId },
          { id: manifestId || '' },
          { orders: { some: { platformOrderId: trackingId } } },
          { orders: { some: { platformOrderId: orderPlatformId || '' } } },
        ]
      },
      include: {
        orders: {
          select: {
            platformOrderId: true,
          }
        }
      }
    });

    if (!manifest) {
      console.warn(`[Finalize Upload] Manifest not found for Tracking ID: ${trackingId}. Dynamic creation is disabled.`);
      return NextResponse.json({ error: `Manifest not found for ID: ${trackingId}` }, { status: 404 });
    }

    // Auth with Google using OAuth2 Refresh Token credentials to avoid Service Account quota limits
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const allFilesToProcess: { id: string; name: string; mimeType: string; webViewLink: string; lpn?: string }[] = [];
    const lpnToDriveLinkMap: Record<string, string> = {};

    // 2. Scan Rejections flat folder for any files matching tracking ID in name (with Shared Drive support)
    const rejectionsFolderId = process.env.GOOGLE_DRIVE_REJECTIONS_FOLDER_ID;
    if (rejectionsFolderId) {
      try {
        const rejList = await drive.files.list({
          q: `'${rejectionsFolderId}' in parents and name contains '${trackingId}' and trashed = false`,
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
            lpnToDriveLinkMap[lpnValue] = item.webViewLink!;
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

    // 4. Scan Local System Storage uploads/ directory for any local fallbacks containing tracking ID
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const localFiles = fs.readdirSync(uploadsDir);
        for (const filename of localFiles) {
          if (filename.includes(trackingId)) {
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

    console.log(`[Finalize Scan] Resolved ${allFilesToProcess.length} total files (Drive + Local) for tracking ID ${trackingId}`);

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
    const isRejection = type === 'RECEIVER_REJECTION';

    const manifestOrderIds = manifest.orders.map(order => order.platformOrderId);
    const scopedOrderId =
      typeof orderPlatformId === 'string' && orderPlatformId.trim()
        ? orderPlatformId.trim()
        : manifestOrderIds.includes(trackingId)
          ? trackingId
          : manifestOrderIds.length === 1
            ? manifestOrderIds[0]
            : null;

    if (!isRejection && !scopedOrderId) {
      return NextResponse.json(
        { error: 'Missing orderPlatformId for a multi-order inspection.' },
        { status: 400 },
      );
    }

    if (!isRejection && scopedOrderId && !manifestOrderIds.includes(scopedOrderId)) {
      return NextResponse.json(
        { error: `Order ${scopedOrderId} does not belong to manifest ${manifest.trackingId}.` },
        { status: 400 },
      );
    }

    // Query all expected ReturnItems for the current manifest to identify missing items
    const expectedItems = await prisma.returnItem.findMany({
      where: {
        order: {
          manifestId: manifest.id
        },
        ...(scopedOrderId ? { orderId: scopedOrderId } : {}),
      }
    });

    if (isRejection) {
      // 5. RECEIVER REJECTION - recorded at the order level.
      // To maintain the @unique constraint on lpn, write the trackingId to lpn
      const ev = await prisma.evidence.upsert({
        where: { lpn: trackingId },
        update: {
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'RECEIVER_REJECTION',
          reason: reason || 'Package failed visual inspection',
          uploadedById: resolvedUploadedById,
          manifestId: manifest.id,
        },
        create: {
          lpn: trackingId,
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'RECEIVER_REJECTION',
          reason: reason || 'Package failed visual inspection',
          uploadedById: resolvedUploadedById,
          manifestId: manifest.id,
        }
      });
      console.log(`[Database Rejection Evidence] Upserted rejection evidence for Tracking ID: ${trackingId}`);
      evidenceRecordsCreated.push(ev);
    } else {
      // 6. STANDARD INSPECTION - LPN-level tracking
      const scannedLpns = new Set<string>();
      const conditionMap: Record<string, string> = {
        good: 'GOOD_SELLABLE',
        recovery: 'PACKAGING_DAMAGED',
        bad: 'PRODUCT_DAMAGED',
      };
      const expectedByLpn = new Map(
        expectedItems
          .filter(item => item.lpn)
          .map(item => [normalizeLpn(item.lpn), item]),
      );

      if (lpnConditions && typeof lpnConditions === 'object') {
        const invalidLpns = Object.keys(lpnConditions).filter(
          lpn => !expectedByLpn.has(normalizeLpn(lpn)),
        );

        if (invalidLpns.length > 0) {
          return NextResponse.json(
            {
              error: 'One or more scanned LPNs do not belong to this order.',
              invalidLpns,
              orderId: scopedOrderId,
            },
            { status: 400 },
          );
        }
      }

      // A. Process all scanned LPNs from dashboard conditions payload
      if (lpnConditions) {
        for (const [lpn, rawCondition] of Object.entries(lpnConditions)) {
          if (!lpn) continue;
          scannedLpns.add(normalizeLpn(lpn));

          let resolvedCondition = 'PRODUCT_DAMAGED';
          let inspectorDefectType: string | null = null;
          let claimReason: string | null = null;
          let claimSubReason: string | null = null;

          const conditionStr = typeof rawCondition === 'string' ? rawCondition : '';

          if (conditionStr.startsWith('bad:')) {
            resolvedCondition = 'PRODUCT_DAMAGED';
            const payload = conditionStr.substring(4); // Strip "bad:"
            if (payload.includes('::')) {
              const parts = payload.split('::');
              claimReason = parts[0] || null;
              claimSubReason = parts[1] || null;

              // Backward compatibility mapping to InspectorDefectType enum
              const lowerSub = claimSubReason?.toLowerCase() || '';
              if (lowerSub.includes('heavily damaged') || lowerSub.includes('minor damages')) {
                inspectorDefectType = 'CUSTOMER_DAMAGE';
              } else if (lowerSub.includes('packaging damaged')) {
                inspectorDefectType = 'WAREHOUSE_DAMAGE';
              } else if (lowerSub.includes('different') || lowerSub.includes('junk')) {
                inspectorDefectType = 'WRONG_ITEM_RECEIVED';
              } else if (lowerSub.includes('empty box') || lowerSub.includes('missing')) {
                inspectorDefectType = 'MISSING_PARTS_ACCESSORIES';
              } else if (lowerSub.includes('fake') || lowerSub.includes('replica') || lowerSub.includes('counterfeit')) {
                inspectorDefectType = 'FAKE_COUNTERFEIT';
              } else if (lowerSub.includes('lost') || lowerSub.includes('dispute')) {
                inspectorDefectType = 'CARRIER_DAMAGE';
              } else {
                inspectorDefectType = 'DEFECTIVE';
              }
            } else {
              inspectorDefectType = payload || null;
            }
          } else {
            resolvedCondition = ALLOWED_CONDITIONS.has(conditionStr)
              ? conditionStr
              : conditionMap[conditionStr] || 'PRODUCT_DAMAGED';
          }

          // Find if this LPN exists as an expected item for the scoped order.
          const matchingExpectedItem = expectedByLpn.get(normalizeLpn(lpn));

          let linkedReturnItemId: string | null = null;
          let evidenceReason = `Product defect folder/photos for LPN ${lpn}`;

          if (matchingExpectedItem) {
            linkedReturnItemId = matchingExpectedItem.lpn;
            // Update condition
            await prisma.returnItem.update({
              where: { lpn: matchingExpectedItem.lpn },
              data: {
                condition: resolvedCondition as any,
                inspectorDefectType: inspectorDefectType as any,
                claimReason: claimReason,
                claimSubReason: claimSubReason,
              },
            });
            console.log(`[Database Update] Updated ReturnItem ${matchingExpectedItem.lpn} condition: ${resolvedCondition}`);
          }

          // Upsert unique Evidence record for this LPN
          const lpnDriveLink = lpnToDriveLinkMap[lpn] || null;
          const orderDriveLink = folderLink || null;

          const ev = await prisma.evidence.upsert({
            where: { lpn },
            update: {
              orderId: trackingId,
              orderDriveLink,
              lpnDriveLink,
              type: 'PRODUCT_DAMAGE_PHOTO',
              reason: evidenceReason,
              claimReason,
              claimSubReason,
              uploadedById: resolvedUploadedById,
              manifestId: manifest.id,
              returnItemId: linkedReturnItemId,
            },
            create: {
              lpn,
              orderId: trackingId,
              orderDriveLink,
              lpnDriveLink,
              type: 'PRODUCT_DAMAGE_PHOTO',
              reason: evidenceReason,
              claimReason,
              claimSubReason,
              uploadedById: resolvedUploadedById,
              manifestId: manifest.id,
              returnItemId: linkedReturnItemId,
            }
          });
          console.log(`[Database Evidence Scanned] Upserted Evidence for LPN: ${lpn} (Linked: ${linkedReturnItemId !== null})`);
          evidenceRecordsCreated.push(ev);
        }
      }

      // B. Process missing LPNs (expected in ReturnItem but not scanned in inspector dashboard)
      const missingItems = expectedItems.filter(item => item.lpn && !scannedLpns.has(normalizeLpn(item.lpn)));
      for (const item of missingItems) {
        if (!item.lpn) continue;

        // Update ReturnItem condition to MISSING
        await prisma.returnItem.update({
          where: { lpn: item.lpn },
          data: {
            condition: 'MISSING',
            claimReason: null,
            claimSubReason: null,
          }
        });
        console.log(`[Database Update] Marked ReturnItem ${item.lpn} as MISSING`);

        // Upsert unique Evidence record for this missing LPN
        const ev = await prisma.evidence.upsert({
          where: { lpn: item.lpn },
          update: {
            orderId: trackingId,
            orderDriveLink: folderLink || null,
            lpnDriveLink: null,
            type: 'PRODUCT_DAMAGE_PHOTO',
            reason: 'missing',
            claimReason: null,
            claimSubReason: null,
            uploadedById: resolvedUploadedById,
            manifestId: manifest.id,
            returnItemId: item.lpn,
          },
          create: {
            lpn: item.lpn,
            orderId: trackingId,
            orderDriveLink: folderLink || null,
            lpnDriveLink: null,
            type: 'PRODUCT_DAMAGE_PHOTO',
            reason: 'missing',
            claimReason: null,
            claimSubReason: null,
            uploadedById: resolvedUploadedById,
            manifestId: manifest.id,
            returnItemId: item.lpn,
          }
        });
        console.log(`[Database Evidence Missing] Upserted missing Evidence for LPN: ${item.lpn}`);
        evidenceRecordsCreated.push(ev);
      }

      // C. Upsert standard order inspection video evidence (overall folder link)
      const videoLpnKey = `video_${trackingId}`;
      const ev = await prisma.evidence.upsert({
        where: { lpn: videoLpnKey },
        update: {
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'INSPECTION_VIDEO',
          reason: reason || 'Complete Order Inspection Folder',
          uploadedById: resolvedUploadedById,
          manifestId: manifest.id,
        },
        create: {
          lpn: videoLpnKey,
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'INSPECTION_VIDEO',
          reason: reason || 'Complete Order Inspection Folder',
          uploadedById: resolvedUploadedById,
          manifestId: manifest.id,
        }
      });
      console.log(`[Database Single Evidence Video] Upserted inspection video Evidence for: ${videoLpnKey}`);
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
