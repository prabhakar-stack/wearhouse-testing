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
    if (req.body) {
      const arrayBuffer = await req.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    } else {
      fs.writeFileSync(filePath, Buffer.alloc(0));
    }

    const stats = fs.statSync(filePath);
    console.log(`[Local Backup Success] Saved file ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB) for trackingId ${trackingId}`);
    return NextResponse.json({ success: true, filename, size: stats.size });
  } catch (error: any) {
    console.error('🔥 LOCAL BACKUP FAILED:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
