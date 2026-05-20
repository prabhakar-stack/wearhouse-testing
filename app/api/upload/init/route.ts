import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, type, filesMetaData } = body;

    if (!orderId || !type || !filesMetaData) {
      return NextResponse.json({ error: 'Missing orderId, type, or filesMetaData' }, { status: 400 });
    }

    // Auth with Google using OAuth2 Refresh Token credentials to avoid Service Account quota limits
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const uploadUrls: Record<string, string> = {};
    let orderFolderId = '';
    let folderLink = '';

    if (type === 'RECEIVER_REJECTION') {
      const parentFolderId = process.env.GOOGLE_DRIVE_REJECTIONS_FOLDER_ID;
      if (!parentFolderId) {
        return NextResponse.json({ error: 'Rejections folder ID is not configured in .env' }, { status: 500 });
      }

      // Rejections are stored flat inside GOOGLE_DRIVE_REJECTIONS_FOLDER_ID
      for (const file of filesMetaData) {
        uploadUrls[file.key] = `/api/upload/raw?folderId=${parentFolderId}&name=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.mimeType)}`;
      }

      orderFolderId = parentFolderId;
      folderLink = `https://drive.google.com/drive/folders/${parentFolderId}`;
    } else {
      // Standard Inspection
      const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!parentFolderId) {
        return NextResponse.json({ error: 'Standard folder ID is not configured in .env' }, { status: 500 });
      }

      // Search or create order folder under standard folder with Shared Drive support
      const listRes = await drive.files.list({
        q: `name = '${orderId}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      if (listRes.data.files && listRes.data.files.length > 0) {
        orderFolderId = listRes.data.files[0].id!;
        folderLink = listRes.data.files[0].webViewLink!;
      } else {
        const createRes = await drive.files.create({
          requestBody: {
            name: orderId,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
          },
          fields: 'id, webViewLink',
          supportsAllDrives: true,
          supportsTeamDrives: true,
        });
        orderFolderId = createRes.data.id!;
        folderLink = createRes.data.webViewLink!;

        // Make order folder publicly readable
        try {
          await drive.permissions.create({
            fileId: orderFolderId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
            supportsAllDrives: true,
            supportsTeamDrives: true,
          });
        } catch (e) {
          console.error('Failed to set order folder permissions:', e);
        }
      }

      // Keep track of resolved LPN folders to avoid repeated Drive API lookups
      const resolvedLpnFolders: Record<string, string> = {};

      for (const file of filesMetaData) {
        let targetFolderId = orderFolderId;

        // If file is associated with a specific LPN, it goes to the LPN subfolder
        if (file.lpn) {
          const lpnFolderKey = file.lpn;
          if (resolvedLpnFolders[lpnFolderKey]) {
            targetFolderId = resolvedLpnFolders[lpnFolderKey];
          } else {
            // Find or create subfolder for this LPN inside the main order folder
            const subfolderList = await drive.files.list({
              q: `name = '${lpnFolderKey}' and mimeType = 'application/vnd.google-apps.folder' and '${orderFolderId}' in parents and trashed = false`,
              fields: 'files(id, name)',
              spaces: 'drive',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });

            if (subfolderList.data.files && subfolderList.data.files.length > 0) {
              targetFolderId = subfolderList.data.files[0].id!;
            } else {
              const subfolderCreate = await drive.files.create({
                requestBody: {
                  name: lpnFolderKey,
                  mimeType: 'application/vnd.google-apps.folder',
                  parents: [orderFolderId],
                },
                fields: 'id',
                supportsAllDrives: true,
                supportsTeamDrives: true,
              });
              targetFolderId = subfolderCreate.data.id!;

              // Make the LPN subfolder publicly readable
              try {
                await drive.permissions.create({
                  fileId: targetFolderId,
                  requestBody: {
                    role: 'reader',
                    type: 'anyone',
                  },
                  supportsAllDrives: true,
                  supportsTeamDrives: true,
                });
              } catch (e) {
                console.error(`Failed to set permissions for subfolder ${lpnFolderKey}:`, e);
              }
            }
            resolvedLpnFolders[lpnFolderKey] = targetFolderId;
          }
        }

        // Create relative URL for local raw upload route
        uploadUrls[file.key] = `/api/upload/raw?folderId=${targetFolderId}&name=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.mimeType)}`;
      }
    }

    return NextResponse.json({
      uploadUrls,
      folderLink,
      orderFolderId,
    });
  } catch (error: any) {
    console.error('🔥 UPLOAD INIT FAILED:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
