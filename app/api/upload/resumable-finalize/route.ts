import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Allow up to 30 seconds for Google OAuth + permissions
export const maxDuration = 30;

/**
 * POST /api/upload/resumable-finalize
 *
 * After the client completes a resumable upload directly to Google Drive,
 * call this endpoint to:
 *  1. Set the file as publicly readable (reader / anyone)
 *  2. Return the webViewLink for the uploaded file
 *
 * Body: { fileId: string }
 * Response: { webViewLink: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    // Auth with Google using OAuth2 Refresh Token credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Set publicly readable
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });
    } catch (permErr) {
      console.warn(`[Resumable Finalize] Could not set Drive permissions for ${fileId}:`, permErr);
    }

    // Get the webViewLink
    const fileRes = await drive.files.get({
      fileId,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const webViewLink = fileRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    console.log(`[Resumable Finalize] File ${fileId} set as public. webViewLink: ${webViewLink}`);

    return NextResponse.json({ success: true, webViewLink });
  } catch (error: any) {
    console.error('🔥 RESUMABLE FINALIZE FAILED:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
