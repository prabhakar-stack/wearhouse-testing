"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var timeUtils_1 = require("../lib/timeUtils");
// Mock system config hours
var startTimeStr = "10:00";
var endTimeStr = "18:00";
var timeZone = "Asia/Kolkata";
function testAlerts() {
    console.log('🧪 Testing working hours trigger calculations for all 9 alerts...');
    // Setup current time (e.g. Wednesday at 14:00)
    var now = new Date("2026-06-03T14:00:00+05:30"); // Wednesday 2:00 PM IST
    console.log("\n--- PART 1: DELIVERY ETA BREACH (Alerts 1-3) ---");
    // Target baseline: Return Date + 5 calendar days.
    // Case A: 48 working hours overdue
    // A breach of 48 working hours (6 days at 8 hrs/day) means the ETA was 6 working days ago.
    // Let's verify by calculating hours overdue:
    var etaDate48h = new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000)); // 6 calendar days ago
    var hoursOverdue48h = (0, timeUtils_1.calculateWarehouseWorkingHours)(etaDate48h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 1 (48h) Check -> Overdue working hours calculated: ".concat(hoursOverdue48h, " hrs"));
    console.log("Should trigger DELIVERY_ETA_BREACH_48H: ".concat(hoursOverdue48h >= 48 && hoursOverdue48h < 72 ? '✅ Yes' : '❌ No'));
    // Case B: 72 working hours overdue (9 working days ago)
    var etaDate72h = new Date(now.getTime() - (9 * 24 * 60 * 60 * 1000));
    var hoursOverdue72h = (0, timeUtils_1.calculateWarehouseWorkingHours)(etaDate72h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 2 (72h) Check -> Overdue working hours calculated: ".concat(hoursOverdue72h, " hrs"));
    console.log("Should trigger DELIVERY_ETA_BREACH_72H: ".concat(hoursOverdue72h >= 72 && hoursOverdue72h < 96 ? '✅ Yes' : '❌ No'));
    // Case C: 96 working hours overdue (12 working days ago)
    var etaDate96h = new Date(now.getTime() - (12 * 24 * 60 * 60 * 1000));
    var hoursOverdue96h = (0, timeUtils_1.calculateWarehouseWorkingHours)(etaDate96h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 3 (96h) Check -> Overdue working hours calculated: ".concat(hoursOverdue96h, " hrs"));
    console.log("Should trigger DELIVERY_ETA_BREACH_96H: ".concat(hoursOverdue96h >= 96 ? '✅ Yes' : '❌ No'));
    console.log("\n--- PART 2: GHOST DELIVERY TYPE 1 (Alerts 4-6) ---");
    // Case A: 6 working hours since courier marked delivered
    var deliveryDate6h = new Date(now.getTime() - (6 * 60 * 60 * 1000)); // 6 working hours ago on same day
    var hoursSinceDelivery6h = (0, timeUtils_1.calculateWarehouseWorkingHours)(deliveryDate6h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 4 (6h) Check -> Hours since courier delivery: ".concat(hoursSinceDelivery6h, " hrs"));
    console.log("Should trigger GHOST_DELIVERY_T1_6H: ".concat(hoursSinceDelivery6h >= 6 && hoursSinceDelivery6h < 12 ? '✅ Yes' : '❌ No'));
    // Case B: 12 working hours since delivery (1.5 working days ago)
    var deliveryDate12h = new Date(now.getTime() - (1.5 * 24 * 60 * 60 * 1000));
    var hoursSinceDelivery12h = (0, timeUtils_1.calculateWarehouseWorkingHours)(deliveryDate12h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 5 (12h) Check -> Hours since courier delivery: ".concat(hoursSinceDelivery12h, " hrs"));
    console.log("Should trigger GHOST_DELIVERY_T1_12H: ".concat(hoursSinceDelivery12h >= 12 && hoursSinceDelivery12h < 24 ? '✅ Yes' : '❌ No'));
    // Case C: 24 working hours since delivery (3 working days ago)
    var deliveryDate24h = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    var hoursSinceDelivery24h = (0, timeUtils_1.calculateWarehouseWorkingHours)(deliveryDate24h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 6 (24h) Check -> Hours since courier delivery: ".concat(hoursSinceDelivery24h, " hrs"));
    console.log("Should trigger GHOST_DELIVERY_T1_24H: ".concat(hoursSinceDelivery24h >= 24 ? '✅ Yes' : '❌ No'));
    console.log("\n--- PART 3: GHOST DELIVERY TYPE 2 (Alerts 7-9) ---");
    // Case A: 6 working hours since Receiver QC Rejection evidence was logged
    var rejectionDate6h = new Date(now.getTime() - (6 * 60 * 60 * 1000));
    var hoursSinceRejection6h = (0, timeUtils_1.calculateWarehouseWorkingHours)(rejectionDate6h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 7 (6h) Check -> Hours since receiver rejection: ".concat(hoursSinceRejection6h, " hrs"));
    console.log("Should trigger GHOST_DELIVERY_T2_6H: ".concat(hoursSinceRejection6h >= 6 && hoursSinceRejection6h < 12 ? '✅ Yes' : '❌ No'));
    // Case B: 12 working hours since receiver rejection
    var rejectionDate12h = new Date(now.getTime() - (1.5 * 24 * 60 * 60 * 1000));
    var hoursSinceRejection12h = (0, timeUtils_1.calculateWarehouseWorkingHours)(rejectionDate12h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 8 (12h) Check -> Hours since receiver rejection: ".concat(hoursSinceRejection12h, " hrs"));
    console.log("Should trigger GHOST_DELIVERY_T2_12H: ".concat(hoursSinceRejection12h >= 12 && hoursSinceRejection12h < 24 ? '✅ Yes' : '❌ No'));
    // Case C: 24 working hours since receiver rejection
    var rejectionDate24h = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    var hoursSinceRejection24h = (0, timeUtils_1.calculateWarehouseWorkingHours)(rejectionDate24h, now, startTimeStr, endTimeStr, timeZone);
    console.log("Alert 9 (24h) Check -> Hours since receiver rejection: ".concat(hoursSinceRejection24h, " hrs"));
    console.log("Should trigger GHOST_DELIVERY_T2_24H: ".concat(hoursSinceRejection24h >= 24 ? '✅ Yes' : '❌ No'));
}
testAlerts();
