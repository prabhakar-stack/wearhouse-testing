import { calculateWarehouseWorkingHours } from '../lib/timeUtils.ts';
import { ALERT_RULE_BY_TYPE } from '../lib/alertRules.ts';

// Mock system config hours
const startTimeStr = "10:00";
const endTimeStr = "18:00";
const timeZone = "Asia/Kolkata";

function testAlerts() {
  console.log('🧪 Testing working hours trigger calculations for all 11 alerts...');

  // Setup current time (e.g. Wednesday at 14:00)
  const now = new Date("2026-06-03T14:00:00+05:30"); // Wednesday 2:00 PM IST

  console.log(`\n--- PART 1: DELIVERY ETA BREACH (Alerts 1-3) ---`);
  // Target baseline: Return Date + 5 calendar days.
  // Case A: 48 working hours overdue
  // A breach of 48 working hours (6 days at 8 hrs/day) means the ETA was 6 working days ago.
  // Let's verify by calculating hours overdue:
  const etaDate48h = new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000)); // 6 calendar days ago
  const hoursOverdue48h = calculateWarehouseWorkingHours(etaDate48h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 1 (48h) Check -> Overdue working hours calculated: ${hoursOverdue48h} hrs`);
  console.log(`Should trigger DELIVERY_ETA_BREACH_48H: ${hoursOverdue48h >= 48 && hoursOverdue48h < 72 ? '✅ Yes' : '❌ No'}`);

  // Case B: 72 working hours overdue (9 working days ago)
  const etaDate72h = new Date(now.getTime() - (9 * 24 * 60 * 60 * 1000));
  const hoursOverdue72h = calculateWarehouseWorkingHours(etaDate72h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 2 (72h) Check -> Overdue working hours calculated: ${hoursOverdue72h} hrs`);
  console.log(`Should trigger DELIVERY_ETA_BREACH_72H: ${hoursOverdue72h >= 72 && hoursOverdue72h < 96 ? '✅ Yes' : '❌ No'}`);

  // Case C: 96 working hours overdue (12 working days ago)
  const etaDate96h = new Date(now.getTime() - (12 * 24 * 60 * 60 * 1000));
  const hoursOverdue96h = calculateWarehouseWorkingHours(etaDate96h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 3 (96h) Check -> Overdue working hours calculated: ${hoursOverdue96h} hrs`);
  console.log(`Should trigger DELIVERY_ETA_BREACH_96H: ${hoursOverdue96h >= 96 ? '✅ Yes' : '❌ No'}`);


  console.log(`\n--- PART 2: GHOST DELIVERY TYPE 1 (Alerts 4-6) ---`);
  // Case A: 6 working hours since courier marked delivered
  const deliveryDate6h = new Date(now.getTime() - (6 * 60 * 60 * 1000)); // 6 working hours ago on same day
  const hoursSinceDelivery6h = calculateWarehouseWorkingHours(deliveryDate6h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 4 (6h) Check -> Hours since courier delivery: ${hoursSinceDelivery6h} hrs`);
  console.log(`Should trigger GHOST_DELIVERY_T1_6H: ${hoursSinceDelivery6h >= 6 && hoursSinceDelivery6h < 12 ? '✅ Yes' : '❌ No'}`);

  // Case B: 12 working hours since delivery (1.5 working days ago)
  const deliveryDate12h = new Date(now.getTime() - (1.5 * 24 * 60 * 60 * 1000));
  const hoursSinceDelivery12h = calculateWarehouseWorkingHours(deliveryDate12h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 5 (12h) Check -> Hours since courier delivery: ${hoursSinceDelivery12h} hrs`);
  console.log(`Should trigger GHOST_DELIVERY_T1_12H: ${hoursSinceDelivery12h >= 12 && hoursSinceDelivery12h < 24 ? '✅ Yes' : '❌ No'}`);

  // Case C: 24 working hours since delivery (3 working days ago)
  const deliveryDate24h = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
  const hoursSinceDelivery24h = calculateWarehouseWorkingHours(deliveryDate24h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 6 (24h) Check -> Hours since courier delivery: ${hoursSinceDelivery24h} hrs`);
  console.log(`Should trigger GHOST_DELIVERY_T1_24H: ${hoursSinceDelivery24h >= 24 ? '✅ Yes' : '❌ No'}`);


  console.log(`\n--- PART 3: GHOST DELIVERY TYPE 2 (Alerts 7-9) ---`);
  // Case A: 6 working hours since Receiver QC Rejection evidence was logged
  const rejectionDate6h = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  const hoursSinceRejection6h = calculateWarehouseWorkingHours(rejectionDate6h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 7 (6h) Check -> Hours since receiver rejection: ${hoursSinceRejection6h} hrs`);
  console.log(`Should trigger GHOST_DELIVERY_T2_6H: ${hoursSinceRejection6h >= 6 && hoursSinceRejection6h < 12 ? '✅ Yes' : '❌ No'}`);

  // Case B: 12 working hours since receiver rejection
  const rejectionDate12h = new Date(now.getTime() - (1.5 * 24 * 60 * 60 * 1000));
  const hoursSinceRejection12h = calculateWarehouseWorkingHours(rejectionDate12h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 8 (12h) Check -> Hours since receiver rejection: ${hoursSinceRejection12h} hrs`);
  console.log(`Should trigger GHOST_DELIVERY_T2_12H: ${hoursSinceRejection12h >= 12 && hoursSinceRejection12h < 24 ? '✅ Yes' : '❌ No'}`);

  // Case C: 24 working hours since receiver rejection
  const rejectionDate24h = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
  const hoursSinceRejection24h = calculateWarehouseWorkingHours(rejectionDate24h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 9 (24h) Check -> Hours since receiver rejection: ${hoursSinceRejection24h} hrs`);
  console.log(`Should trigger GHOST_DELIVERY_T2_24H: ${hoursSinceRejection24h >= 24 ? '✅ Yes' : '❌ No'}`);


  console.log(`\n--- PART 4: RECEIVE UPDATE PENDING (Alerts 10-11) ---`);
  // Case A: 2 working hours since Receiver QC check
  const qcCheckDate2h = new Date(now.getTime() - (2 * 60 * 60 * 1000)); // 2 working hours ago on same day
  const hoursSinceQC2h = calculateWarehouseWorkingHours(qcCheckDate2h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 10 (2h) Check -> Hours since receiver QC check: ${hoursSinceQC2h} hrs`);
  console.log(`Should trigger RECEIVE_UPDATE_PENDING_2H: ${hoursSinceQC2h >= 2 && hoursSinceQC2h < 6 ? '✅ Yes' : '❌ No'}`);

  // Case B: 6 working hours since Receiver QC check
  const qcCheckDate6h = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  const hoursSinceQC6h = calculateWarehouseWorkingHours(qcCheckDate6h, now, startTimeStr, endTimeStr, timeZone);
  console.log(`Alert 11 (6h) Check -> Hours since receiver QC check: ${hoursSinceQC6h} hrs`);
  console.log(`Should trigger RECEIVE_UPDATE_PENDING_6H: ${hoursSinceQC6h >= 6 ? '✅ Yes' : '❌ No'}`);
}

testAlerts();
