import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Allow up to 30 seconds for Google OAuth + file lookup + permissions
export const maxDuration = 30;

/**
 * POST /api/upload/resumable-finalize-by-name
 *
 * After the client completes a resumable upload directly to Google Drive,
 * call this endpoint to:
 *  1. Locate the file by name in the given folder
 *  2. Set the file as publicly readable (reader / anyone)
 *  3. Return the webViewLink for the uploaded file
 *
 * Body: { folderId: string, name: string }
 * Response: { webViewLink: string, fileId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderId, name } = body;

    if (!folderId || !name) {
      return NextResponse.json({ error: 'Missing folderId or name' }, { status: 400 });
    }

    // Auth with Google using OAuth2 Refresh Token credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Find the recently uploaded file by name in the folder
    // Use orderBy createdTime desc to get the most recent one (in case of duplicates)
    const listRes = await drive.files.list({
      q: `name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'createdTime desc',
    });

    const files = listRes.data.files || [];
    if (files.length === 0) {
      console.warn(`[Resumable Finalize] File "${name}" not found in folder ${folderId} — upload may still be in progress`);
      return NextResponse.json({
        success: true,
        webViewLink: `https://drive.google.com/drive/folders/${folderId}`,
        fileId: null,
        warning: 'File not found yet — permissions not set',
      });
    }

    const file = files[0];
    const fileId = file.id!;

    // Set publicly readable
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });
      console.log(`[Resumable Finalize] Set public permissions on file ${fileId} ("${name}")`);
    } catch (permErr) {
      console.warn(`[Resumable Finalize] Could not set Drive permissions for ${fileId}:`, permErr);
    }

    const webViewLink = file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    console.log(`[Resumable Finalize] Complete for "${name}". webViewLink: ${webViewLink}`);

    return NextResponse.json({ success: true, webViewLink, fileId });
  } catch (error: any) {
    console.error('🔥 RESUMABLE FINALIZE BY NAME FAILED:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
