import { spawn } from 'child_process';
import path from 'path';

export async function runSync(): Promise<void> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_returns_to_supabase.js');

  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      env: process.env,
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Amazon sync script exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}
