import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Allow up to 5 minutes for a chunk write on deployed serverless environments.
// On local dev this is ignored; locally there is no serverless timeout.
export const maxDuration = 300;

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uploadId   = searchParams.get('uploadId');
    const chunkIndex = searchParams.get('chunkIndex');
    const name       = searchParams.get('name');

    if (!uploadId || chunkIndex === null || !name) {
      return NextResponse.json({ error: 'Missing uploadId, chunkIndex, or name' }, { status: 400 });
    }

    const idx = parseInt(chunkIndex, 10);
    if (isNaN(idx) || idx < 0) {
      return NextResponse.json({ error: 'Invalid chunkIndex' }, { status: 400 });
    }

    // Ensure temp chunk directory exists: uploads/chunks/<uploadId>/
    const chunksDir = path.join(process.cwd(), 'uploads', 'chunks', uploadId);
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    const partFilePath = path.join(chunksDir, `${idx}.part`);
    const writeStream  = fs.createWriteStream(partFilePath);

    // Stream the chunk body directly to disk — no in-memory buffering
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

    const stats = fs.statSync(partFilePath);
    console.log(`[Chunk Upload] Received chunk ${idx} for uploadId=${uploadId} (${(stats.size / 1024).toFixed(1)} KB) → ${partFilePath}`);

    return NextResponse.json({ received: idx, size: stats.size });
  } catch (error: any) {
    console.error('🔥 CHUNK UPLOAD FAILED:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
