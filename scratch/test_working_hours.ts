import { calculateWarehouseWorkingHours } from '../lib/timeUtils.ts';

function runTests() {
  console.log('--- WAREHOUSE WORKING HOURS UNIT TESTS ---');

  // Test Case 1: Standard daytime shift (09:00 - 18:00 = 9 hours)
  // June 1st, 2026: 08:00 to June 1st, 2026: 20:00 (Total elapsed 12 hours)
  const d1 = new Date('2026-06-01T08:00:00+05:30'); // Kolkata Time
  const d2 = new Date('2026-06-01T20:00:00+05:30');
  const res1 = calculateWarehouseWorkingHours(d1, d2, '09:00', '18:00');
  console.log(`Test 1 (Standard Shift): expected 9.0 hours, got ${res1.toFixed(1)} hours.`);

  // Test Case 2: Overnight split shift (22:00 to 06:00 = 8 hours)
  // June 1st, 22:00 to June 2nd, 06:00 (Standard overnight shift)
  const d3 = new Date('2026-06-01T22:00:00+05:30');
  const d4 = new Date('2026-06-02T06:00:00+05:30');
  const res2 = calculateWarehouseWorkingHours(d3, d4, '22:00', '06:00');
  console.log(`Test 2 (Exact Overnight Shift): expected 8.0 hours, got ${res2.toFixed(1)} hours.`);

  // Test Case 3: Partial overnight split shift intersection
  // June 1st, 18:00 to June 2nd, 02:00 (Overnight starts at 22:00, ends June 2nd 06:00)
  // Active period should only be June 1st 22:00 to June 2nd 02:00 = 4 hours!
  const d5 = new Date('2026-06-01T18:00:00+05:30');
  const d6 = new Date('2026-06-02T02:00:00+05:30');
  const res3 = calculateWarehouseWorkingHours(d5, d6, '22:00', '06:00');
  console.log(`Test 3 (Partial Overnight Intersection): expected 4.0 hours, got ${res3.toFixed(1)} hours.`);

  // Test Case 4: No config fallback (full 24-hour day)
  const res4 = calculateWarehouseWorkingHours(d3, d4, null, null);
  console.log(`Test 4 (Fallback - full day): expected 8.0 hours, got ${res4.toFixed(1)} hours.`);

  const success = 
    Math.abs(res1 - 9) < 0.01 && 
    Math.abs(res2 - 8) < 0.01 && 
    Math.abs(res3 - 4) < 0.01 && 
    Math.abs(res4 - 8) < 0.01;
  if (success) {
    console.log('\n✅ ALL TIME INTERSECTION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.log('\n❌ TESTS FAILED!');
    process.exit(1);
  }
}

runTests();
