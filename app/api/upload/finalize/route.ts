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
    const { orderId, folderLink, orderFolderId, type, uploadedById, reason, manifestId, orderPlatformId, lpnConditions, lpnRecoveryTypes } = body;

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
            trackingNumber: true,
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
      const uploadsDir = process.env.VERCEL
        ? path.join('/tmp', 'uploads')
        : path.join(process.cwd(), 'uploads');
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

    let resolvedUploadedByEmail: string | null = null;
    if (rawUploadedById && typeof rawUploadedById === 'string' && rawUploadedById.trim() !== '' && rawUploadedById !== 'undefined' && rawUploadedById !== 'null') {
      try {
        const user = await prisma.user.findUnique({
          where: { id: rawUploadedById }
        });
        if (user) {
          resolvedUploadedByEmail = user.email;
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

    // Since ReturnItem is decoupled from Order, let's find the relevant return items.
    // Fetch the raw removal shipments to know which SKUs/FNSKUs were expected in this manifest/orders
    const trackingNumbers = (manifest.orders || []).map(o => o.trackingNumber).filter((t): t is string => !!t);

    const removalShipments = await prisma.aMZRemovalShipment.findMany({
      where: {
        OR: [
          { orderId: { in: manifestOrderIds } },
          { trackingNumber: { in: trackingNumbers } }
        ]
      }
    });

    const expectedSkus = Array.from(new Set(removalShipments.map(s => s.sku).filter((s): s is string => !!s)));
    const expectedFnskus = Array.from(new Set(removalShipments.map(s => s.fnsku).filter((f): f is string => !!f)));

    const expectedItems = await prisma.returnItem.findMany({
      where: {
        OR: [
          { sku: { in: expectedSkus } },
          { fnsku: { in: expectedFnskus } }
        ]
      }
    });

    if (isRejection) {
      // 5. RECEIVER REJECTION - recorded at the order level.
      const ev = await prisma.evidence.upsert({
        where: { lpn: trackingId },
        update: {
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'RECEIVER_REJECTION',
          uploadedByEmail: resolvedUploadedByEmail,
          manifestId: manifest.id,
          claimReason: 'DOCK_DAMAGE',
          claimSubReason: reason || 'Package failed visual inspection',
        },
        create: {
          lpn: trackingId,
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'RECEIVER_REJECTION',
          uploadedByEmail: resolvedUploadedByEmail,
          manifestId: manifest.id,
          claimReason: 'DOCK_DAMAGE',
          claimSubReason: reason || 'Package failed visual inspection',
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
      // 1. Fetch expected removal shipments to determine expected quantities per FNSKU
      const shipments = await prisma.aMZRemovalShipment.findMany({
        where: {
          OR: [
            { orderId: scopedOrderId },
            { trackingNumber: scopedOrderId }
          ]
        }
      });

      const expectedFnskuQuantities = new Map<string, number>();
      for (const s of shipments) {
        if (s.fnsku && s.shippedQuantity) {
          const fnsku = s.fnsku;
          expectedFnskuQuantities.set(fnsku, (expectedFnskuQuantities.get(fnsku) || 0) + s.shippedQuantity);
        }
      }

      // A. Process all scanned LPNs from dashboard conditions payload
      if (lpnConditions) {
        for (const [lpn, rawCondition] of Object.entries(lpnConditions)) {
          if (!lpn) continue;
          const normalizedLpnVal = normalizeLpn(lpn);
          scannedLpns.add(normalizedLpnVal);

          let resolvedCondition = 'PRODUCT_DAMAGED';
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
            } else {
              claimReason = payload || null;
            }
          } else {
            resolvedCondition = ALLOWED_CONDITIONS.has(conditionStr)
              ? conditionStr
              : conditionMap[conditionStr] || 'PRODUCT_DAMAGED';
          }

          // Lookup from operational ReturnItem to get details
          const rawReturn = await prisma.returnItem.findUnique({
            where: { lpn: normalizedLpnVal }
          });

          const scannedFnsku = rawReturn?.fnsku || rawReturn?.sku || 'UNKNOWN_FNSKU';

          // Consume FNSKU expected quantity
          const expectedQty = expectedFnskuQuantities.get(scannedFnsku) || 0;
          if (expectedQty > 0) {
            expectedFnskuQuantities.set(scannedFnsku, expectedQty - 1);
          }

          await prisma.returnItem.upsert({
            where: { lpn: normalizedLpnVal },
            update: {},
            create: {
              lpn: normalizedLpnVal,
              sku: rawReturn?.sku || "UNKNOWN_SKU",
              asin: rawReturn?.asin || null,
              fnsku: rawReturn?.fnsku || null,
              productName: rawReturn?.productName || `SKU: ${rawReturn?.sku || "UNKNOWN"}`,
              reason: rawReturn?.reason || "Removal Order Shipment",
              customerComments: rawReturn?.customerComments || null,
              // marketplace defaults to "amazon"
            },
            select: { lpn: true }
          });

          const lpnDriveLink = lpnToDriveLinkMap[lpn] || null;
          const orderDriveLink = folderLink || null;
          const recoveryType = lpnRecoveryTypes && lpnRecoveryTypes[lpn] ? lpnRecoveryTypes[lpn] : null;

          if (resolvedCondition === 'GOOD_SELLABLE') {
            await prisma.itemStatus.upsert({
              where: { lpn: normalizedLpnVal },
              update: { status: 'GOOD', recoveryType: null },
              create: { lpn: normalizedLpnVal, status: 'GOOD', recoveryType: null }
            });
            await prisma.evidence.deleteMany({
              where: { lpn: normalizedLpnVal }
            });
          } else if (resolvedCondition === 'PACKAGING_DAMAGED') {
            await prisma.itemStatus.upsert({
              where: { lpn: normalizedLpnVal },
              update: { status: 'RECOVERY', recoveryType: recoveryType },
              create: { lpn: normalizedLpnVal, status: 'RECOVERY', recoveryType: recoveryType }
            });
            await prisma.evidence.deleteMany({
              where: { lpn: normalizedLpnVal }
            });
          } else {
            await prisma.itemStatus.deleteMany({
              where: { lpn: normalizedLpnVal }
            });

            const ev = await prisma.evidence.upsert({
              where: { lpn: normalizedLpnVal },
              update: {
                orderId: trackingId,
                orderDriveLink,
                lpnDriveLink,
                type: 'INSPECTOR_REJECTION',
                claimReason: claimReason || 'PRODUCT_DAMAGE',
                claimSubReason: claimSubReason || `Product defect folder/photos for LPN ${normalizedLpnVal}`,
                uploadedByEmail: resolvedUploadedByEmail,
                manifestId: manifest.id,
              },
              create: {
                lpn: normalizedLpnVal,
                orderId: trackingId,
                orderDriveLink,
                lpnDriveLink,
                type: 'INSPECTOR_REJECTION',
                claimReason: claimReason || 'PRODUCT_DAMAGE',
                claimSubReason: claimSubReason || `Product defect folder/photos for LPN ${normalizedLpnVal}`,
                uploadedByEmail: resolvedUploadedByEmail,
                manifestId: manifest.id,
              }
            });
            evidenceRecordsCreated.push(ev);
          }
        }
      }

      // B. Process missing items (expected FNSKUs remaining unscanned)
      for (const [fnsku, missingQty] of expectedFnskuQuantities.entries()) {
        if (missingQty > 0) {
          // Store shortage details in MissingItem table
          await prisma.missingItem.upsert({
            where: {
              orderId_fnsku: {
                orderId: scopedOrderId,
                fnsku: fnsku
              }
            },
            update: {
              missingQuantity: missingQty
            },
            create: {
              orderId: scopedOrderId,
              fnsku: fnsku,
              missingQuantity: missingQty
            }
          });

          // Create Evidence for claims for this shortage under a virtual LPN key
          const missingLpn = `missing_${scopedOrderId}_${fnsku}`;
          const ev = await prisma.evidence.upsert({
            where: { lpn: missingLpn },
            update: {
              orderId: trackingId,
              orderDriveLink: folderLink || null,
              lpnDriveLink: null,
              type: 'INSPECTOR_REJECTION',
              claimReason: 'MISSING',
              claimSubReason: `FNSKU ${fnsku} is missing during inspection (Quantity: ${missingQty})`,
              uploadedByEmail: resolvedUploadedByEmail,
              manifestId: manifest.id,
            },
            create: {
              lpn: missingLpn,
              orderId: trackingId,
              orderDriveLink: folderLink || null,
              lpnDriveLink: null,
              type: 'INSPECTOR_REJECTION',
              claimReason: 'MISSING',
              claimSubReason: `FNSKU ${fnsku} is missing during inspection (Quantity: ${missingQty})`,
              uploadedByEmail: resolvedUploadedByEmail,
              manifestId: manifest.id,
            }
          });
          evidenceRecordsCreated.push(ev);
        } else {
          // Delete from MissingItem
          await prisma.missingItem.deleteMany({
            where: {
              orderId: scopedOrderId,
              fnsku: fnsku
            }
          });

          const missingLpn = `missing_${scopedOrderId}_${fnsku}`;
          await prisma.evidence.deleteMany({
            where: { lpn: missingLpn }
          });
        }
      }

      // C. Upsert standard order inspection video evidence (overall folder link)
      const videoLpnKey = `video_${trackingId}`;
      const ev = await prisma.evidence.upsert({
        where: { lpn: videoLpnKey },
        update: {
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'INSPECTOR_REJECTION',
          claimReason: 'VIDEO_RECORDING',
          claimSubReason: reason || 'Complete Order Inspection Folder',
          uploadedByEmail: resolvedUploadedByEmail,
          manifestId: manifest.id,
        },
        create: {
          lpn: videoLpnKey,
          orderId: trackingId,
          orderDriveLink: folderLink || null,
          lpnDriveLink: null,
          type: 'INSPECTOR_REJECTION',
          claimReason: 'VIDEO_RECORDING',
          claimSubReason: reason || 'Complete Order Inspection Folder',
          uploadedByEmail: resolvedUploadedByEmail,
          manifestId: manifest.id,
        }
      });
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
