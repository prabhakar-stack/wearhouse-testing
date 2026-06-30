/**
 * Central Alert Rules Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * All alert rule definitions for the warehouse returns management system.
 * SOP steps are bilingual — stored as { en, hi } objects.
 * The API picks the correct language directly — no runtime regex translation.
 *
 * LEVELS:
 *   L1 → In-app nudge only (dashboard + hangout)
 *   L2 → Dashboard nudge + Email escalation (new thread)
 *   L3 → Dashboard nudge + Email escalation (existing thread)
 *   L4 → All of the above + Escalation to Sunil Deshmukh, Harsh Jain, Super-Access
 *
 * TARGET ROLES:
 *   admin, RECEIVER, INSPECTOR, RECOVERY, QC, super-access
 */

export type AlertLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type NotificationChannel = 'dashboard' | 'hangout' | 'email' | 'email_existing_thread';

export interface BilingualStep {
  en: string;
  hi: string;
}

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
  /** Notification delivery channels */
  channels: NotificationChannel[];
  /** SOP resolution steps — bilingual { en, hi } */
  sopSteps: BilingualStep[];
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'email'],
    thresholdHours: 48,
    sopSteps: [
      { en: 'Check the courier tracking portal for the latest scan event.', hi: 'कूरियर ट्रैकिंग पोर्टल पर सबसे हाल की स्कैन इवेंट जांचें।' },
      { en: 'Contact the assigned courier account manager to request a status update.', hi: 'असाइन किए गए कूरियर अकाउंट मैनेजर से स्टेटस अपडेट मांगें।' },
      { en: 'Log the response in the manifest notes.', hi: 'जवाब मैनिफेस्ट नोट्स में दर्ज करें।' },
      { en: 'If no update within 4 hours, escalate to L3.', hi: '4 घंटे में कोई अपडेट न मिले तो L3 को एस्केलेट करें।' },
    ],
  },
  {
    type: 'DELIVERY_ETA_BREACH_72H',
    case: 'Delivery ETA breach',
    subCase: '(Date of order + 5 Days) + Breach by 72 hours',
    level: 'L3',
    title: 'Delivery ETA Breach — 72 Hour Overdue',
    description: 'Package {trackingId} is 72 hours past its expected delivery date (Order date + 5 days). Escalation mail has been sent in the existing thread.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 72,
    sopSteps: [
      { en: 'Review the existing mail thread for prior escalation responses.', hi: 'पिछले एस्केलेशन जवाबों के लिए मौजूदा मेल थ्रेड देखें।' },
      { en: 'Reply to the existing email thread requesting a firm delivery commitment.', hi: 'मौजूदा ईमेल थ्रेड में जवाब दें और पक्की डिलीवरी तारीख मांगें।' },
      { en: 'Check if a courier claim for late delivery is applicable.', hi: 'देखें कि देरी से डिलीवरी के लिए कूरियर क्लेम लागू है या नहीं।' },
      { en: 'If no commitment received in 12 hours, escalate to L4.', hi: '12 घंटे में कोई प्रतिबद्धता न मिले तो L4 को एस्केलेट करें।' },
    ],
  },
  {
    type: 'DELIVERY_ETA_BREACH_96H',
    case: 'Delivery ETA breach',
    subCase: '(Date of order + 5 Days) + Breach by 96 hours',
    level: 'L4',
    title: 'Delivery ETA Breach — 96 Hour Overdue (CRITICAL)',
    description: 'Package {trackingId} is 96 hours past its expected delivery date. Leadership has been notified. Immediate resolution required.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 96,
    sopSteps: [
      { en: "Immediately contact the courier's senior escalation desk.", hi: 'तुरंत कूरियर के वरिष्ठ एस्केलेशन डेस्क से संपर्क करें।' },
      { en: 'Initiate a formal lost-in-transit inquiry with the carrier.', hi: 'कूरियर के साथ औपचारिक ट्रांजिट में खोने की जांच शुरू करें।' },
      { en: 'Inform Sunil Deshmukh and Harsh Jain of the current status.', hi: 'सुनील देशमुख और हर्ष जैन को मौजूदा स्थिति की जानकारी दें।' },
      { en: 'If confirmed lost, file an FBA inbound lost claim with Amazon.', hi: 'खोने की पुष्टि हो तो Amazon FBA के साथ इनबाउंड लॉस्ट क्लेम दायर करें।' },
      { en: 'Mark the manifest as LOST_IN_TRANSIT once courier confirms.', hi: 'कूरियर की पुष्टि के बाद मैनिफेस्ट को LOST_IN_TRANSIT मार्क करें।' },
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'email'],
    thresholdHours: 6,
    sopSteps: [
      { en: "Check the courier's delivery proof-of-delivery (POD) photograph.", hi: 'कूरियर की डिलीवरी POD फोटो जांचें।' },
      { en: 'Search the dock area physically for any unscanned packages.', hi: 'डॉक एरिया में किसी बिना स्कैन पैकेज के लिए भौतिक रूप से खोजें।' },
      { en: 'Confirm with the on-duty receiver if the package arrived but was not scanned.', hi: 'ड्यूटी पर मौजूद रिसीवर से पुष्टि करें कि पैकेज आया पर स्कैन नहीं हुआ।' },
      { en: 'If package is missing, initiate a formal courier inquiry.', hi: 'पैकेज गायब हो तो औपचारिक कूरियर जांच शुरू करें।' },
    ],
  },
  {
    type: 'GHOST_DELIVERY_T1_12H',
    case: 'Marked delivered incorrectly (Type 1)',
    subCase: 'No logs of scan by Receiver + Shipment marked delivered by the delivery partner + No claim created within 12 hours',
    level: 'L3',
    title: 'Ghost Delivery (Type 1) — No Receiver Scan, 12h Without Claim',
    description: 'Package {trackingId} marked delivered by courier with no receiver scan. Claim still not raised after 12 hours.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      { en: 'Review the existing email thread for prior updates.', hi: 'पिछले अपडेट के लिए मौजूदा ईमेल थ्रेड देखें।' },
      { en: "Escalate inquiry to the courier's regional operations team.", hi: 'कूरियर की क्षेत्रीय ऑपरेशन टीम को जांच एस्केलेट करें।' },
      { en: 'Collect all evidence: POD photo, door camera footage, receiver logs.', hi: 'सभी सबूत इकट्ठा करें: POD फोटो, डोर कैमरा फुटेज, रिसीवर लॉग।' },
      { en: 'Begin drafting a formal claim against the courier for non-delivery.', hi: 'गैर-डिलीवरी के लिए कूरियर के खिलाफ औपचारिक क्लेम तैयार करना शुरू करें।' },
    ],
  },
  {
    type: 'GHOST_DELIVERY_T1_24H',
    case: 'Marked delivered incorrectly (Type 1)',
    subCase: 'No logs of scan by Receiver + Shipment marked delivered by the delivery partner + No claim created within 24 hours',
    level: 'L4',
    title: 'Ghost Delivery (Type 1) — CRITICAL: 24h Without Claim',
    description: 'Package {trackingId} marked delivered by courier with no receiver scan. No claim raised in 24 hours. Leadership escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      { en: 'File a formal lost inbound claim with Amazon FBA immediately.', hi: 'तुरंत Amazon FBA के साथ औपचारिक इनबाउंड लॉस्ट क्लेम दायर करें।' },
      { en: 'Attach all collected evidence to the claim.', hi: 'क्लेम में सभी इकट्ठा किए सबूत संलग्न करें।' },
      { en: 'Notify Sunil Deshmukh and Harsh Jain of the filed claim reference.', hi: 'दायर क्लेम संदर्भ की जानकारी सुनील देशमुख और हर्ष जैन को दें।' },
      { en: 'Mark the manifest as LOST_IN_TRANSIT.', hi: 'मैनिफेस्ट को LOST_IN_TRANSIT मार्क करें।' },
      { en: 'Follow up with the courier for reimbursement against the delivery.', hi: 'डिलीवरी के बदले रिम्बर्समेंट के लिए कूरियर से फॉलो अप करें।' },
    ],
  },
  {
    type: 'GHOST_DELIVERY_T1_48H',
    case: 'Marked delivered incorrectly (Type 1)',
    subCase: 'No logs of scan by Receiver + ETA was 48+ hours ago + Package still EXPECTED or IN_TRANSIT — possible missing delivery',
    level: 'L4',
    title: 'Ghost Delivery — 48h+ Unaccounted Package',
    description: 'Package {trackingId} was expected for delivery over 48 hours ago but has never been scanned at the warehouse. Courier shows it delivered. Immediate escalation and potential legal action required.',
    targetRoles: ['L3', 'L4'],
    channels: ['dashboard', 'email_existing_thread', 'hangout'],
    thresholdHours: 48,
    sopSteps: [
      { en: 'Verify with the courier that the package was dispatched and confirm the delivery address.', hi: 'कूरियर से पुष्टि करें कि पैकेज भेजा गया था और डिलीवरी पता सत्यापित करें।' },
      { en: 'Review all CCTV/door camera footage at the warehouse entrance for the delivery window.', hi: 'डिलीवरी विंडो के लिए वेयरहाउस प्रवेश पर सभी CCTV/डोर कैमरा फुटेज देखें।' },
      { en: 'Check if the package was accidentally delivered to a neighbouring unit or dock.', hi: 'जांचें कि क्या पैकेज गलती से किसी पड़ोसी यूनिट या डॉक में डिलीवर हुआ।' },
      { en: 'If unresolved after 48h, file a formal police/courier theft complaint and notify legal team.', hi: '48 घंटे बाद भी अनसुलझा रहे तो औपचारिक पुलिस/कूरियर चोरी शिकायत दर्ज करें और कानूनी टीम को सूचित करें।' },
      { en: 'Update manifest status to LOST_IN_TRANSIT and close all dependent alerts.', hi: 'मैनिफेस्ट स्टेटस LOST_IN_TRANSIT अपडेट करें और सभी संबंधित अलर्ट बंद करें।' },
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'email'],
    thresholdHours: 6,
    sopSteps: [
      { en: "Review the receiver's QC rejection reason and photos.", hi: 'रिसीवर की QC अस्वीकृति का कारण और फोटो देखें।' },
      { en: "Verify the courier's delivery/non-delivery status on their portal.", hi: 'कूरियर पोर्टल पर डिलीवरी/गैर-डिलीवरी स्टेटस सत्यापित करें।' },
      { en: 'Contact the courier to reconcile the status discrepancy.', hi: 'स्टेटस की विसंगति दूर करने के लिए कूरियर से संपर्क करें।' },
      { en: 'Prepare claim documentation based on the QC failure evidence.', hi: 'QC विफलता के सबूत के आधार पर क्लेम दस्तावेज तैयार करें।' },
    ],
  },
  {
    type: 'GHOST_DELIVERY_T2_12H',
    case: 'Marked delivered incorrectly (Type 2)',
    subCase: 'Package QC failed by Receiver + Shipment marked delivered / undelivered + No claim created within 12 hours',
    level: 'L3',
    title: 'Ghost Delivery (Type 2) — Receiver QC Failed, 12h Without Claim',
    description: 'Package {trackingId} QC failed by receiver. No claim raised within 12 hours. Escalation in existing thread.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      { en: 'Reply in the existing email thread with QC failure documentation.', hi: 'मौजूदा ईमेल थ्रेड में QC विफलता दस्तावेज के साथ जवाब दें।' },
      { en: 'File a freight damage or QC-failure return claim with the carrier.', hi: 'कूरियर के साथ फ्रेट डैमेज या QC विफलता रिटर्न क्लेम दायर करें।' },
      { en: 'Confirm claim eligibility with the Amazon IDR portal.', hi: 'Amazon IDR पोर्टल से क्लेम की पात्रता की पुष्टि करें।' },
    ],
  },
  {
    type: 'GHOST_DELIVERY_T2_24H',
    case: 'Marked delivered incorrectly (Type 2)',
    subCase: 'Package QC failed by Receiver + Shipment marked delivered / undelivered + No claim created within 24 hours',
    level: 'L4',
    title: 'Ghost Delivery (Type 2) — CRITICAL: 24h Without Claim',
    description: 'Package {trackingId} QC failed by receiver. No claim raised in 24 hours. Leadership escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      { en: 'File the freight damage claim immediately with full QC evidence.', hi: 'पूरे QC सबूत के साथ तुरंत फ्रेट डैमेज क्लेम दायर करें।' },
      { en: 'Submit an Amazon FBA warehouse damage claim if applicable.', hi: 'लागू हो तो Amazon FBA वेयरहाउस डैमेज क्लेम दायर करें।' },
      { en: 'Notify Sunil Deshmukh and Harsh Jain with the claim reference number.', hi: 'क्लेम संदर्भ संख्या के साथ सुनील देशमुख और हर्ष जैन को सूचित करें।' },
      { en: 'Mark the manifest appropriately and log the claim ID.', hi: 'मैनिफेस्ट को उचित रूप से मार्क करें और क्लेम ID दर्ज करें।' },
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
      { en: 'Log into the receiver dashboard and confirm acceptance for the package.', hi: 'रिसीवर डैशबोर्ड में लॉग इन करें और पैकेज की स्वीकृति की पुष्टि करें।' },
      { en: 'Verify that all QC checks are complete and documented.', hi: 'सुनिश्चित करें कि सभी QC जांचें पूरी और दर्ज हैं।' },
      { en: 'Update the package status to accepted in the system.', hi: 'सिस्टम में पैकेज का स्टेटस स्वीकृत में अपडेट करें।' },
    ],
  },
  {
    type: 'RECEIVE_UPDATE_PENDING_6H',
    case: 'Receive update pending',
    subCase: 'Package QC passed by Receiver + Shipment marked delivered + Delivery acceptance pending for over 6 hours',
    level: 'L2',
    title: 'Receive Update Pending — 6 Hours',
    description: 'Package {trackingId} QC passed but delivery acceptance has not been confirmed for over 6 hours. Admin notified.',
    targetRoles: ['L2','RECEIVER'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 6,
    sopSteps: [
      { en: 'Admin: Contact the receiver immediately via hangout to confirm the status.', hi: 'एडमिन: तुरंत हैंगआउट के ज़रिए रिसीवर से संपर्क करें और स्टेटस की पुष्टि करें।' },
      { en: 'Receiver: Complete the acceptance process and update the manifest.', hi: 'रिसीवर: स्वीकृति प्रक्रिया पूरी करें और मैनिफेस्ट अपडेट करें।' },
      { en: 'If receiver is unavailable, have an alternate receiver confirm the package.', hi: 'रिसीवर उपलब्ध न हो तो किसी अन्य रिसीवर से पैकेज की पुष्टि करवाएं।' },
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
    thresholdHours: null,
    sopSteps: [
      { en: 'Review all packages received yesterday with status AT_DOCK.', hi: 'कल AT_DOCK स्टेटस में प्राप्त सभी पैकेज जांचें।' },
      { en: 'Initiate handover to the assigned inspector immediately.', hi: 'तुरंत असाइन किए गए इंस्पेक्टर को हैंडओवर शुरू करें।' },
      { en: 'Confirm handover in the system before 12 PM.', hi: 'दोपहर 12 बजे से पहले सिस्टम में हैंडओवर की पुष्टि करें।' },
    ],
  },
  {
    type: 'RECV_INSP_HANDSHAKE_12PM',
    case: 'Receiver-Inspector handshake pending',
    subCase: 'All previous-day QC-passed shipments not handed over to Inspector by 12 PM next day',
    level: 'L2',
    title: 'Receiver→Inspector Handshake Pending — 12 PM Breach',
    description: 'Packages received yesterday have not been handed over to the inspector by 12 PM. Admin has been notified.',
    targetRoles: ['L2','RECEIVER'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: null,
    sopSteps: [
      { en: 'Admin: Contact the receiver to understand the delay.', hi: 'एडमिन: देरी समझने के लिए रिसीवर से संपर्क करें।' },
      { en: 'Receiver: Complete all pending handovers immediately.', hi: 'रिसीवर: सभी लंबित हैंडओवर तुरंत पूरे करें।' },
      { en: 'Reassign the inspection if the primary inspector is unavailable.', hi: 'प्राथमिक इंस्पेक्टर उपलब्ध न हो तो निरीक्षण पुनः असाइन करें।' },
    ],
  },
  {
    type: 'RECV_INSP_HANDSHAKE_3PM',
    case: 'Receiver-Inspector handshake pending',
    subCase: 'All previous-day QC-passed shipments not handed over to Inspector by 3 PM next day',
    level: 'L3',
    title: 'Receiver→Inspector Handshake Pending — 3 PM Critical Breach',
    description: 'Packages received yesterday still not handed over to inspector by 3 PM. Escalation raised.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: null,
    sopSteps: [
      { en: 'Admin: Escalate to operations head if receiver is non-responsive.', hi: 'एडमिन: रिसीवर जवाब न दे तो ऑपरेशन्स हेड को एस्केलेट करें।' },
      { en: 'Manually trigger handover in the system and assign an available inspector.', hi: 'सिस्टम में मैन्युअली हैंडओवर ट्रिगर करें और उपलब्ध इंस्पेक्टर असाइन करें।' },
      { en: 'Document the delay reason in the manifest notes.', hi: 'मैनिफेस्ट नोट्स में देरी का कारण दर्ज करें।' },
    ],
  },
  {
    type: 'RECV_INSP_HANDSHAKE_NEXT_DAY',
    case: 'Receiver-Inspector handshake pending',
    subCase: 'All previous-day QC-passed shipments not handed over to Inspector by 10 AM the day after next',
    level: 'L4',
    title: 'Receiver→Inspector Handshake — CRITICAL: Day+2 Breach',
    description: 'Packages have gone a full extra day without inspection handover. Leadership has been escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: null,
    sopSteps: [
      { en: 'Immediately investigate the root cause of the multi-day delay.', hi: 'कई दिनों की देरी के मूल कारण की तुरंत जांच करें।' },
      { en: 'Force-assign an inspector and complete handover within the hour.', hi: 'एक घंटे के भीतर इंस्पेक्टर को जबरन असाइन करें और हैंडओवर पूरा करें।' },
      { en: 'Notify Sunil Deshmukh and Harsh Jain with the resolution timeline.', hi: 'समाधान टाइमलाइन के साथ सुनील देशमुख और हर्ष जैन को सूचित करें।' },
      { en: 'Document the incident for SLA performance review.', hi: 'SLA प्रदर्शन समीक्षा के लिए घटना दर्ज करें।' },
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
      { en: 'Open the inspector dashboard and locate the pending package.', hi: 'इंस्पेक्टर डैशबोर्ड खोलें और लंबित पैकेज ढूंढें।' },
      { en: 'Complete the inspection and update the item condition.', hi: 'निरीक्षण पूरा करें और आइटम की स्थिति अपडेट करें।' },
      { en: 'If blocked, contact admin for support.', hi: 'कोई रुकावट हो तो सहायता के लिए एडमिन से संपर्क करें।' },
    ],
  },
  {
    type: 'INSPECTION_PENDING_12H',
    case: 'Inspection pending',
    subCase: 'Package handed over to Inspector + 12 or more hours elapsed + Inspection still pending',
    level: 'L2',
    title: 'Inspection Pending — 12 Hours',
    description: 'Package {trackingId} has been with the inspector for 12+ hours. Admin notified.',
    targetRoles: ['L2','INSPECTOR'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 12,
    sopSteps: [
      { en: 'Admin: Contact the inspector via hangout to determine the blocker.', hi: 'एडमिन: हैंगआउट के ज़रिए इंस्पेक्टर से संपर्क करें और रुकावट का पता लगाएं।' },
      { en: 'Inspector: Prioritize this package and complete inspection immediately.', hi: 'इंस्पेक्टर: इस पैकेज को प्राथमिकता दें और तुरंत निरीक्षण पूरा करें।' },
      { en: 'If the inspector is absent, reassign to an available inspector.', hi: 'इंस्पेक्टर अनुपस्थित हो तो उपलब्ध इंस्पेक्टर को पुनः असाइन करें।' },
    ],
  },
  {
    type: 'INSPECTION_PENDING_18H',
    case: 'Inspection pending',
    subCase: 'Package handed over to Inspector + 18 or more hours elapsed + Inspection still pending',
    level: 'L3',
    title: 'Inspection Pending — 18 Hours',
    description: 'Package {trackingId} inspection still pending after 18 hours. Escalation email sent.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 18,
    sopSteps: [
      { en: 'Escalate via email to the operations team for immediate reassignment.', hi: 'तत्काल पुनः असाइनमेंट के लिए ईमेल से ऑपरेशन्स टीम को एस्केलेट करें।' },
      { en: 'Reassign the package to the most available inspector.', hi: 'सबसे उपलब्ध इंस्पेक्टर को पैकेज पुनः असाइन करें।' },
      { en: 'Log the SLA breach in the inspection tracker.', hi: 'निरीक्षण ट्रैकर में SLA उल्लंघन दर्ज करें।' },
    ],
  },
  {
    type: 'INSPECTION_PENDING_24H',
    case: 'Inspection pending',
    subCase: 'Package handed over to Inspector + 24 or more hours elapsed + Inspection still pending',
    level: 'L4',
    title: 'Inspection Pending — CRITICAL: 24 Hours',
    description: 'Package {trackingId} has not been inspected for 24+ hours. Leadership escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      { en: 'Immediately reassign the inspection to a senior inspector.', hi: 'तुरंत निरीक्षण को वरिष्ठ इंस्पेक्टर को पुनः असाइन करें।' },
      { en: 'Complete the inspection within the next 2 hours.', hi: 'अगले 2 घंटे में निरीक्षण पूरा करें।' },
      { en: 'Report the delay reason to Sunil Deshmukh and Harsh Jain.', hi: 'देरी का कारण सुनील देशमुख और हर्ष जैन को रिपोर्ट करें।' },
      { en: 'Initiate an SLA breach review for this incident.', hi: 'इस घटना के लिए SLA उल्लंघन समीक्षा शुरू करें।' },
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'email'],
    thresholdHours: 6,
    sopSteps: [
      { en: 'Review the inspection QC failure reason and evidence photos.', hi: 'निरीक्षण QC विफलता का कारण और सबूत फोटो देखें।' },
      { en: 'Access the Amazon IDR (Seller Central claims portal).', hi: 'Amazon IDR (Seller Central क्लेम पोर्टल) खोलें।' },
      { en: 'Begin filing the dispute/claim with the inspection evidence.', hi: 'निरीक्षण सबूत के साथ विवाद/क्लेम दायर करना शुरू करें।' },
      { en: 'Update the manifest claimId with the filed Amazon case ID.', hi: 'मैनिफेस्ट claimId को दायर Amazon केस ID से अपडेट करें।' },
    ],
  },
  {
    type: 'INSPECTION_QC_FAILED_12H',
    case: 'Inspection QC failed',
    subCase: 'Inspection QC failed + Claim not raised within 12 hours',
    level: 'L3',
    title: 'Inspection QC Failed — Claim Not Raised (12h)',
    description: 'Package {trackingId} failed inspection QC. No claim raised 12 hours after failure. Escalation in existing thread.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      { en: 'Reply in the existing email thread confirming claim filing intent.', hi: 'मौजूदा ईमेल थ्रेड में क्लेम दायर करने के इरादे की पुष्टि करते हुए जवाब दें।' },
      { en: 'Immediately file the claim in Amazon Seller Central.', hi: 'Amazon Seller Central में तुरंत क्लेम दायर करें।' },
      { en: 'Log the Amazon case ID in the manifest.', hi: 'मैनिफेस्ट में Amazon केस ID दर्ज करें।' },
    ],
  },
  {
    type: 'INSPECTION_QC_FAILED_24H',
    case: 'Inspection QC failed',
    subCase: 'Inspection QC failed + Claim not raised within 24 hours',
    level: 'L4',
    title: 'Inspection QC Failed — CRITICAL: Claim Not Raised (24h)',
    description: 'Package {trackingId} failed QC 24+ hours ago with no claim. Leadership escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      { en: 'File the Amazon claim immediately — do not delay further.', hi: 'Amazon क्लेम तुरंत दायर करें — और देरी न करें।' },
      { en: 'Attach all inspection evidence: photos, video, unboxing logs.', hi: 'सभी निरीक्षण सबूत संलग्न करें: फोटो, वीडियो, अनबॉक्सिंग लॉग।' },
      { en: 'Notify Sunil Deshmukh and Harsh Jain with the Amazon case reference.', hi: 'Amazon केस संदर्भ के साथ सुनील देशमुख और हर्ष जैन को सूचित करें।' },
      { en: 'Log status as "Filed" in the reimbursement tracker.', hi: 'रिम्बर्समेंट ट्रैकर में स्टेटस "दायर" दर्ज करें।' },
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
      { en: 'Locate the SKU in the inspection area.', hi: 'निरीक्षण क्षेत्र में SKU ढूंढें।' },
      { en: 'Complete the handover to the recovery team and log it in the system.', hi: 'रिकवरी टीम को हैंडओवर पूरा करें और सिस्टम में दर्ज करें।' },
    ],
  },
  {
    type: 'INSP_RECOVERY_HANDSHAKE_18H',
    case: 'Inspector-Recovery handshake pending',
    subCase: 'Inspection QC passed + SKU marked for recovery + Not handed over to Recovery within 18 hours',
    level: 'L2',
    title: 'Inspector→Recovery Handshake Pending — 18 Hours',
    description: 'SKU from {trackingId} marked for recovery not handed over after 18 hours. Admin notified.',
    targetRoles: ['L2','INSPECTOR'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 18,
    sopSteps: [
      { en: 'Admin: Contact the inspector to resolve the handover delay.', hi: 'एडमिन: हैंडओवर की देरी सुलझाने के लिए इंस्पेक्टर से संपर्क करें।' },
      { en: 'Inspector: Complete the recovery handover immediately.', hi: 'इंस्पेक्टर: रिकवरी हैंडओवर तुरंत पूरा करें।' },
      { en: 'If inspector is unavailable, request an admin override handover.', hi: 'इंस्पेक्टर उपलब्ध न हो तो एडमिन ओवरराइड हैंडओवर का अनुरोध करें।' },
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: null,
    sopSteps: [
      { en: 'Review the damage report from the recovery team.', hi: 'रिकवरी टीम से डैमेज रिपोर्ट की समीक्षा करें।' },
      { en: 'Confirm the extent of damage and determine claim eligibility.', hi: 'नुकसान की सीमा की पुष्टि करें और क्लेम पात्रता तय करें।' },
      { en: 'Initiate a damage claim on Amazon Seller Central.', hi: 'Amazon Seller Central पर डैमेज क्लेम शुरू करें।' },
    ],
  },
  {
    type: 'RECOVERY_REJECTION_1_6H',
    case: 'Recovery rejection 1',
    subCase: 'SKU handed over to Recovery + SKU marked as damaged + No action by Admin within 6 hours',
    level: 'L3',
    title: 'Recovery Rejection — No Admin Action (6h)',
    description: 'SKU from {trackingId} marked damaged in recovery 6+ hours ago. No admin action taken. Escalation raised.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 6,
    sopSteps: [
      { en: 'Admin must acknowledge the damage report and begin claim filing.', hi: 'एडमिन डैमेज रिपोर्ट स्वीकार करें और क्लेम दायर करना शुरू करें।' },
      { en: 'Reply in the existing email thread with the action taken.', hi: 'मौजूदा ईमेल थ्रेड में की गई कार्रवाई के साथ जवाब दें।' },
      { en: 'File the damage claim with Amazon IDR immediately.', hi: 'Amazon IDR के साथ तुरंत डैमेज क्लेम दायर करें।' },
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 1,
    sopSteps: [
      { en: 'Open Amazon Seller Central and navigate to the IDR claims portal.', hi: 'Amazon Seller Central खोलें और IDR क्लेम पोर्टल पर जाएं।' },
      { en: 'File the claim with the damage photos from recovery.', hi: 'रिकवरी की डैमेज फोटो के साथ क्लेम दायर करें।' },
      { en: 'Log the case ID in the manifest and update status.', hi: 'मैनिफेस्ट में केस ID दर्ज करें और स्टेटस अपडेट करें।' },
    ],
  },
  {
    type: 'RECOVERY_REJECTION_2_6H',
    case: 'Recovery rejection 2',
    subCase: 'SKU marked damaged + Acknowledged by Admin + Claim not raised within 6 hours',
    level: 'L3',
    title: 'Recovery Rejection — Claim Not Raised Post-Acknowledgement (6h)',
    description: 'Admin acknowledged recovery damage for {trackingId} 6+ hours ago but no claim filed. Escalation raised.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 6,
    sopSteps: [
      { en: 'Reply in the existing thread — claim must be filed now.', hi: 'मौजूदा थ्रेड में जवाब दें — क्लेम अभी दायर होना चाहिए।' },
      { en: 'File the Amazon damage claim immediately.', hi: 'Amazon डैमेज क्लेम तुरंत दायर करें।' },
      { en: 'Update the manifest claimId once filed.', hi: 'दायर होने पर मैनिफेस्ट claimId अपडेट करें।' },
    ],
  },
  {
    type: 'RECOVERY_REJECTION_2_12H',
    case: 'Recovery rejection 2',
    subCase: 'SKU marked damaged + Acknowledged by Admin + Claim not raised within 12 hours',
    level: 'L4',
    title: 'Recovery Rejection — CRITICAL: Claim Not Raised (12h)',
    description: 'Acknowledged recovery damage for {trackingId} — claim still unfiled after 12 hours. Leadership escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 12,
    sopSteps: [
      { en: 'File the Amazon claim immediately with full evidence.', hi: 'पूरे सबूत के साथ Amazon क्लेम तुरंत दायर करें।' },
      { en: 'Notify Sunil Deshmukh and Harsh Jain with claim reference.', hi: 'क्लेम संदर्भ के साथ सुनील देशमुख और हर्ष जैन को सूचित करें।' },
      { en: 'Document all delays for claims performance review.', hi: 'क्लेम प्रदर्शन समीक्षा के लिए सभी देरी दर्ज करें।' },
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
      { en: 'Locate the SKU in the recovery area.', hi: 'रिकवरी एरिया में SKU ढूंढें।' },
      { en: 'Complete the packaging/recovery work and hand over to QC.', hi: 'पैकेजिंग/रिकवरी काम पूरा करें और QC को सौंपें।' },
      { en: 'Log the handover in the system.', hi: 'सिस्टम में हैंडओवर दर्ज करें।' },
    ],
  },
  {
    type: 'RECOVERY_QC_HANDSHAKE_36H',
    case: 'Recovery-QC handshake pending',
    subCase: 'SKU in Recovery (not damaged) + 36h elapsed + Not handed over to QC for inventorisation',
    level: 'L2',
    title: 'Recovery→QC Handshake Pending — 36 Hours',
    description: 'Recoverable SKU from {trackingId} has not been handed to QC in 36+ hours. Admin notified.',
    targetRoles: ['L2','RECOVERY'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 36,
    sopSteps: [
      { en: 'Admin: Contact the recovery team to determine the delay.', hi: 'एडमिन: देरी का कारण जानने के लिए रिकवरी टीम से संपर्क करें।' },
      { en: 'Recovery: Expedite the inventorisation handover to QC.', hi: 'रिकवरी: QC को इन्वेंटराइजेशन हैंडओवर में तेजी लाएं।' },
      { en: 'If recovery is blocked, escalate to operations head.', hi: 'रिकवरी अवरुद्ध हो तो ऑपरेशन्स हेड को एस्केलेट करें।' },
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
      { en: 'Locate the inventorisation-ready SKU.', hi: 'इन्वेंटराइजेशन के लिए तैयार SKU ढूंढें।' },
      { en: 'Hand it over to the QC team and confirm in the system.', hi: 'QC टीम को सौंपें और सिस्टम में पुष्टि करें।' },
    ],
  },
  {
    type: 'INSP_QC_HANDSHAKE_36H',
    case: 'Inspector-QC handshake pending',
    subCase: 'Inspection QC passed + SKU marked for inventorisation + Not handed over to QC within 36 hours',
    level: 'L2',
    title: 'Inspector→QC Handshake Pending — 36 Hours',
    description: 'SKU from {trackingId} inventorisation handover to QC delayed 36+ hours. Admin notified.',
    targetRoles: ['L2','INSPECTOR'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 36,
    sopSteps: [
      { en: 'Admin: Contact the inspector to resolve the QC handover delay.', hi: 'एडमिन: QC हैंडओवर देरी सुलझाने के लिए इंस्पेक्टर से संपर्क करें।' },
      { en: 'Inspector: Complete the handover to QC immediately.', hi: 'इंस्पेक्टर: QC को हैंडओवर तुरंत पूरा करें।' },
      { en: 'If the inspector is unavailable, an admin can override the handover.', hi: 'इंस्पेक्टर उपलब्ध न हो तो एडमिन हैंडओवर ओवरराइड कर सकता है।' },
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: null,
    sopSteps: [
      { en: 'Review the QC damage report and photos.', hi: 'QC डैमेज रिपोर्ट और फोटो की समीक्षा करें।' },
      { en: 'Determine claim eligibility (courier damage vs. product defect).', hi: 'क्लेम पात्रता तय करें (कूरियर डैमेज बनाम उत्पाद दोष)।' },
      { en: 'Initiate the appropriate claim on Amazon Seller Central.', hi: 'Amazon Seller Central पर उचित क्लेम शुरू करें।' },
    ],
  },
  {
    type: 'QC_REJECTION_1_24H',
    case: 'QC rejection 1',
    subCase: 'SKU handed over to QC + SKU marked as damaged + No action by Admin within 24 hours',
    level: 'L3',
    title: 'QC Rejection — No Admin Action (24h)',
    description: 'SKU from {trackingId} marked damaged at QC 24+ hours ago. No admin action taken. Escalation raised.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      { en: 'Admin must acknowledge and act on the QC damage report now.', hi: 'एडमिन अभी QC डैमेज रिपोर्ट स्वीकार करें और कार्रवाई करें।' },
      { en: 'File the claim with damage evidence via Amazon IDR.', hi: 'Amazon IDR के ज़रिए डैमेज सबूत के साथ क्लेम दायर करें।' },
      { en: 'Reply in the existing email thread with action taken.', hi: 'मौजूदा ईमेल थ्रेड में की गई कार्रवाई के साथ जवाब दें।' },
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
    targetRoles: ['L2'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 1,
    sopSteps: [
      { en: 'Open the Amazon IDR claims portal and file the claim with QC evidence.', hi: 'Amazon IDR क्लेम पोर्टल खोलें और QC सबूत के साथ क्लेम दायर करें।' },
      { en: 'Log the case ID in the manifest and update the status.', hi: 'मैनिफेस्ट में केस ID दर्ज करें और स्टेटस अपडेट करें।' },
    ],
  },
  {
    type: 'QC_REJECTION_2_6H',
    case: 'QC rejection 2',
    subCase: 'SKU at QC + Damaged + Acknowledged by Admin + Claim not raised within 6 hours',
    level: 'L3',
    title: 'QC Rejection — Claim Not Raised Post-Acknowledgement (6h)',
    description: 'Admin acknowledged QC damage for {trackingId} 6+ hours ago. Claim still not filed. Escalation raised.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 6,
    sopSteps: [
      { en: 'Reply in the existing email thread with filing intent.', hi: 'मौजूदा ईमेल थ्रेड में क्लेम दायर करने के इरादे के साथ जवाब दें।' },
      { en: 'File the Amazon claim immediately.', hi: 'Amazon क्लेम तुरंत दायर करें।' },
      { en: 'Log the case ID once filed.', hi: 'दायर होने पर केस ID दर्ज करें।' },
    ],
  },
  {
    type: 'QC_REJECTION_2_24H',
    case: 'QC rejection 2',
    subCase: 'SKU at QC + Damaged + Acknowledged by Admin + Claim not raised within 24 hours',
    level: 'L4',
    title: 'QC Rejection — CRITICAL: Claim Not Raised (24h)',
    description: 'Acknowledged QC damage for {trackingId} — claim still unfiled after 24 hours. Leadership escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      { en: 'File the Amazon claim immediately with full QC damage evidence.', hi: 'पूरे QC डैमेज सबूत के साथ Amazon क्लेम तुरंत दायर करें।' },
      { en: 'Notify Sunil Deshmukh and Harsh Jain with claim reference number.', hi: 'क्लेम संदर्भ संख्या के साथ सुनील देशमुख और हर्ष जैन को सूचित करें।' },
      { en: 'Document all delays for claims SLA performance review.', hi: 'क्लेम SLA प्रदर्शन समीक्षा के लिए सभी देरी दर्ज करें।' },
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
      { en: 'Locate the SKU awaiting inventorisation.', hi: 'इन्वेंटराइजेशन की प्रतीक्षा में SKU ढूंढें।' },
      { en: 'Complete the QC inventorisation process and update the system.', hi: 'QC इन्वेंटराइजेशन प्रक्रिया पूरी करें और सिस्टम अपडेट करें।' },
      { en: 'Mark the SKU as RECOVERED_TO_INVENTORY once done.', hi: 'पूरा होने पर SKU को RECOVERED_TO_INVENTORY मार्क करें।' },
    ],
  },
  {
    type: 'INVENTORISATION_PENDING_18H',
    case: 'Inventorisation pending',
    subCase: 'SKU at QC (not damaged) + 18h elapsed + SKU not inventorised',
    level: 'L2',
    title: 'Inventorisation Pending — 18 Hours',
    description: 'SKU from {trackingId} at QC for 18+ hours without inventorisation. Admin notified.',
    targetRoles: ['L2','QC'],
    channels: ['dashboard', 'hangout'],
    thresholdHours: 18,
    sopSteps: [
      { en: 'Admin: Contact the QC team to resolve the inventorisation delay.', hi: 'एडमिन: इन्वेंटराइजेशन देरी सुलझाने के लिए QC टीम से संपर्क करें।' },
      { en: 'QC: Prioritize and complete the inventorisation immediately.', hi: 'QC: इन्वेंटराइजेशन को प्राथमिकता दें और तुरंत पूरा करें।' },
      { en: 'If QC is blocked, reassign to an available QC member.', hi: 'QC अवरुद्ध हो तो उपलब्ध QC सदस्य को पुनः असाइन करें।' },
    ],
  },
  {
    type: 'INVENTORISATION_PENDING_24H',
    case: 'Inventorisation pending',
    subCase: 'SKU at QC (not damaged) + 24h elapsed + SKU not inventorised',
    level: 'L3',
    title: 'Inventorisation Pending — 24 Hours',
    description: 'SKU from {trackingId} at QC for 24+ hours without inventorisation. Escalation raised.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 24,
    sopSteps: [
      { en: 'Escalate via email — QC inventorisation must complete today.', hi: 'ईमेल से एस्केलेट करें — QC इन्वेंटराइजेशन आज ही पूरा होना चाहिए।' },
      { en: 'Admin to verify QC team availability and reassign if needed.', hi: 'एडमिन QC टीम की उपलब्धता जांचें और ज़रूरत हो तो पुनः असाइन करें।' },
      { en: 'Document the SLA breach in the inventorisation tracker.', hi: 'इन्वेंटराइजेशन ट्रैकर में SLA उल्लंघन दर्ज करें।' },
    ],
  },
  {
    type: 'INVENTORISATION_PENDING_48H',
    case: 'Inventorisation pending',
    subCase: 'SKU at QC (not damaged) + 48h elapsed + SKU not inventorised',
    level: 'L4',
    title: 'Inventorisation Pending — CRITICAL: 48 Hours',
    description: 'SKU from {trackingId} at QC for 48+ hours without inventorisation. Leadership escalated.',
    targetRoles: ['L2', 'L3', 'L4'],
    channels: ['dashboard', 'hangout', 'email_existing_thread'],
    thresholdHours: 48,
    sopSteps: [
      { en: 'Immediately escalate to operations head for forced inventorisation.', hi: 'जबरन इन्वेंटराइजेशन के लिए तुरंत ऑपरेशन्स हेड को एस्केलेट करें।' },
      { en: 'Complete the inventorisation within 2 hours.', hi: '2 घंटे में इन्वेंटराइजेशन पूरा करें।' },
      { en: 'Notify Sunil Deshmukh and Harsh Jain with the resolution timeline.', hi: 'समाधान टाइमलाइन के साथ सुनील देशमुख और हर्ष जैन को सूचित करें।' },
      { en: 'Initiate an SLA breach investigation for this inventory delay.', hi: 'इस इन्वेंट्री देरी के लिए SLA उल्लंघन जांच शुरू करें।' },
    ],
  },

  // ── 16. AMAZON ORDER NOT DISPATCHED (Reimbursement Window) ──────────────────

  {
    type: 'ORDER_NOT_SHIPPED_5D',
    case: 'Amazon order not dispatched',
    subCase: 'Removal order placed 5+ days ago but no Manifest is in IN_TRANSIT or beyond — Amazon has not dispatched the shipment',
    level: 'L2',
    title: 'Amazon Order Not Dispatched — 5 Days',
    description: 'Removal Order {orderId} was requested on {requestDate} but Amazon has NOT dispatched this shipment after 5 days. No manifest is IN_TRANSIT or beyond. Reimbursement window closes in ~9 days.',
    targetRoles: ['L2'],
    channels: ['dashboard', 'email'],
    thresholdHours: 120,
    sopSteps: [
      { en: 'Log into Amazon Seller Central and check the removal order status.', hi: 'Amazon Seller Central में लॉग इन करें और रिमूवल ऑर्डर स्टेटस जांचें।' },
      { en: 'If status is still "Pending" or "In Progress", contact Amazon Seller Support.', hi: 'स्टेटस "Pending" या "In Progress" हो तो Amazon Seller Support से संपर्क करें।' },
      { en: 'Request an expedited dispatch or a status update on the removal.', hi: 'त्वरित डिस्पैच या रिमूवल पर स्टेटस अपडेट मांगें।' },
      { en: 'Log the follow-up in the reimbursement tracker sheet.', hi: 'रिम्बर्समेंट ट्रैकर शीट में फॉलो-अप दर्ज करें।' },
    ],
  },
  {
    type: 'ORDER_NOT_SHIPPED_10D',
    case: 'Amazon order not dispatched',
    subCase: 'Removal order placed 10+ days ago — still no manifest in IN_TRANSIT or beyond. Critical reimbursement window.',
    level: 'L3',
    title: 'Amazon Order Not Dispatched — 10 Days (CRITICAL WINDOW)',
    description: 'Removal Order {orderId} requested on {requestDate} still has no dispatched shipment (no manifest in IN_TRANSIT or beyond) after 10 days. Amazon reimbursement window closes in ~4–5 days. Immediate action required.',
    targetRoles: ['L2', 'L3'],
    channels: ['dashboard', 'email_existing_thread'],
    thresholdHours: 240,
    sopSteps: [
      { en: 'Immediately contact Amazon Seller Support via phone/chat for an escalation.', hi: 'तुरंत फोन/चैट के ज़रिए Amazon Seller Support से एस्केलेशन के लिए संपर्क करें।' },
      { en: 'Request Amazon to either dispatch the removal or process an in-place reimbursement.', hi: 'Amazon से रिमूवल डिस्पैच करने या इन-प्लेस रिम्बर्समेंट प्रोसेस करने का अनुरोध करें।' },
      { en: 'Document all communication timestamps.', hi: 'सभी संचार टाइमस्टैम्प दर्ज करें।' },
      { en: 'If Amazon is unresponsive within 24 hours, escalate to L4.', hi: '24 घंटे में Amazon जवाब न दे तो L4 को एस्केलेट करें।' },
      { en: 'File a pre-emptive claim if within 13 days of request date.', hi: 'अनुरोध तारीख के 13 दिन के भीतर हो तो पूर्व-निवारक क्लेम दायर करें।' },
    ],
  },

  // ── 17. MISSING TRACKING NUMBER ─────────────────────────────────────────────

  {
    type: 'ORDER_NO_TRACKING_ID',
    case: 'Missing tracking number',
    subCase: 'AMZRemovalShipment row exists but trackingNumber is NULL or empty',
    level: 'L2',
    title: 'Shipment Row Has No Tracking Number',
    description: 'Removal Order {orderId} has a shipment record in Amazon data but no tracking number is assigned. This may resolve automatically on next Amazon report sync. No manifest created for this shipment.',
    targetRoles: ['L2'],
    channels: ['dashboard'],
    thresholdHours: null,
    sopSteps: [
      { en: 'Wait for the next Amazon report sync to see if a tracking number appears.', hi: 'अगले Amazon रिपोर्ट सिंक का इंतजार करें और देखें कि ट्रैकिंग नंबर आता है या नहीं।' },
      { en: 'If still missing after next sync, check Seller Central removal order for courier assignment.', hi: 'अगले सिंक के बाद भी न मिले तो Seller Central रिमूवल ऑर्डर में कूरियर असाइनमेंट जांचें।' },
      { en: 'If no tracking number appears within 3 syncs, contact Amazon Seller Support.', hi: '3 सिंक के बाद भी ट्रैकिंग नंबर न आए तो Amazon Seller Support से संपर्क करें।' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED LOOKUPS (for use in API routes and cron jobs)
// ─────────────────────────────────────────────────────────────────────────────

/** Quick lookup: alertType → rule */
export const ALERT_RULE_BY_TYPE: Record<string, AlertRule> =
  Object.fromEntries(ALERT_RULES.map(r => [r.type, r]));

/**
 * Quick lookup: alertType → SOP steps array for a given language.
 * Returns the `en` text by default (backward compat).
 */
export function getSopMap(lang: 'en' | 'hi' = 'en'): Record<string, string[]> {
  return Object.fromEntries(
    ALERT_RULES.map(r => [r.type, r.sopSteps.map(s => s[lang] || s.en)])
  );
}

/** Legacy flat string SOP_MAP — English only (for any code that still uses it) */
export const SOP_MAP: Record<string, string[]> =
  Object.fromEntries(ALERT_RULES.map(r => [r.type, r.sopSteps.map(s => s.en)]));

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
