/**
 * Alert Map Seed Script
 * ─────────────────────────────────────────────────────────────────
 * Seeds all warehouse alert types from the PRD into AlertSopStep.
 * Each type maps to a level, trigger condition, action, and SOP steps.
 *
 * Level definitions:
 *   L1 (Low)      → Small delay or staff dispute          → In-app notification
 *   L2 (Medium)   → 60 min inactivity / failed QC         → Email/Push alert to Admin
 *   L3 (High)     → Items missing from sealed box          → Large warning banner on Admin dashboard
 *   L4 (Critical) → Delivered but no warehouse record      → Automated phone call + WhatsApp to leadership
 *
 * Run: npx ts-node scripts/seed-alerts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALERT_MAP = [
  // ─── L1: Low — In-app notification ───────────────────────────────────────────
  {
    type: 'SCAN_NOT_DELIVERED',
    level: 'L1',
    trigger: 'Has scan log but not marked as delivered — could be intentional or accidental.',
    action: 'In-app notification to Receiver. Escalates to L2 (Admin email) if not resolved within 60 min.',
    sop: [
      'Check the scan log for the AWB in question.',
      'Confirm with the Receiver on duty whether the parcel was physically handed over.',
      'If the parcel is on the dock, mark it delivered via the system.',
      'If it cannot be located, escalate to L2 and notify Admin.',
    ],
  },
  {
    type: 'HANDSHAKE_MISSED',
    level: 'L1',
    trigger: 'Receiver-to-Inspector handshake was not completed within the expected window.',
    action: 'In-app notification to Receiver. Escalates to L2 if not resolved.',
    sop: [
      'Check if the Receiver and Inspector are both active.',
      'Remind both parties to complete the handshake in the app.',
      'If the Inspector is unavailable, Admin should reassign the inspection.',
      'Log any delays with a reason code.',
    ],
  },
  {
    type: 'INSPECTION_INACTIVITY',
    level: 'L1',
    trigger: 'Inspector has not scanned or logged any activity for more than N hours.',
    action: 'In-app notification to Inspector. Admin is alerted if still inactive after 30 min.',
    sop: [
      'Contact the Inspector directly via in-app message.',
      'Check if the Inspector is still on shift.',
      'If unresponsive, Admin can choose to dismiss the alert or reassign pending inspections.',
      'Log the inactivity event in the activity log.',
    ],
  },
  {
    type: 'STAFF_DISPUTE',
    level: 'L1',
    trigger: 'Dispute flag raised between two staff members during handshake or handoff.',
    action: 'In-app notification to both parties and their direct supervisor.',
    sop: [
      'Review the event log for both users around the time of the dispute.',
      'Contact both parties to understand the issue.',
      'Resolve the dispute and log the outcome.',
      'If unresolved, escalate to Admin (L2).',
    ],
  },

  // ─── L2: Medium — Email/Push alert to Admin ──────────────────────────────────
  {
    type: 'RECEIVER_INACTIVE',
    level: 'L2',
    trigger: 'Receiver not active by 10:00 AM. Expected deliveries have no one to receive them.',
    action: 'Email/Push alert to Admin. Pending orders are automatically assigned to Admin for handover to Inspector.',
    sop: [
      'Confirm if the Receiver is on leave or sick — check shift schedule.',
      'If unplanned absence, Admin takes ownership of all expected deliveries for the day.',
      'Complete the handover to Inspector on behalf of the Receiver.',
      'Log the event and update shift records.',
    ],
  },
  {
    type: 'SLA_BREACH',
    level: 'L2',
    trigger: 'Package ETA has passed and the parcel has not been received or acknowledged.',
    action: 'Email/Push alert to Admin.',
    sop: [
      'Check the courier tracking portal for the latest delivery status.',
      'Contact the courier helpline to get an updated ETA.',
      'If the courier confirms delivery, check the dock physically.',
      'Raise a dispute with the courier if parcel is unaccounted for.',
    ],
  },
  {
    type: 'QC_FAIL_DAMAGED',
    level: 'L2',
    trigger: 'Receiver took proof image of damaged parcel and refused acceptance. Delivery not accepted.',
    action: 'Email/Push alert to Admin with evidence image attached.',
    sop: [
      'Review the photographic evidence submitted by the Receiver.',
      'Contact the courier to raise a damage claim.',
      'Do not enable the Accept button until Admin reviews.',
      'Log the incident and assign a claim specialist if required.',
    ],
  },
  {
    type: 'INSPECTION_OVERDUE',
    level: 'L2',
    trigger: 'Inspector inactive or inspection not started within the allowed time window after handover.',
    action: 'Email/Push alert to Admin.',
    sop: [
      'Check if the Inspector completed the handshake with the Receiver.',
      'Confirm if the items are securely stored in the designated bin.',
      'Reassign inspection to an available Inspector or handle next day per policy.',
      'Log the delay with a reason code.',
    ],
  },
  {
    type: 'CLAIM_STALLED',
    level: 'L2',
    trigger: 'Claim has not been filed within the allowed SLA window after an inspection defect was found.',
    action: 'Email/Push alert to Admin and Claims Specialist.',
    sop: [
      'Review the inspection record and the identified defect.',
      'Ensure all required evidence (images, videos) is uploaded.',
      'File the claim on the marketplace portal (Amazon/Shopify).',
      'Update the claim status in the system.',
    ],
  },

  // ─── L3: High — Warning banner on Admin dashboard ────────────────────────────
  {
    type: 'MISSING_ITEMS',
    level: 'L3',
    trigger: 'Inspector found a count mismatch — items missing from a sealed mechanical box.',
    action: 'Large warning banner on Admin dashboard. Admin must decide escalation path.',
    sop: [
      'Review the video evidence of the count during inspection.',
      'Cross-reference expected item count with the purchase order.',
      'Raise a missing items claim on the marketplace portal.',
      'Mark affected ReturnItems as MISSING in the system.',
      'If courier is suspected, file a carrier damage claim.',
    ],
  },
  {
    type: 'PRODUCT_DAMAGED_BAD',
    level: 'L3',
    trigger: 'Inspector graded the product as BAD/PRODUCT_DAMAGED — potentially refurbishable or total loss.',
    action: 'Large warning banner on Admin dashboard. Claim must be raised.',
    sop: [
      'Confirm the Inspector defect type (WAREHOUSE_DAMAGE, CARRIER_DAMAGE, etc.).',
      'Ensure 6-side box images and product images are uploaded.',
      'Mark the ReturnItem condition as PRODUCT_DAMAGED in the system.',
      'Raise the appropriate claim on the marketplace portal.',
      'If fake/counterfeit, mark as FAKE_COUNTERFEIT and notify compliance.',
    ],
  },
  {
    type: 'QC_FAIL_NON_OTP',
    level: 'L3',
    trigger: 'Courier shows delivered status, non-OTP order, QC checks failed — item shows as delivered but receiver has concerns.',
    action: 'Large warning banner on Admin dashboard. Admin decides escalation level.',
    sop: [
      'Review all QC checkpoint results from the Receiver.',
      'Check tape integrity, box condition, and any damage markers.',
      'If any checkpoint fails, do not force acceptance.',
      'Raise a claim with evidence against the courier.',
      'If items are found acceptable after review, Admin can override and mark accepted.',
    ],
  },

  // ─── L4: Critical — Automated phone calls + WhatsApp to leadership ───────────
  {
    type: 'GHOST_DELIVERY',
    level: 'L4',
    trigger: 'Courier portal says "Delivered" but there is no scan log and no record in the warehouse system.',
    action: 'Direct L4 escalation: Automated phone call + WhatsApp to leadership. No intermediate steps.',
    sop: [
      'IMMEDIATE: Verify courier tracking — screenshot and log the delivery confirmation.',
      'Check all warehouse dock cameras for the expected delivery window.',
      'Contact the courier company\'s escalation desk — not standard helpline.',
      'Check with all on-duty staff if anyone received the parcel informally.',
      'If parcel is confirmed unaccounted for, raise a police report and file a carrier theft claim.',
      'Leadership must approve all actions from this point onward.',
      'Do not resolve this alert without SUPER_ACCESS sign-off.',
    ],
  },
];

async function main() {
  console.log('🌱 Seeding alert map...\n');

  // Clear existing SOP steps to avoid duplicates on re-run
  await prisma.alertSopStep.deleteMany({
    where: { alertType: { in: ALERT_MAP.map(a => a.type) } }
  });

  for (const alert of ALERT_MAP) {
    // Upsert SOP steps
    for (let i = 0; i < alert.sop.length; i++) {
      await prisma.alertSopStep.create({
        data: {
          alertType: alert.type,
          stepOrder: i + 1,
          instruction: alert.sop[i],
        }
      });
    }
    console.log(`✅ [${alert.level}] ${alert.type} — ${alert.sop.length} SOP steps seeded`);
  }

  console.log(`\n📋 Alert Map Summary:`);
  console.log(`  L1 (Low — In-app):          ${ALERT_MAP.filter(a => a.level === 'L1').length} types`);
  console.log(`  L2 (Medium — Email/Push):   ${ALERT_MAP.filter(a => a.level === 'L2').length} types`);
  console.log(`  L3 (High — Banner):         ${ALERT_MAP.filter(a => a.level === 'L3').length} types`);
  console.log(`  L4 (Critical — Phone/WA):   ${ALERT_MAP.filter(a => a.level === 'L4').length} types`);
  console.log(`\n✨ Done. Total: ${ALERT_MAP.length} alert types seeded.`);
  console.log('\n💡 Tip: Remove or rename any alert type in /scripts/seed-alerts.ts and re-run to update.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
