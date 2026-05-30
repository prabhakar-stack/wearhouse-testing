import { execSync } from 'child_process';

// Identify the first migration folder that should be considered as already applied.
// Adjust this name if your repository has an earlier init migration.
const firstMigration = '20260601120000_drop_customerOrderId';

try {
  console.log(`🛠️  Baseline Prisma: marking "${firstMigration}" as applied`);
  execSync(`npx prisma migrate resolve --applied ${firstMigration}`, { stdio: 'inherit' });
  console.log('✅  Baseline completed.');
} catch (e) {
  console.error('❌  Baseline failed:', e.message);
  process.exit(1);
}
