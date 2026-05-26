/**
 * Central Alert Rules Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * All 42 alert rule definitions for the warehouse returns management system.
 * Column 1 (implementation status) is intentionally omitted — all rules here
 * are documented specs pending cron/trigger implementation.
 *
 * LEVELS:
 *   L1 → In-app nudge only (dashboard + hangout)
 *   L2 → Dashboard nudge + Email escalation (new thread)
 *   L3 → Dashboard nudge + Email escalation (existing thread) [currently same delivery as L2 — to be reviewed]
 *   L4 → All of the above + Escalation to Sunil Deshmukh, Harsh Jain, Super-Access
 *
 * TARGET ROLES:
 *   admin, RECEIVER, INSPECTOR, RECOVERY, QC, super-access
 */

export type AlertLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type NotificationChannel = 'dashboard' | 'hangout' | 'email' | 'email_existing_thread';

export interface AlertRule {
  /** Unique key used as the `type` field in the Alert model */
  type: string;
  /** Human-readable case group */
  case: string;
  /** Detailed triggering condition */
  subCase: string;
  level: AlertLevel;
  /** Short title shown on the alert card */
  title: string;
  /** Detailed description template (may reference manifest/tracking data at runtime) */
  description: string;
  /** Who receives this alert */
  targetRoles: string[];
  /** Named leaders escalated for L4 alerts */
  escalateToLeaders?: string[];
  /** Notification delivery channels */
  channels: NotificationChannel[];
  /** SOP resolution steps shown to the person resolving the alert */
  sopSteps: string[];
  /** Time-based threshold in hours that triggers this rule (null = real-time event) */
  thresholdHours: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT RULES
// ─────────────────────────────────────────────────────────────────────────────

export const ALERT_RULES: AlertRule[] = [

  // ── 1. DELIVERY ETA BREACH ─────────────────────────────────────────────────

  {
    type: 'DELIVERY_ETA_BREACH_48H',
    case: 'Delivery ETA breach',
    subCase: '(Date of order + 5 Days) + Breach by 48 hours',
    level: 'L2',
    title: 'Delivery ETA Breach — 48 Hour Overdue',
    description: 'Package {trackingId} is 48 hours past its expected delivery date (Order date + 5 days). Immediate follow-up with the courier is required.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'email'],
    thresholdHours: 48,
    sopSteps: [
      'Check the courier tracking portal for the latest scan event.',
      'Contact the assigned courier account manager to request a status update.',
      'Log the response in the manifest notes.',
      'If no update within 4 hours, escalate to L3.',
    ],
  },
  {
    type: 'DELIVERY_ETA_BREACH_72H',
    case: 'Delivery ETA breach',
    subCase: '(Date of order + 5 Days) + Breach by 72 hours',
    level: 'L3',
    title: 'Delivery ETA Breach — 72 Hour Overdue',
    description: 'Package {trackingId} is 72 hours past its expected delivery date (Order date + 5 days). Escalation mail has been sent in the existing thread.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 72,
    sopSteps: [
      'Review the existing mail thread for prior escalation responses.',
      'Reply to the existing email thread requesting a firm delivery commitment.',
      'Check if a courier claim for late delivery is applicable.',
      'If no commitment received in 12 hours, escalate to L4.',
    ],
  },
  {
    type: 'DELIVERY_ETA_BREACH_96H',
    case: 'Delivery ETA breach',
    subCase: '(Date of order + 5 Days) + Breach by 96 hours',
    level: 'L4',
    title: 'Delivery ETA Breach — 96 Hour Overdue (CRITICAL)',
    description: 'Package {trackingId} is 96 hours past its expected delivery date. Leadership has been notified. Immediate resolution required.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 96,
    sopSteps: [
      'Immediately contact the courier\'s senior escalation desk.',
      'Initiate a formal lost-in-transit inquiry with the carrier.',
      'Inform Sunil Deshmukh and Harsh Jain of the current status.',
      'If confirmed lost, file an FBA inbound lost claim with Amazon.',
      'Mark the manifest as LOST_IN_TRANSIT once courier confirms.',
    ],
  },

  // ── 2. MARKED DELIVERED INCORRECTLY — TYPE 1 (No receiver scan) ────────────

  {
    type: 'GHOST_DELIVERY_T1_6H',
    case: 'Marked delivered incorrectly (Type 1)',
    subCase: 'No logs of scan by Receiver + Shipment marked delivered by the delivery partner + No claim created within 6 hours',
    level: 'L2',
    title: 'Ghost Delivery (Type 1) — No Receiver Scan, 6h Without Claim',
    description: 'Package {trackingId} was marked delivered by the courier but has no receiver scan logs. No claim has been raised within 6 hours of the delivery mark.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'email'],
    thresholdHours: 6,
    sopSteps: [
      'Check the courier\'s delivery proof-of-delivery (POD) photograph.',
      'Search the dock area physically for any unscanned packages.',
      'Confirm with the on-duty receiver if the package arrived but was not scanned.',
      'If package is missing, initiate a formal courier inquiry.',
    ],
  },
  {
    type: 'GHOST_DELIVERY_T1_12H',
    case: 'Marked delivered incorrectly (Type 1)',
    subCase: 'No logs of scan by Receiver + Shipment marked delivered by the delivery partner + No claim created within 12 hours',
    level: 'L3',
    title: 'Ghost Delivery (Type 1) — No Receiver Scan, 12h Without Claim',
    description: 'Package {trackingId} marked delivered by courier with no receiver scan. Claim still not raised after 12 hours.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      'Review the existing email thread for prior updates.',
      'Escalate inquiry to the courier\'s regional operations team.',
      'Collect all evidence: POD photo, door camera footage, receiver logs.',
      'Begin drafting a formal claim against the courier for non-delivery.',
    ],
  },
  {
    type: 'GHOST_DELIVERY_T1_24H',
    case: 'Marked delivered incorrectly (Type 1)',
    subCase: 'No logs of scan by Receiver + Shipment marked delivered by the delivery partner + No claim created within 24 hours',
    level: 'L4',
    title: 'Ghost Delivery (Type 1) — CRITICAL: 24h Without Claim',
    description: 'Package {trackingId} marked delivered by courier with no receiver scan. No claim raised in 24 hours. Leadership escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      'File a formal lost inbound claim with Amazon FBA immediately.',
      'Attach all collected evidence to the claim.',
      'Notify Sunil Deshmukh and Harsh Jain of the filed claim reference.',
      'Mark the manifest as LOST_IN_TRANSIT.',
      'Follow up with the courier for reimbursement against the delivery.',
    ],
  },

  // ── 3. MARKED DELIVERED INCORRECTLY — TYPE 2 (QC failed by Receiver) ───────

  {
    type: 'GHOST_DELIVERY_T2_6H',
    case: 'Marked delivered incorrectly (Type 2)',
    subCase: 'Package QC failed by Receiver + Shipment marked delivered / undelivered + No claim created within 6 hours',
    level: 'L2',
    title: 'Ghost Delivery (Type 2) — Receiver QC Failed, 6h Without Claim',
    description: 'Package {trackingId} QC failed by receiver. Marked delivered/undelivered by the courier. No claim raised within 6 hours.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'email'],
    thresholdHours: 6,
    sopSteps: [
      'Review the receiver\'s QC rejection reason and photos.',
      'Verify the courier\'s delivery/non-delivery status on their portal.',
      'Contact the courier to reconcile the status discrepancy.',
      'Prepare claim documentation based on the QC failure evidence.',
    ],
  },
  {
    type: 'GHOST_DELIVERY_T2_12H',
    case: 'Marked delivered incorrectly (Type 2)',
    subCase: 'Package QC failed by Receiver + Shipment marked delivered / undelivered + No claim created within 12 hours',
    level: 'L3',
    title: 'Ghost Delivery (Type 2) — Receiver QC Failed, 12h Without Claim',
    description: 'Package {trackingId} QC failed by receiver. No claim raised within 12 hours. Escalation in existing thread.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      'Reply in the existing email thread with QC failure documentation.',
      'File a freight damage or QC-failure return claim with the carrier.',
      'Confirm claim eligibility with the Amazon IDR portal.',
    ],
  },
  {
    type: 'GHOST_DELIVERY_T2_24H',
    case: 'Marked delivered incorrectly (Type 2)',
    subCase: 'Package QC failed by Receiver + Shipment marked delivered / undelivered + No claim created within 24 hours',
    level: 'L4',
    title: 'Ghost Delivery (Type 2) — CRITICAL: 24h Without Claim',
    description: 'Package {trackingId} QC failed by receiver. No claim raised in 24 hours. Leadership escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      'File the freight damage claim immediately with full QC evidence.',
      'Submit an Amazon FBA warehouse damage claim if applicable.',
      'Notify Sunil Deshmukh and Harsh Jain with the claim reference number.',
      'Mark the manifest appropriately and log the claim ID.',
    ],
  },

  // ── 4. RECEIVE UPDATE PENDING ────────────────────────────────────────────────

  {
    type: 'RECEIVE_UPDATE_PENDING_2H',
    case: 'Receive update pending',
    subCase: 'Package QC passed by Receiver + Shipment marked delivered + Delivery acceptance pending for over 2 hours',
    level: 'L1',
    title: 'Receive Update Pending — 2 Hours',
    description: 'Package {trackingId} QC passed but delivery acceptance has not been confirmed in the system for over 2 hours.',
    targetRoles: ['RECEIVER'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 2,
    sopSteps: [
      'Log into the receiver dashboard and confirm acceptance for the package.',
      'Verify that all QC checks are complete and documented.',
      'Update the package status to accepted in the system.',
    ],
  },
  {
    type: 'RECEIVE_UPDATE_PENDING_6H',
    case: 'Receive update pending',
    subCase: 'Package QC passed by Receiver + Shipment marked delivered + Delivery acceptance pending for over 6 hours',
    level: 'L2',
    title: 'Receive Update Pending — 6 Hours',
    description: 'Package {trackingId} QC passed but delivery acceptance has not been confirmed for over 6 hours. Admin notified.',
    targetRoles: ['RECEIVER', 'admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 6,
    sopSteps: [
      'Admin: Contact the receiver immediately via hangout to confirm the status.',
      'Receiver: Complete the acceptance process and update the manifest.',
      'If receiver is unavailable, have an alternate receiver confirm the package.',
    ],
  },

  // ── 5. RECEIVER–INSPECTOR HANDSHAKE PENDING ──────────────────────────────────

  {
    type: 'RECV_INSP_HANDSHAKE_10AM',
    case: 'Receiver-Inspector handshake pending',
    subCase: 'All previous-day QC-passed shipments not handed over to Inspector by 10 AM next day',
    level: 'L1',
    title: 'Receiver→Inspector Handshake Pending — 10 AM Deadline',
    description: 'One or more packages received yesterday have not been handed over to the inspector by 10 AM today.',
    targetRoles: ['RECEIVER'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: null, // time-of-day based
    sopSteps: [
      'Review all packages received yesterday with status AT_DOCK.',
      'Initiate handover to the assigned inspector immediately.',
      'Confirm handover in the system before 12 PM.',
    ],
  },
  {
    type: 'RECV_INSP_HANDSHAKE_12PM',
    case: 'Receiver-Inspector handshake pending',
    subCase: 'All previous-day QC-passed shipments not handed over to Inspector by 12 PM next day',
    level: 'L2',
    title: 'Receiver→Inspector Handshake Pending — 12 PM Breach',
    description: 'Packages received yesterday have not been handed over to the inspector by 12 PM. Admin has been notified.',
    targetRoles: ['RECEIVER', 'admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: null,
    sopSteps: [
      'Admin: Contact the receiver to understand the delay.',
      'Receiver: Complete all pending handovers immediately.',
      'Reassign the inspection if the primary inspector is unavailable.',
    ],
  },
  {
    type: 'RECV_INSP_HANDSHAKE_3PM',
    case: 'Receiver-Inspector handshake pending',
    subCase: 'All previous-day QC-passed shipments not handed over to Inspector by 3 PM next day',
    level: 'L3',
    title: 'Receiver→Inspector Handshake Pending — 3 PM Critical Breach',
    description: 'Packages received yesterday still not handed over to inspector by 3 PM. Escalation raised.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: null,
    sopSteps: [
      'Admin: Escalate to operations head if receiver is non-responsive.',
      'Manually trigger handover in the system and assign an available inspector.',
      'Document the delay reason in the manifest notes.',
    ],
  },
  {
    type: 'RECV_INSP_HANDSHAKE_NEXT_DAY',
    case: 'Receiver-Inspector handshake pending',
    subCase: 'All previous-day QC-passed shipments not handed over to Inspector by 10 AM the day after next',
    level: 'L4',
    title: 'Receiver→Inspector Handshake — CRITICAL: Day+2 Breach',
    description: 'Packages have gone a full extra day without inspection handover. Leadership has been escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: null,
    sopSteps: [
      'Immediately investigate the root cause of the multi-day delay.',
      'Force-assign an inspector and complete handover within the hour.',
      'Notify Sunil Deshmukh and Harsh Jain with the resolution timeline.',
      'Document the incident for SLA performance review.',
    ],
  },

  // ── 6. INSPECTION PENDING ─────────────────────────────────────────────────────

  {
    type: 'INSPECTION_PENDING_6H',
    case: 'Inspection pending',
    subCase: 'Package handed over to Inspector + 6 or more hours elapsed + Inspection still pending',
    level: 'L1',
    title: 'Inspection Pending — 6 Hours',
    description: 'Package {trackingId} was handed over to the inspector 6+ hours ago but inspection has not been completed.',
    targetRoles: ['INSPECTOR'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 6,
    sopSteps: [
      'Open the inspector dashboard and locate the pending package.',
      'Complete the inspection and update the item condition.',
      'If blocked, contact admin for support.',
    ],
  },
  {
    type: 'INSPECTION_PENDING_12H',
    case: 'Inspection pending',
    subCase: 'Package handed over to Inspector + 12 or more hours elapsed + Inspection still pending',
    level: 'L2',
    title: 'Inspection Pending — 12 Hours',
    description: 'Package {trackingId} has been with the inspector for 12+ hours. Admin notified.',
    targetRoles: ['INSPECTOR', 'admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 12,
    sopSteps: [
      'Admin: Contact the inspector via hangout to determine the blocker.',
      'Inspector: Prioritize this package and complete inspection immediately.',
      'If the inspector is absent, reassign to an available inspector.',
    ],
  },
  {
    type: 'INSPECTION_PENDING_18H',
    case: 'Inspection pending',
    subCase: 'Package handed over to Inspector + 18 or more hours elapsed + Inspection still pending',
    level: 'L3',
    title: 'Inspection Pending — 18 Hours',
    description: 'Package {trackingId} inspection still pending after 18 hours. Escalation email sent.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 18,
    sopSteps: [
      'Escalate via email to the operations team for immediate reassignment.',
      'Reassign the package to the most available inspector.',
      'Log the SLA breach in the inspection tracker.',
    ],
  },
  {
    type: 'INSPECTION_PENDING_24H',
    case: 'Inspection pending',
    subCase: 'Package handed over to Inspector + 24 or more hours elapsed + Inspection still pending',
    level: 'L4',
    title: 'Inspection Pending — CRITICAL: 24 Hours',
    description: 'Package {trackingId} has not been inspected for 24+ hours. Leadership escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      'Immediately reassign the inspection to a senior inspector.',
      'Complete the inspection within the next 2 hours.',
      'Report the delay reason to Sunil Deshmukh and Harsh Jain.',
      'Initiate an SLA breach review for this incident.',
    ],
  },

  // ── 7. INSPECTION QC FAILED ────────────────────────────────────────────────

  {
    type: 'INSPECTION_QC_FAILED_6H',
    case: 'Inspection QC failed',
    subCase: 'Inspection QC failed + Claim not raised within 6 hours',
    level: 'L2',
    title: 'Inspection QC Failed — Claim Not Raised (6h)',
    description: 'Package {trackingId} failed inspection QC. No claim has been raised 6 hours after the inspection failure.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'email'],
    thresholdHours: 6,
    sopSteps: [
      'Review the inspection QC failure reason and evidence photos.',
      'Access the Amazon IDR (Seller Central claims portal).',
      'Begin filing the dispute/claim with the inspection evidence.',
      'Update the manifest claimId with the filed Amazon case ID.',
    ],
  },
  {
    type: 'INSPECTION_QC_FAILED_12H',
    case: 'Inspection QC failed',
    subCase: 'Inspection QC failed + Claim not raised within 12 hours',
    level: 'L3',
    title: 'Inspection QC Failed — Claim Not Raised (12h)',
    description: 'Package {trackingId} failed inspection QC. No claim raised 12 hours after failure. Escalation in existing thread.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      'Reply in the existing email thread confirming claim filing intent.',
      'Immediately file the claim in Amazon Seller Central.',
      'Log the Amazon case ID in the manifest.',
    ],
  },
  {
    type: 'INSPECTION_QC_FAILED_24H',
    case: 'Inspection QC failed',
    subCase: 'Inspection QC failed + Claim not raised within 24 hours',
    level: 'L4',
    title: 'Inspection QC Failed — CRITICAL: Claim Not Raised (24h)',
    description: 'Package {trackingId} failed QC 24+ hours ago with no claim. Leadership escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      'File the Amazon claim immediately — do not delay further.',
      'Attach all inspection evidence: photos, video, unboxing logs.',
      'Notify Sunil Deshmukh and Harsh Jain with the Amazon case reference.',
      'Log status as "Filed" in the reimbursement tracker.',
    ],
  },

  // ── 8. INSPECTOR–RECOVERY HANDSHAKE PENDING ────────────────────────────────

  {
    type: 'INSP_RECOVERY_HANDSHAKE_12H',
    case: 'Inspector-Recovery handshake pending',
    subCase: 'Inspection QC passed + SKU marked for recovery + Not handed over to Recovery within 12 hours',
    level: 'L1',
    title: 'Inspector→Recovery Handshake Pending — 12 Hours',
    description: 'SKU from {trackingId} was marked for recovery after inspection but has not been handed over to the recovery team within 12 hours.',
    targetRoles: ['INSPECTOR'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 12,
    sopSteps: [
      'Locate the SKU in the inspection area.',
      'Complete the handover to the recovery team and log it in the system.',
    ],
  },
  {
    type: 'INSP_RECOVERY_HANDSHAKE_18H',
    case: 'Inspector-Recovery handshake pending',
    subCase: 'Inspection QC passed + SKU marked for recovery + Not handed over to Recovery within 18 hours',
    level: 'L2',
    title: 'Inspector→Recovery Handshake Pending — 18 Hours',
    description: 'SKU from {trackingId} marked for recovery not handed over after 18 hours. Admin notified.',
    targetRoles: ['INSPECTOR', 'admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 18,
    sopSteps: [
      'Admin: Contact the inspector to resolve the handover delay.',
      'Inspector: Complete the recovery handover immediately.',
      'If inspector is unavailable, request an admin override handover.',
    ],
  },

  // ── 9. RECOVERY REJECTION 1 ─────────────────────────────────────────────────

  {
    type: 'RECOVERY_REJECTION_1_REALTIME',
    case: 'Recovery rejection 1',
    subCase: 'SKU handed over to Recovery + SKU marked as damaged (real time)',
    level: 'L2',
    title: 'Recovery Rejection — SKU Marked Damaged',
    description: 'A SKU from {trackingId} handed over to the recovery team has been marked as damaged. Admin action required.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: null, // real-time event
    sopSteps: [
      'Review the damage report from the recovery team.',
      'Confirm the extent of damage and determine claim eligibility.',
      'Initiate a damage claim on Amazon Seller Central.',
    ],
  },
  {
    type: 'RECOVERY_REJECTION_1_6H',
    case: 'Recovery rejection 1',
    subCase: 'SKU handed over to Recovery + SKU marked as damaged + No action by Admin within 6 hours',
    level: 'L3',
    title: 'Recovery Rejection — No Admin Action (6h)',
    description: 'SKU from {trackingId} marked damaged in recovery 6+ hours ago. No admin action taken. Escalation raised.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 6,
    sopSteps: [
      'Admin must acknowledge the damage report and begin claim filing.',
      'Reply in the existing email thread with the action taken.',
      'File the damage claim with Amazon IDR immediately.',
    ],
  },

  // ── 10. RECOVERY REJECTION 2 ────────────────────────────────────────────────

  {
    type: 'RECOVERY_REJECTION_2_1H',
    case: 'Recovery rejection 2',
    subCase: 'SKU marked damaged + Acknowledged by Admin + Claim not raised within 1 hour',
    level: 'L2',
    title: 'Recovery Rejection — Claim Not Raised Post-Acknowledgement (1h)',
    description: 'Admin acknowledged the recovery damage for {trackingId} but a claim has not been raised within 1 hour.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 1,
    sopSteps: [
      'Open Amazon Seller Central and navigate to the IDR claims portal.',
      'File the claim with the damage photos from recovery.',
      'Log the case ID in the manifest and update status.',
    ],
  },
  {
    type: 'RECOVERY_REJECTION_2_6H',
    case: 'Recovery rejection 2',
    subCase: 'SKU marked damaged + Acknowledged by Admin + Claim not raised within 6 hours',
    level: 'L3',
    title: 'Recovery Rejection — Claim Not Raised Post-Acknowledgement (6h)',
    description: 'Admin acknowledged recovery damage for {trackingId} 6+ hours ago but no claim filed. Escalation raised.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 6,
    sopSteps: [
      'Reply in the existing thread — claim must be filed now.',
      'File the Amazon damage claim immediately.',
      'Update the manifest claimId once filed.',
    ],
  },
  {
    type: 'RECOVERY_REJECTION_2_12H',
    case: 'Recovery rejection 2',
    subCase: 'SKU marked damaged + Acknowledged by Admin + Claim not raised within 12 hours',
    level: 'L4',
    title: 'Recovery Rejection — CRITICAL: Claim Not Raised (12h)',
    description: 'Acknowledged recovery damage for {trackingId} — claim still unfiled after 12 hours. Leadership escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      'File the Amazon claim immediately with full evidence.',
      'Notify Sunil Deshmukh and Harsh Jain with claim reference.',
      'Document all delays for claims performance review.',
    ],
  },

  // ── 11. RECOVERY–QC HANDSHAKE PENDING ──────────────────────────────────────

  {
    type: 'RECOVERY_QC_HANDSHAKE_24H',
    case: 'Recovery-QC handshake pending',
    subCase: 'SKU in Recovery (not damaged) + 24h elapsed + Not handed over to QC for inventorisation',
    level: 'L1',
    title: 'Recovery→QC Handshake Pending — 24 Hours',
    description: 'A recoverable SKU from {trackingId} has been with the recovery team for 24+ hours without being handed over to QC for inventorisation.',
    targetRoles: ['RECOVERY'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 24,
    sopSteps: [
      'Locate the SKU in the recovery area.',
      'Complete the packaging/recovery work and hand over to QC.',
      'Log the handover in the system.',
    ],
  },
  {
    type: 'RECOVERY_QC_HANDSHAKE_36H',
    case: 'Recovery-QC handshake pending',
    subCase: 'SKU in Recovery (not damaged) + 36h elapsed + Not handed over to QC for inventorisation',
    level: 'L2',
    title: 'Recovery→QC Handshake Pending — 36 Hours',
    description: 'Recoverable SKU from {trackingId} has not been handed to QC in 36+ hours. Admin notified.',
    targetRoles: ['RECOVERY', 'admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 36,
    sopSteps: [
      'Admin: Contact the recovery team to determine the delay.',
      'Recovery: Expedite the inventorisation handover to QC.',
      'If recovery is blocked, escalate to operations head.',
    ],
  },

  // ── 12. INSPECTOR–QC HANDSHAKE PENDING ─────────────────────────────────────

  {
    type: 'INSP_QC_HANDSHAKE_24H',
    case: 'Inspector-QC handshake pending',
    subCase: 'Inspection QC passed + SKU marked for inventorisation + Not handed over to QC within 24 hours',
    level: 'L1',
    title: 'Inspector→QC Handshake Pending — 24 Hours',
    description: 'SKU from {trackingId} marked for inventorisation after inspection but not handed to QC team within 24 hours.',
    targetRoles: ['INSPECTOR'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 24,
    sopSteps: [
      'Locate the inventorisation-ready SKU.',
      'Hand it over to the QC team and confirm in the system.',
    ],
  },
  {
    type: 'INSP_QC_HANDSHAKE_36H',
    case: 'Inspector-QC handshake pending',
    subCase: 'Inspection QC passed + SKU marked for inventorisation + Not handed over to QC within 36 hours',
    level: 'L2',
    title: 'Inspector→QC Handshake Pending — 36 Hours',
    description: 'SKU from {trackingId} inventorisation handover to QC delayed 36+ hours. Admin notified.',
    targetRoles: ['INSPECTOR', 'admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 36,
    sopSteps: [
      'Admin: Contact the inspector to resolve the QC handover delay.',
      'Inspector: Complete the handover to QC immediately.',
      'If the inspector is unavailable, an admin can override the handover.',
    ],
  },

  // ── 13. QC REJECTION 1 ─────────────────────────────────────────────────────

  {
    type: 'QC_REJECTION_1_REALTIME',
    case: 'QC rejection 1',
    subCase: 'SKU handed over to QC + SKU marked as damaged (real time)',
    level: 'L2',
    title: 'QC Rejection — SKU Marked Damaged at QC',
    description: 'A SKU from {trackingId} handed over to QC has been marked as damaged. Admin action required immediately.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: null,
    sopSteps: [
      'Review the QC damage report and photos.',
      'Determine claim eligibility (courier damage vs. product defect).',
      'Initiate the appropriate claim on Amazon Seller Central.',
    ],
  },
  {
    type: 'QC_REJECTION_1_24H',
    case: 'QC rejection 1',
    subCase: 'SKU handed over to QC + SKU marked as damaged + No action by Admin within 24 hours',
    level: 'L3',
    title: 'QC Rejection — No Admin Action (24h)',
    description: 'SKU from {trackingId} marked damaged at QC 24+ hours ago. No admin action taken. Escalation raised.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      'Admin must acknowledge and act on the QC damage report now.',
      'File the claim with damage evidence via Amazon IDR.',
      'Reply in the existing email thread with action taken.',
    ],
  },

  // ── 14. QC REJECTION 2 ─────────────────────────────────────────────────────

  {
    type: 'QC_REJECTION_2_1H',
    case: 'QC rejection 2',
    subCase: 'SKU at QC + Damaged + Acknowledged by Admin + Claim not raised within 1 hour',
    level: 'L2',
    title: 'QC Rejection — Claim Not Raised Post-Acknowledgement (1h)',
    description: 'Admin acknowledged QC damage for {trackingId}. Claim not filed within 1 hour.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 1,
    sopSteps: [
      'Open the Amazon IDR claims portal and file the claim with QC evidence.',
      'Log the case ID in the manifest and update the status.',
    ],
  },
  {
    type: 'QC_REJECTION_2_6H',
    case: 'QC rejection 2',
    subCase: 'SKU at QC + Damaged + Acknowledged by Admin + Claim not raised within 6 hours',
    level: 'L3',
    title: 'QC Rejection — Claim Not Raised Post-Acknowledgement (6h)',
    description: 'Admin acknowledged QC damage for {trackingId} 6+ hours ago. Claim still not filed. Escalation raised.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 6,
    sopSteps: [
      'Reply in the existing email thread with filing intent.',
      'File the Amazon claim immediately.',
      'Log the case ID once filed.',
    ],
  },
  {
    type: 'QC_REJECTION_2_24H',
    case: 'QC rejection 2',
    subCase: 'SKU at QC + Damaged + Acknowledged by Admin + Claim not raised within 24 hours',
    level: 'L4',
    title: 'QC Rejection — CRITICAL: Claim Not Raised (24h)',
    description: 'Acknowledged QC damage for {trackingId} — claim still unfiled after 24 hours. Leadership escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      'File the Amazon claim immediately with full QC damage evidence.',
      'Notify Sunil Deshmukh and Harsh Jain with claim reference number.',
      'Document all delays for claims SLA performance review.',
    ],
  },

  // ── 15. INVENTORISATION PENDING ────────────────────────────────────────────

  {
    type: 'INVENTORISATION_PENDING_12H',
    case: 'Inventorisation pending',
    subCase: 'SKU at QC (not damaged) + 12h elapsed + SKU not inventorised',
    level: 'L1',
    title: 'Inventorisation Pending — 12 Hours',
    description: 'A SKU from {trackingId} has been with the QC team for 12+ hours without being inventorised.',
    targetRoles: ['QC'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 12,
    sopSteps: [
      'Locate the SKU awaiting inventorisation.',
      'Complete the QC inventorisation process and update the system.',
      'Mark the SKU as RECOVERED_TO_INVENTORY once done.',
    ],
  },
  {
    type: 'INVENTORISATION_PENDING_18H',
    case: 'Inventorisation pending',
    subCase: 'SKU at QC (not damaged) + 18h elapsed + SKU not inventorised',
    level: 'L2',
    title: 'Inventorisation Pending — 18 Hours',
    description: 'SKU from {trackingId} at QC for 18+ hours without inventorisation. Admin notified.',
    targetRoles: ['QC', 'admin'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 18,
    sopSteps: [
      'Admin: Contact the QC team to resolve the inventorisation delay.',
      'QC: Prioritize and complete the inventorisation immediately.',
      'If QC is blocked, reassign to an available QC member.',
    ],
  },
  {
    type: 'INVENTORISATION_PENDING_24H',
    case: 'Inventorisation pending',
    subCase: 'SKU at QC (not damaged) + 24h elapsed + SKU not inventorised',
    level: 'L3',
    title: 'Inventorisation Pending — 24 Hours',
    description: 'SKU from {trackingId} at QC for 24+ hours without inventorisation. Escalation raised.',
    targetRoles: ['admin'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      'Escalate via email — QC inventorisation must complete today.',
      'Admin to verify QC team availability and reassign if needed.',
      'Document the SLA breach in the inventorisation tracker.',
    ],
  },
  {
    type: 'INVENTORISATION_PENDING_48H',
    case: 'Inventorisation pending',
    subCase: 'SKU at QC (not damaged) + 48h elapsed + SKU not inventorised',
    level: 'L4',
    title: 'Inventorisation Pending — CRITICAL: 48 Hours',
    description: 'SKU from {trackingId} at QC for 48+ hours without inventorisation. Leadership escalated.',
    targetRoles: ['admin'],
    escalateToLeaders: ['Sunil Deshmukh', 'Harsh Jain'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 48,
    sopSteps: [
      'Immediately escalate to operations head for forced inventorisation.',
      'Complete the inventorisation within 2 hours.',
      'Notify Sunil Deshmukh and Harsh Jain with the resolution timeline.',
      'Initiate an SLA breach investigation for this inventory delay.',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED LOOKUPS (for use in API routes and cron jobs)
// ─────────────────────────────────────────────────────────────────────────────

/** Quick lookup: alertType → rule */
export const ALERT_RULE_BY_TYPE: Record<string, AlertRule> =
  Object.fromEntries(ALERT_RULES.map(r => [r.type, r]));

/** Quick lookup: alertType → SOP steps array (for use in /api/alerts/sop) */
export const SOP_MAP: Record<string, string[]> =
  Object.fromEntries(ALERT_RULES.map(r => [r.type, r.sopSteps]));

/** All unique alert type keys */
export const ALL_ALERT_TYPES = ALERT_RULES.map(r => r.type);

/** Rules grouped by case for reporting/display */
export const RULES_BY_CASE: Record<string, AlertRule[]> = ALERT_RULES.reduce(
  (acc, rule) => {
    if (!acc[rule.case]) acc[rule.case] = [];
    acc[rule.case].push(rule);
    return acc;
  },
  {} as Record<string, AlertRule[]>
);
