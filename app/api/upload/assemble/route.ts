import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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

      // Stream each chunk into the write stream sequentially (no readFileSync memory spike)
      const pipeChunkSequentially = (index: number) => {
        if (index >= total) {
          writeStream.end();
          return;
        }
        const partPath = path.join(chunksDir, `${index}.part`);
        const readStream = fs.createReadStream(partPath);
        readStream.on('error', (err) => {
          writeStream.destroy(err);
          reject(err);
        });
        readStream.on('end', () => pipeChunkSequentially(index + 1));
        readStream.pipe(writeStream, { end: false });
      };

      pipeChunkSequentially(0);
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

    // Delete any existing file with the same name in this folder (dedup on retry)
    try {
      const existing = await drive.files.list({
        q: `name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of existing.data.files || []) {
        if (f.id) {
          await drive.files.delete({ fileId: f.id, supportsAllDrives: true });
          console.log(`[Assemble Dedup] Deleted existing file ${f.id} (name: ${name}) before re-upload`);
        }
      }
    } catch (dedupErr: any) {
      console.warn(`[Assemble Dedup] Could not check/remove duplicates for "${name}":`, dedupErr.message);
    }

    try {
      // Get a fresh access token for raw HTTP calls
      const tokenRes = await oauth2Client.getAccessToken();
      const accessToken = tokenRes.token;
      if (!accessToken) throw new Error('Failed to obtain Google access token');

      const fileSize = assembledStats.size;
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk to Drive

      // Step 1: Initiate resumable upload session
      const initRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(fileSize),
          },
          body: JSON.stringify({ name, parents: [folderId] }),
        }
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        throw new Error(`Resumable upload init failed (${initRes.status}): ${errText}`);
      }

      const sessionUri = initRes.headers.get('location');
      if (!sessionUri) throw new Error('No session URI returned from Drive resumable init');

      console.log(`[Assemble] Resumable session started for ${name} (${(fileSize / (1024 * 1024)).toFixed(1)} MB)`);

      // Step 2: Upload file in chunks
      const fd = fs.openSync(assembledFilePath, 'r');
      let offset = 0;

      try {
        while (offset < fileSize) {
          const remaining = fileSize - offset;
          const currentChunkSize = Math.min(CHUNK_SIZE, remaining);
          const buffer = Buffer.alloc(currentChunkSize);
          fs.readSync(fd, buffer, 0, currentChunkSize, offset);

          const rangeEnd = offset + currentChunkSize - 1;
          const contentRange = `bytes ${offset}-${rangeEnd}/${fileSize}`;

          let chunkRes: Response | null = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            chunkRes = await fetch(sessionUri, {
              method: 'PUT',
              headers: {
                'Content-Length': String(currentChunkSize),
                'Content-Range': contentRange,
              },
              body: buffer,
            });

            if (chunkRes.status === 200 || chunkRes.status === 201 || chunkRes.status === 308) {
              break;
            }

            console.warn(`[Assemble] Chunk upload attempt ${attempt} failed (${chunkRes.status}), retrying...`);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
          }

          if (!chunkRes || (chunkRes.status !== 200 && chunkRes.status !== 201 && chunkRes.status !== 308)) {
            const errText = await chunkRes?.text();
            throw new Error(`Chunk upload failed at offset ${offset}: ${chunkRes?.status} ${errText}`);
          }

          offset += currentChunkSize;

          // 308 = more chunks needed, 200/201 = upload complete
          if (chunkRes.status === 200 || chunkRes.status === 201) {
            const result = await chunkRes.json();
            fileId = result.id;
            webViewLink = result.webViewLink || '';
            console.log(`[Assemble] Resumable upload complete: ${fileId}`);
          }
        }
      } finally {
        fs.closeSync(fd);
      }

      // If we finished all chunks but didn't get fileId from final response, fetch it
      if (!fileId) throw new Error('Upload completed but no file ID received');

      // Fetch webViewLink if not returned
      if (!webViewLink) {
        const meta = await drive.files.get({ fileId, fields: 'webViewLink', supportsAllDrives: true });
        webViewLink = meta.data.webViewLink || '';
      }

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
