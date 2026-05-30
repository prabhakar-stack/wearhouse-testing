import 'dotenv/config';
import { runExpectedTrackingJob } from '../lib/cron.ts';

async function runOnce() {
  console.log('🔄 Aegis System: Starting Manual Tracking Job Execution...');
  try {
    const result = await runExpectedTrackingJob();
    console.log('✅ Manual Tracking Job Execution Success!');
    console.log(JSON.stringify({
      refreshedCount: result.refreshedCount,
      skippedCount: result.skippedCount,
      errorsCount: result.errors?.length || 0,
      errors: result.errors
    }, null, 2));
  } catch (err: any) {
    console.error('❌ Tracking Job Execution Failed:', err.message || err);
    process.exit(1);
  }
}

runOnce();
