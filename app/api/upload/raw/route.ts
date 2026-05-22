import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function PUT(req: NextRequest) {
  let localFilePath = '';
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    const name = searchParams.get('name');
    const mimeType = searchParams.get('mimeType');

    if (!folderId || !name || !mimeType) {
      return NextResponse.json({ error: 'Missing folderId, name, or mimeType parameters' }, { status: 400 });
    }

    // Ensure the uploads directory exists on the system
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const sanitizedFileName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    localFilePath = path.join(uploadsDir, sanitizedFileName);

    // 1. Store the file in user's system storage first using a highly efficient memory-stream to support large files
    const writeStream = fs.createWriteStream(localFilePath);
    if (req.body) {
      const reader = req.body.getReader();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                writeStream.end();
                break;
              }
              writeStream.write(Buffer.from(value));
            }
          } catch (err) {
            writeStream.destroy(err as Error);
            reject(err);
          }
        })();
      });
    } else {
      writeStream.end();
    }
    console.log(`[Local Disk Storage] Successfully stored file in system storage: ${localFilePath}`);

    // Auth with Google using OAuth2 Refresh Token credentials to avoid Service Account quota limits
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 2. Upload file directly to Drive from the local system storage
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(localFilePath),
    };

    let fileId = '';
    let webViewLink = '';

    try {
      const res = await drive.files.create({
        requestBody: {
          name: name,
          parents: [folderId],
        },
        media: media,
        fields: 'id, webViewLink',
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      fileId = res.data.id!;
      webViewLink = res.data.webViewLink!;

      // Make the file publicly readable
      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
          supportsAllDrives: true,
          supportsTeamDrives: true,
        });
      } catch (permError) {
        console.error(`[Google Drive Permissions Warning] Failed to set permissions for file ${name}:`, permError);
      }

      console.log(`[Google Drive Success] Successfully uploaded file to Google Drive: ${fileId}`);

      // Delete the local file since the upload to Google Drive succeeded
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          console.log(`[Local Disk Cleanup] Cleaned up local file: ${localFilePath}`);
        }
      } catch (cleanupErr) {
        console.warn(`[Local Disk Cleanup Warning] Could not delete local file ${localFilePath}:`, cleanupErr);
      }
    } catch (driveError: any) {
      console.warn(`⚠️ [Google Drive Warning] Drive upload failed, falling back to local storage serving:`, driveError.message);
      
      // Fallback: local serving endpoint URL
      fileId = `local_${sanitizedFileName}`;
      webViewLink = `/api/uploads/${sanitizedFileName}`;
    }

    return NextResponse.json({
      success: true,
      fileId: fileId,
      webViewLink: webViewLink,
      localPath: localFilePath,
    });
  } catch (error: any) {
    console.error('🔥 LOCAL STORAGE OR GOOGLE UPLOAD CRITICAL FAILURE:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
