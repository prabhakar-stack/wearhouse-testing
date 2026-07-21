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

    // Ensure the uploads directory exists on the system.
    // NOTE: On Vercel, /tmp is ephemeral. Files here survive for the lifetime of
    // the function invocation only. The primary path must always be Google Drive.
    const uploadsDir = process.env.VERCEL
      ? path.join('/tmp', 'uploads')
      : path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const sanitizedFileName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    localFilePath = path.join(uploadsDir, sanitizedFileName);

    // 1. Write incoming stream to local disk first.
    //    This is a staging buffer — the real destination is always Google Drive.
    if (req.body) {
      const arrayBuffer = await req.arrayBuffer();
      fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
    } else {
      fs.writeFileSync(localFilePath, Buffer.alloc(0));
    }
    console.log(`[Local Disk Storage] Staged file to disk: ${localFilePath}`);

    // Auth with Google using OAuth2 Refresh Token credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 2. Delete any existing file with the same name in this folder (dedup on retry)
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
          console.log(`[Drive Dedup] Deleted existing file ${f.id} (name: ${name}) before re-upload`);
        }
      }
    } catch (dedupErr: any) {
      console.warn(`[Drive Dedup] Could not check/remove duplicates for "${name}":`, dedupErr.message);
    }

    // 3. Upload from local staging file to Google Drive.
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(localFilePath),
    };

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

      const fileId = res.data.id!;
      const webViewLink = res.data.webViewLink!;

      // Make the file publicly readable
      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: { role: 'reader', type: 'anyone' },
          supportsAllDrives: true,
          supportsTeamDrives: true,
        });
      } catch (permError) {
        console.error(`[Google Drive Permissions Warning] Failed to set permissions for file ${name}:`, permError);
      }

      console.log(`[Google Drive Success] Uploaded: ${fileId}`);

      // 3. Only delete the local staging file AFTER confirmed Drive upload.
      //    If this fails, it is non-critical — the Drive copy is the source of truth.
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          console.log(`[Local Disk Cleanup] Removed staging file: ${localFilePath}`);
        }
      } catch (cleanupErr) {
        console.warn(`[Local Disk Cleanup Warning] Could not remove staging file ${localFilePath}:`, cleanupErr);
      }

      return NextResponse.json({
        success: true,
        fileId,
        webViewLink,
      });

    } catch (driveError: any) {
      // ── Google Drive Upload Failed ──────────────────────────────────────────
      // IMPORTANT: Do NOT delete the local staging file here.
      // The file remains on disk so it can be retried by the user or an automated
      // retry mechanism. The client receives driveUploadFailed: true so it can
      // surface a meaningful error and retry option instead of silently failing.
      console.error(
        `[Google Drive Error] Upload to Drive failed for "${name}". ` +
        `Local staging file preserved at: ${localFilePath}. ` +
        `Error: ${driveError?.message}`
      );

      return NextResponse.json(
        {
          success: false,
          driveUploadFailed: true,
          error: 'Failed to upload file to Google Drive. The file has been saved temporarily. Please retry the upload.',
          retryable: true,
          // Provide enough context for the client to construct a retry request
          originalFolderId: folderId,
          originalFileName: name,
          originalMimeType: mimeType,
        },
        { status: 502 }
      );
    }

  } catch (error: any) {
    // Top-level failure (e.g. could not write to disk at all)
    console.error('🔥 UPLOAD CRITICAL FAILURE:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

