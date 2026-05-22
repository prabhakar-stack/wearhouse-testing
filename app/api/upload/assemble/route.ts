import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Allow up to 5 minutes for assembly + Drive upload of large inspection videos.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let assembledFilePath = '';
  let chunksDir = '';

  try {
    const body = await req.json();
    const { uploadId, totalChunks, name, mimeType, folderId } = body;

    if (!uploadId || !totalChunks || !name || !mimeType || !folderId) {
      return NextResponse.json({ error: 'Missing uploadId, totalChunks, name, mimeType, or folderId' }, { status: 400 });
    }

    const total = parseInt(totalChunks, 10);
    if (isNaN(total) || total < 1) {
      return NextResponse.json({ error: 'Invalid totalChunks' }, { status: 400 });
    }

    const uploadsDir = process.env.VERCEL
      ? path.join('/tmp', 'uploads')
      : path.join(process.cwd(), 'uploads');

    chunksDir = path.join(uploadsDir, 'chunks', uploadId);

    // Verify all chunks are present before assembling
    const missingChunks: number[] = [];
    for (let i = 0; i < total; i++) {
      const partPath = path.join(chunksDir, `${i}.part`);
      if (!fs.existsSync(partPath)) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length > 0) {
      console.error(`[Assemble] Missing chunks for uploadId=${uploadId}: [${missingChunks.join(', ')}]`);
      return NextResponse.json({
        error: `Missing chunks: [${missingChunks.join(', ')}]`,
        missingChunks,
      }, { status: 400 });
    }

    // Assemble all .part files into a single final file
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    assembledFilePath = path.join(uploadsDir, `${Date.now()}_${sanitizedName}`);

    console.log(`[Assemble] Assembling ${total} chunks for uploadId=${uploadId} → ${assembledFilePath}`);

    const writeStream = fs.createWriteStream(assembledFilePath);
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);

      (async () => {
        try {
          for (let i = 0; i < total; i++) {
            const partPath = path.join(chunksDir, `${i}.part`);
            const chunkData = fs.readFileSync(partPath);
            writeStream.write(chunkData);
          }
          writeStream.end();
        } catch (err) {
          writeStream.destroy(err as Error);
          reject(err);
        }
      })();
    });

    const assembledStats = fs.statSync(assembledFilePath);
    console.log(`[Assemble] Assembly complete: ${(assembledStats.size / (1024 * 1024)).toFixed(2)} MB at ${assembledFilePath}`);

    // Clean up temp chunk directory (non-blocking — don't fail if cleanup errors)
    try {
      fs.rmSync(chunksDir, { recursive: true, force: true });
      console.log(`[Assemble] Cleaned up temp chunks dir: ${chunksDir}`);
    } catch (cleanupErr) {
      console.warn('[Assemble] Could not clean up chunks dir:', cleanupErr);
    }

    // Auth with Google using OAuth2 Refresh Token credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    let fileId = '';
    let webViewLink = '';

    try {
      const res = await drive.files.create({
        requestBody: {
          name: name,
          parents: [folderId],
        },
        media: {
          mimeType: mimeType,
          body: fs.createReadStream(assembledFilePath),
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      fileId = res.data.id!;
      webViewLink = res.data.webViewLink!;

      // Make publicly readable
      try {
        await drive.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' },
          supportsAllDrives: true,
          supportsTeamDrives: true,
        });
      } catch (permErr) {
        console.warn(`[Assemble] Could not set Drive permissions for file ${name}:`, permErr);
      }

      console.log(`[Assemble] Successfully uploaded assembled file to Google Drive: ${fileId}`);

      // Delete the local file since the upload to Google Drive succeeded
      try {
        if (fs.existsSync(assembledFilePath)) {
          fs.unlinkSync(assembledFilePath);
          console.log(`[Local Disk Cleanup] Cleaned up local assembled file: ${assembledFilePath}`);
        }
      } catch (cleanupErr) {
        console.warn(`[Local Disk Cleanup Warning] Could not delete local assembled file ${assembledFilePath}:`, cleanupErr);
      }
    } catch (driveError: any) {
      console.warn(`⚠️ [Assemble] Drive upload failed, falling back to local serving:`, driveError.message);
      const localName = path.basename(assembledFilePath);
      fileId = `local_${localName}`;
      webViewLink = `/api/uploads/${localName}`;
    }

    return NextResponse.json({
      success: true,
      fileId,
      webViewLink,
      localPath: assembledFilePath,
    });
  } catch (error: any) {
    console.error('🔥 ASSEMBLE FAILED:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
