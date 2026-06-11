import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trackingId = searchParams.get('trackingId');
    const filename = searchParams.get('filename');

    if (!trackingId || !filename) {
      return NextResponse.json({ error: 'Missing trackingId or filename' }, { status: 400 });
    }

    const backupDir = path.join(process.cwd(), 'failed_uploads', trackingId);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filePath = path.join(backupDir, filename);
    const writeStream = fs.createWriteStream(filePath);

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

    const stats = fs.statSync(filePath);
    console.log(`[Local Backup Success] Saved file ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB) for trackingId ${trackingId}`);
    return NextResponse.json({ success: true, filename, size: stats.size });
  } catch (error: any) {
    console.error('🔥 LOCAL BACKUP FAILED:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
