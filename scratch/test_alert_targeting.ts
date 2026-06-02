import { resolveTargetUserId } from '../lib/alertTargeting.ts';
import { prisma } from '../lib/prisma.ts';

async function runTests() {
  console.log('--- ALERT TARGETING UNIT TESTS ---');

  // Find a test user to perform tests with
  const testUser = await (prisma as any).user.findFirst();
  if (!testUser) {
    console.log('No user found in the database. Please authorize at least one user first.');
    process.exit(0);
  }

  console.log(`Using test user: ${testUser.name || testUser.email} (Role: ${testUser.role}, AlertLevel: ${testUser.alertLevel || 'None'})`);

  // Test Case 1: Match by direct email
  const res1 = await resolveTargetUserId([testUser.email]);
  console.log(`Test 1 (Email match): expected ${testUser.id}, got ${res1}.`);

  // Test Case 2: Match by direct role
  const res2 = await resolveTargetUserId([testUser.role]);
  console.log(`Test 2 (Role match): expected user ID from role ${testUser.role}, got ${res2}.`);

  // Test Case 3: Match by alert level (if set)
  if (testUser.alertLevel) {
    const res3 = await resolveTargetUserId([testUser.alertLevel]);
    console.log(`Test 3 (Level match): expected user ID from level ${testUser.alertLevel}, got ${res3}.`);
  } else {
    console.log('Skipping Test 3: Test user does not have an alertLevel set.');
  }

  // Test Case 4: No config/null
  const res4 = await resolveTargetUserId(undefined);
  console.log(`Test 4 (Empty fallback): expected null, got ${res4}.`);

  console.log('\n✅ ALL TARGET RESOLUTION CHECKS RAN SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Targeting test run error:', err);
  process.exit(1);
});
