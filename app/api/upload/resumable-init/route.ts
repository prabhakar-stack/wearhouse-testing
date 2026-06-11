import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Allow up to 30 seconds for Google OAuth + resumable session creation
export const maxDuration = 30;

/**
 * POST /api/upload/resumable-init
 *
 * Creates a Google Drive resumable upload session URL for a large file (video).
 * The client then uploads chunks directly to Google's servers using that URL —
 * no data passes through Vercel, so there are no body-size limits.
 *
 * Body: { folderId: string, name: string, mimeType: string, fileSize: number }
 * Response: { sessionUri: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderId, name, mimeType, fileSize } = body;

    if (!folderId || !name || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: 'Missing folderId, name, mimeType, or fileSize' },
        { status: 400 }
      );
    }

    // Auth with Google using OAuth2 Refresh Token credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

    // Get a fresh access token
    const { token: accessToken } = await oauth2Client.getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to obtain Google access token' }, { status: 500 });
    }

    // Initiate a resumable upload session with Google Drive API
    // https://developers.google.com/drive/api/guides/manage-uploads#resumable
    const metadata = {
      name,
      parents: [folderId],
    };

    const initResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(fileSize),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errText = await initResponse.text();
      console.error('[Resumable Init] Google Drive error:', initResponse.status, errText);
      return NextResponse.json(
        { error: `Google Drive resumable init failed: ${initResponse.status}` },
        { status: 502 }
      );
    }

    // Google returns the session URI in the 'Location' header
    const sessionUri = initResponse.headers.get('Location');
    if (!sessionUri) {
      return NextResponse.json(
        { error: 'Google Drive did not return a session URI' },
        { status: 502 }
      );
    }

    console.log(`[Resumable Init] Created session for "${name}" (${(fileSize / 1024 / 1024).toFixed(1)} MB) in folder ${folderId}`);

    return NextResponse.json({ sessionUri });
  } catch (error: any) {
    console.error('🔥 RESUMABLE INIT FAILED:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
