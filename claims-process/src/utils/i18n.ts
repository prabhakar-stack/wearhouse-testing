export type PreferredLanguage = "en" | "hi";

// ─────────────────────────────────────────────────────────────────────────────
// Persistence helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getStoredLanguage(): PreferredLanguage {
  if (typeof window === "undefined") return "en";
  // URL param takes highest priority (e.g. ?lang=hi)
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get("lang");
  if (urlLang === "hi" || urlLang === "en") return urlLang;
  // Fall back to localStorage
  try {
    const stored = window.localStorage.getItem("preferredLanguage");
    if (stored === "hi" || stored === "en") return stored as PreferredLanguage;
  } catch (_) {}
  return "en";
}

export function persistLanguage(lang: PreferredLanguage) {
  try {
    window.localStorage.setItem("preferredLanguage", lang);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Translation map
// ─────────────────────────────────────────────────────────────────────────────

const UI_TRANSLATIONS: Record<string, Record<PreferredLanguage, string>> = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  "Total Active Claims": { en: "Total Active Claims", hi: "कुल सक्रिय दावे" },
  "Awaiting Triage": { en: "Awaiting Triage", hi: "जांच की प्रतीक्षा में" },
  "Recovery Rate": { en: "Recovery Rate", hi: "वसूली दर" },
  "Projected Recovery": { en: "Projected Recovery", hi: "अनुमानित वसूली" },
  "Executive Overview": { en: "Executive Overview", hi: "संक्षिप्त सारांश" },
  "Real-time recovery metrics and pipeline status.": {
    en: "Real-time recovery metrics and pipeline status.",
    hi: "वास्तविक समय में वसूली के आँकड़े और प्रक्रिया की स्थिति।"
  },
  "Claim Volume Trends": { en: "Claim Volume Trends", hi: "दावों की संख्या का रुझान" },
  "Pipeline Breakdown": { en: "Pipeline Breakdown", hi: "प्रक्रिया विवरण" },
  "Initial Handoff": { en: "Initial Handoff", hi: "प्रारंभिक सुपुर्दगी" },
  "Triage & Escalation": { en: "Triage & Escalation", hi: "जांच और वृद्धि" },
  "Filing Process": { en: "Filing Process", hi: "दाखिला प्रक्रिया" },
  "Reporting": { en: "Reporting", hi: "रिपोर्टिंग" },
  "Manual OTP Required": { en: "Manual OTP Required", hi: "मैन्युअल OTP आवश्यक" },
  "The Amazon Bot encountered an OTP request. Please visit the Smart Filing Hub to assist.": {
    en: "The Amazon Bot encountered an OTP request. Please visit the Smart Filing Hub to assist.",
    hi: "अमेज़न बॉट को OTP का अनुरोध मिला है। कृपया स्मार्ट फाइलिंग हब पर जाकर सहायता करें।"
  },
  "RESOLVE NOW": { en: "RESOLVE NOW", hi: "अभी हल करें" },
  "[Chart Visualization Area]": { en: "[Chart Visualization Area]", hi: "[चार्ट प्रदर्शन क्षेत्र]" },
  "30 DAYS": { en: "30 DAYS", hi: "30 दिन" },

  // ── Triage ─────────────────────────────────────────────────────────────────
  "Triage Queue": { en: "Triage Queue", hi: "जांच कतार" },
  "Manage and escalate pending inventory claims.": {
    en: "Manage and escalate pending inventory claims.",
    hi: "लंबित इन्वेंटरी दावों का प्रबंधन करें और आवश्यकतानुसार आगे बढ़ाएं।"
  },
  "All": { en: "All", hi: "सभी" },
  "Missing": { en: "Missing", hi: "लापता" },
  "Damaged": { en: "Damaged", hi: "क्षतिग्रस्त" },
  "Rejected Delivery": { en: "Rejected Delivery", hi: "अस्वीकृत डिलीवरी" },
  "Filed Claims": { en: "Filed Claims", hi: "दर्ज किए गए दावे" },
  "Search ID, SKU...": { en: "Search ID, SKU...", hi: "आईडी, SKU खोजें..." },
  "C1: Company & Order": { en: "C1: Company & Order", hi: "C1: कंपनी और ऑर्डर" },
  "C2: Inventory Details": { en: "C2: Inventory Details", hi: "C2: इन्वेंटरी विवरण" },
  "C3: Reason Analysis": { en: "C3: Reason Analysis", hi: "C3: कारण विश्लेषण" },
  "C4: Drive Link": { en: "C4: Drive Link", hi: "C4: ड्राइव लिंक" },
  "C5: SLA / Status": { en: "C5: SLA / स्थिति", hi: "C5: SLA / स्थिति" },
  "C6: Reimbursement": { en: "C6: Reimbursement", hi: "C6: प्रतिपूर्ति" },
  "VIEW EVIDENCE": { en: "VIEW EVIDENCE", hi: "साक्ष्य देखें" },
  "No evidence link": { en: "No evidence link", hi: "कोई साक्ष्य लिंक नहीं" },
  "FILE WITH BOT": { en: "FILE WITH BOT", hi: "बॉट से दर्ज करें" },
  "BOT COOLING...": { en: "BOT COOLING...", hi: "बॉट प्रतीक्षारत..." },
  "GROUPED QTY:": { en: "GROUPED QTY:", hi: "सामूहिक मात्रा:" },
  "TRK:": { en: "TRK:", hi: "ट्रैकिंग:" },
  "Qty:": { en: "Qty:", hi: "मात्रा:" },
  "Unfiled": { en: "Unfiled", hi: "दर्ज नहीं किया गया" },
  "Resolved": { en: "Resolved", hi: "हल हो गया" },
  "Escalated": { en: "Escalated", hi: "आगे भेजा गया" },
  "Pending": { en: "Pending", hi: "प्रतीक्षारत" },

  // ── SmartFiling ────────────────────────────────────────────────────────────
  "Smart Filing Hub": { en: "Smart Filing Hub", hi: "स्मार्ट दाखिला केंद्र" },
  "Automated Amazon filing bot powered by Playwright.": {
    en: "Automated Amazon filing bot powered by Playwright.",
    hi: "Playwright द्वारा संचालित स्वचालित अमेज़न दाखिला बॉट।"
  },
  "Bot Health": { en: "Bot Health", hi: "बॉट की स्थिति" },
  "REFRESH QUEUE": { en: "REFRESH QUEUE", hi: "कतार ताज़ा करें" },
  "Live Bot Monitor": { en: "Live Bot Monitor", hi: "लाइव बॉट निगरानी" },
  "Showing browser workspace...": { en: "Showing browser workspace...", hi: "ब्राउज़र कार्यक्षेत्र दिखाया जा रहा है..." },
  "Encrypted Stream": { en: "Encrypted Stream", hi: "एन्क्रिप्टेड स्ट्रीम" },
  "Active Automation Queue": { en: "Active Automation Queue", hi: "सक्रिय स्वचालन कतार" },
  "No active or recent automated tasks found.": {
    en: "No active or recent automated tasks found.",
    hi: "कोई सक्रिय या हालिया स्वचालित कार्य नहीं मिला।"
  },
  "Trigger a filing from the Triage Queue to see logs here.": {
    en: "Trigger a filing from the Triage Queue to see logs here.",
    hi: "यहाँ लॉग देखने के लिए जांच कतार से दाखिला शुरू करें।"
  },
  "BOT BUSY": { en: "BOT BUSY", hi: "बॉट व्यस्त है" },
  "COOLING": { en: "COOLING", hi: "प्रतीक्षारत" },
  "RUN FILING": { en: "RUN FILING", hi: "दाखिला चलाएं" },
  "Bot Execution Logs": { en: "Bot Execution Logs", hi: "बॉट निष्पादन लॉग" },
  "Bot Configuration": { en: "Bot Configuration", hi: "बॉट कॉन्फ़िगरेशन" },
  "READY": { en: "READY", hi: "तैयार" },
  "SETUP REQUIRED": { en: "SETUP REQUIRED", hi: "सेटअप आवश्यक" },
  "Target Account": { en: "Target Account", hi: "लक्षित खाता" },
  "TOTP Secret": { en: "TOTP Secret", hi: "TOTP गोपनीय कोड" },
  "Headless Mode": { en: "Headless Mode", hi: "हेडलेस मोड" },
  "Manual Test Trigger": { en: "Manual Test Trigger", hi: "मैन्युअल परीक्षण" },
  "Amazon Order ID / Tracking ID / LPN": { en: "Amazon Order ID / Tracking ID / LPN", hi: "अमेज़न ऑर्डर आईडी / ट्रैकिंग आईडी / LPN" },
  "RUN TEST": { en: "RUN TEST", hi: "परीक्षण चलाएं" },
  "Security Notice": { en: "Security Notice", hi: "सुरक्षा सूचना" },
  "Bot actions are recorded for audit purposes. Ensure your TOTP secret is stored in encrypted environment variables before production.": {
    en: "Bot actions are recorded for audit purposes. Ensure your TOTP secret is stored in encrypted environment variables before production.",
    hi: "बॉट की सभी गतिविधियाँ ऑडिट के लिए रिकॉर्ड की जाती हैं। उत्पादन में जाने से पहले TOTP गोपनीय कोड को एन्क्रिप्टेड वेरिएबल में रखें।"
  },
  "Validation Complete. All shipment items are marked as 'Inspected'. Ready for SAFE-T filing.": {
    en: "Validation Complete. All shipment items are marked as 'Inspected'. Ready for SAFE-T filing.",
    hi: "सत्यापन पूर्ण। सभी शिपमेंट आइटम 'जांच किए गए' के रूप में चिह्नित हैं। SAFE-T दाखिला के लिए तैयार।"
  },
  "Rejected Delivery detected. Ready for automatic SAFE-T filing.": {
    en: "Rejected Delivery detected. Ready for automatic SAFE-T filing.",
    hi: "अस्वीकृत डिलीवरी का पता चला। स्वचालित SAFE-T दाखिला के लिए तैयार।"
  },

  // ── QCAudit ────────────────────────────────────────────────────────────────
  "compliance and qc audit": { en: "compliance and qc audit", hi: "अनुपालन और QC ऑडिट" },
  "Defensive monitor designed to prevent incorrect inventory categorizations and packaging mix-ups on re-inventorisation.": {
    en: "Defensive monitor designed to prevent incorrect inventory categorizations and packaging mix-ups on re-inventorisation.",
    hi: "पुनः इन्वेंटरी के दौरान गलत वर्गीकरण और पैकेजिंग की गड़बड़ी को रोकने के लिए सुरक्षात्मक निगरानी प्रणाली।"
  },
  "Synchronize Datasets": { en: "Synchronize Datasets", hi: "डेटा समन्वय करें" },
  "Process 01": { en: "Process 01", hi: "प्रक्रिया 01" },
  "SKU Handover Process": { en: "SKU Handover Process", hi: "SKU सुपुर्दगी प्रक्रिया" },
  "Scan physical barcodes to track counted numbers under strict blind verification boundaries.": {
    en: "Scan physical barcodes to track counted numbers under strict blind verification boundaries.",
    hi: "सख्त अंध सत्यापन के अंतर्गत गिनी गई संख्याओं को ट्रैक करने के लिए भौतिक बारकोड स्कैन करें।"
  },
  "Batch Overview": { en: "Batch Overview", hi: "बैच अवलोकन" },
  "Active SKU checklist under audit": { en: "Active SKU checklist under audit", hi: "ऑडिट के अंतर्गत सक्रिय SKU सूची" },
  "No SKUs loaded in handover": { en: "No SKUs loaded in handover", hi: "सुपुर्दगी में कोई SKU नहीं है" },
  "Active QC Monitor": { en: "Active QC Monitor", hi: "सक्रिय QC निगरानी" },
  "Active scan validation workstation desk": { en: "Active scan validation workstation desk", hi: "सक्रिय स्कैन सत्यापन कार्य केंद्र" },
  "Scan / Register Hard Label": { en: "Scan / Register Hard Label", hi: "हार्ड लेबल स्कैन / पंजीकृत करें" },
  "Laser-scan or code-type SKU barcode...": { en: "Laser-scan or code-type SKU barcode...", hi: "लेज़र-स्कैन करें या SKU बारकोड टाइप करें..." },
  "Verify Scan": { en: "Verify Scan", hi: "स्कैन सत्यापित करें" },
  "Active Workstation Action Deck": { en: "Active Workstation Action Deck", hi: "सक्रिय कार्य केंद्र पैनल" },
  "Selected Active SKU": { en: "Selected Active SKU", hi: "चयनित सक्रिय SKU" },
  "WIP Checked Focus": { en: "WIP Checked Focus", hi: "कार्य प्रगति पर (WIP)" },
  "Perform visual inspection inside the physical container. If product, container packaging, or barcode labels suffer retail damage flag here.": {
    en: "Perform visual inspection inside the physical container. If product, container packaging, or barcode labels suffer retail damage flag here.",
    hi: "भौतिक डिब्बे के अंदर दृश्य निरीक्षण करें। यदि उत्पाद, पैकेजिंग, या बारकोड लेबल क्षतिग्रस्त हों तो यहाँ ध्वजांकित करें।"
  },
  "Flag SKU as Damaged": { en: "Flag SKU as Damaged", hi: "SKU को क्षतिग्रस्त घोषित करें" },
  "Handover Complete": { en: "Handover Complete", hi: "सुपुर्दगी पूर्ण" },
  "Confirm Integrity Violation?": { en: "Confirm Integrity Violation?", hi: "क्या आप अनियमितता की पुष्टि करना चाहते हैं?" },
  "Cancel": { en: "Cancel", hi: "रद्द करें" },
  "Yes, Flag Damage": { en: "Yes, Flag Damage", hi: "हाँ, क्षति दर्ज करें" },
  "Confirm Discrepancy Bypass?": { en: "Confirm Discrepancy Bypass?", hi: "क्या अंतर को अनदेखा करना चाहते हैं?" },
  "Cancel & Count": { en: "Cancel & Count", hi: "रद्द करें और दोबारा गिनें" },
  "Yes, Proceed": { en: "Yes, Proceed", hi: "हाँ, जारी रखें" },
  "Process 02": { en: "Process 02", hi: "प्रक्रिया 02" },
  "Recovery Integrity Check": { en: "Recovery Integrity Check", hi: "पुनर्प्राप्ति सत्यनिष्ठा जांच" },
  "Detect mismatched packaging types. Flag items that are wrapped in standard retail packaging, even though they should use custom refurbished materials.": {
    en: "Detect mismatched packaging types. Flag items that are wrapped in standard retail packaging, even though they should use custom refurbished materials.",
    hi: "गलत पैकेजिंग का पता लगाएं। जो आइटम नवीनीकृत डिब्बे की बजाय साधारण खुदरा पैकेजिंग में हैं, उन्हें ध्वजांकित करें।"
  },
  "LPN Identifier": { en: "LPN Identifier", hi: "LPN पहचान संख्या" },
  "SKU Code": { en: "SKU Code", hi: "SKU कोड" },
  "Damage Profile": { en: "Damage Profile", hi: "क्षति विवरण" },
  "Packaging Box Check": { en: "Packaging Box Check", hi: "पैकेजिंग बॉक्स जांच" },
  "Audit Status": { en: "Audit Status", hi: "ऑडिट स्थिति" },
  "Actions": { en: "Actions", hi: "कार्रवाई" },
  "Original Box Detected": { en: "Original Box Detected", hi: "मूल डिब्बा मिला" },
  "Should use: Refurbished Box Container": { en: "Should use: Refurbished Box Container", hi: "नवीनीकृत डिब्बा उपयोग होना चाहिए" },
  "Refurbished Packaging OK": { en: "Refurbished Packaging OK", hi: "नवीनीकृत पैकेजिंग सही है" },
  "Requires Recovery Review": { en: "Requires Recovery Review", hi: "पुनर्प्राप्ति समीक्षा आवश्यक" },
  "Process 03": { en: "Process 03", hi: "प्रक्रिया 03" },
  "Rejected Claims Verification": { en: "Rejected Claims Verification", hi: "अस्वीकृत दावों का सत्यापन" },
  "Audit case decisions directly. Expand items to inspect drive evidence photos inline and make corrective routing updates.": {
    en: "Audit case decisions directly. Expand items to inspect drive evidence photos inline and make corrective routing updates.",
    hi: "सीधे केस के निर्णयों का ऑडिट करें। ड्राइव में संलग्न साक्ष्य फ़ोटो जांचने और सुधार के लिए आइटम को विस्तृत करें।"
  },
  "Embedded Evidence Explorer (Drive Document)": { en: "Embedded Evidence Explorer (Drive Document)", hi: "एम्बेडेड साक्ष्य एक्सप्लोरर (ड्राइव दस्तावेज़)" },
  "Open in New Tab": { en: "Open in New Tab", hi: "नए टैब में खोलें" },
  "Automation System Failure Reason": { en: "Automation System Failure Reason", hi: "स्वचालन विफलता का कारण" },
  "Evidence URL:": { en: "Evidence URL:", hi: "साक्ष्य URL:" },
  "No descriptive failure log snippet detected.": { en: "No descriptive failure log snippet detected.", hi: "कोई विफलता लॉग नहीं मिला।" },
  "No Issue": { en: "No Issue", hi: "कोई समस्या नहीं" },
  "Inspection Mistake": { en: "Inspection Mistake", hi: "निरीक्षण में गलती" },
  "Audited successfully:": { en: "Audited successfully:", hi: "सफलतापूर्वक ऑडिट किया:" },
  "saved.": { en: "saved.", hi: "सहेजा गया।" },
  "Failed to sync compliance audit datasets.": { en: "Failed to sync compliance audit datasets.", hi: "अनुपालन ऑडिट डेटा समन्वय विफल रहा।" },
  "SKUs": { en: "SKUs", hi: "SKU" },
  "Successfully scanned SKU": { en: "Successfully scanned SKU", hi: "SKU सफलतापूर्वक स्कैन किया" },
  "Counted:": { en: "Counted:", hi: "गिना गया:" },
  "SKU scanned. Quantity missing: Need": { en: "SKU scanned. Quantity missing: Need", hi: "SKU स्कैन किया। मात्रा कम है: और चाहिए" },
  "more to match expectations!": { en: "more to match expectations!", hi: "अपेक्षा पूरी करने के लिए!" },
  "SKU": { en: "SKU", hi: "SKU" },
  "incremented successfully!": { en: "incremented successfully!", hi: "सफलतापूर्वक बढ़ाया गया!" },
  "Verification scan failed.": { en: "Verification scan failed.", hi: "सत्यापन स्कैन विफल रहा।" },
  "Network exception occurred during scanning.": { en: "Network exception occurred during scanning.", hi: "स्कैनिंग के दौरान नेटवर्क त्रुटि आई।" },
  "Batch and item status flagged for review. SKU:": { en: "Batch and item status flagged for review. SKU:", hi: "बैच और आइटम समीक्षा के लिए चिह्नित। SKU:" },
  "Failed to mark item as damaged.": { en: "Failed to mark item as damaged.", hi: "आइटम को क्षतिग्रस्त चिह्नित करने में विफल।" },
  "Failed to trigger database damage mutations": { en: "Failed to trigger database damage mutations", hi: "डेटाबेस क्षति अपडेट विफल रहा।" },
  "Handover reconciled and completed successfully!": { en: "Handover reconciled and completed successfully!", hi: "सुपुर्दगी सफलतापूर्वक समन्वित और पूर्ण हुई!" },
  "Failed to reconcile handover.": { en: "Failed to reconcile handover.", hi: "सुपुर्दगी समन्वय विफल रहा।" },
  "Error during batch handover complete.": { en: "Error during batch handover complete.", hi: "बैच सुपुर्दगी पूर्ण करने में त्रुटि।" },
  "Asynchronous compliance status saved for": { en: "Asynchronous compliance status saved for", hi: "अनुपालन स्थिति सहेजी गई:" },
  "Failed to trigger audit update.": { en: "Failed to trigger audit update.", hi: "ऑडिट अपडेट विफल रहा।" },
  "Database connection lookup yielded error.": { en: "Database connection lookup yielded error.", hi: "डेटाबेस कनेक्शन में त्रुटि।" },
  "Failed to save audit result.": { en: "Failed to save audit result.", hi: "ऑडिट परिणाम सहेजने में विफल।" },
  "Failed to mutate claims database statuses.": { en: "Failed to mutate claims database statuses.", hi: "दावा डेटाबेस स्थिति अपडेट विफल रहा।" },
  "Reconciling Batch...": { en: "Reconciling Batch...", hi: "बैच समन्वय हो रहा है..." },
  "You are about to declare a physical product damage violation for SKU": {
    en: "You are about to declare a physical product damage violation for SKU",
    hi: "आप SKU के लिए भौतिक उत्पाद क्षति की घोषणा करने वाले हैं"
  },
  "This will update all associated items to 'requires review at qc' and highlight current batches in red.": {
    en: "This will update all associated items to 'requires review at qc' and highlight current batches in red.",
    hi: "इससे सभी संबंधित आइटम 'QC समीक्षा आवश्यक' में अपडेट होंगे और वर्तमान बैच लाल रंग में दिखेगा।"
  },
  "There are": { en: "There are", hi: "कुल" },
  "products left missing compared to the expected target. Are you sure you want to proceed?": {
    en: "products left missing compared to the expected target. Are you sure you want to proceed?",
    hi: "उत्पाद अपेक्षित लक्ष्य से कम हैं। क्या आप आगे बढ़ना चाहते हैं?"
  },
  "If you proceed, any shorted or unscanned batch elements will automatically be updated to 'missing at qc'.": {
    en: "If you proceed, any shorted or unscanned batch elements will automatically be updated to 'missing at qc'.",
    hi: "यदि आगे बढ़ते हैं, तो बिना स्कैन किए आइटम स्वचालित रूप से 'QC में लापता' हो जाएंगे।"
  },
  "No active SKU focus loaded at workstation. Please scan a barcode to initialize triaging controls.": {
    en: "No active SKU focus loaded at workstation. Please scan a barcode to initialize triaging controls.",
    hi: "कार्य केंद्र पर कोई सक्रिय SKU नहीं है। नियंत्रण प्रारंभ करने के लिए बारकोड स्कैन करें।"
  },
  "* Conclude standard handover once all counted SKU targets are reached.": {
    en: "* Conclude standard handover once all counted SKU targets are reached.",
    hi: "* सभी SKU लक्ष्य पूरे होने पर मानक सुपुर्दगी समाप्त करें।"
  },
  "Scanning Validation Highlight Flag": { en: "Scanning Validation Highlight Flag", hi: "स्कैन सत्यापन चिह्न" },
  "Validation Ok": { en: "Validation Ok", hi: "सत्यापन ठीक" },
  "Warning Check Required": { en: "Warning Check Required", hi: "चेतावनी — जांच आवश्यक" },
  "Scan Refused": { en: "Scan Refused", hi: "स्कैन अस्वीकृत" },
  "Has Damaged Items": { en: "Has Damaged Items", hi: "क्षतिग्रस्त आइटम हैं" },

  // ── RecoveryHub ────────────────────────────────────────────────────────────
  "Beta Module": { en: "Beta Module", hi: "परीक्षण संस्करण" },
  "Claims Administration Panel": { en: "Claims Administration Panel", hi: "दावा प्रशासन पैनल" },
  "Recovery Hub Workstation": { en: "Recovery Hub Workstation", hi: "पुनर्प्राप्ति हब कार्य केंद्र" },
  "Perform physical refurbishment triage of items suffering from retail damage state.": {
    en: "Perform physical refurbishment triage of items suffering from retail damage state.",
    hi: "खुदरा क्षति वाले आइटमों का भौतिक नवीनीकरण और जांच करें।"
  },
  "SUPABASE LIVE": { en: "SUPABASE LIVE", hi: "SUPABASE लाइव" },
  "BARCODE & BOX SCANNING WORKSTATION DECK": { en: "BARCODE & BOX SCANNING WORKSTATION DECK", hi: "बारकोड और बॉक्स स्कैनिंग कार्य केंद्र" },
  "Scan/Type LPN Barcode (e.g., LPN001) or SKU item (e.g., 1120100)...": {
    en: "Scan/Type LPN Barcode (e.g., LPN001) or SKU item (e.g., 1120100)...",
    hi: "LPN बारकोड (जैसे LPN001) या SKU आइटम (जैसे 1120100) स्कैन/टाइप करें..."
  },
  "SUBMIT SCAN": { en: "SUBMIT SCAN", hi: "स्कैन सबमिट करें" },
  "HANDOVER COMPLETE": { en: "HANDOVER COMPLETE", hi: "सुपुर्दगी पूर्ण" },
  "HANDOVER RUN COMPLETED": { en: "HANDOVER RUN COMPLETED", hi: "सुपुर्दगी सत्र समाप्त" },
  "💡 Pro-tip: Enter LPNs/SKUs to append them to the batch queue. Click the green 'Handover complete' button to activate structural & barcode triage controls.": {
    en: "💡 Pro-tip: Enter LPNs/SKUs to append them to the batch queue. Click the green 'Handover complete' button to activate structural & barcode triage controls.",
    hi: "💡 सुझाव: LPN/SKU दर्ज करें और उन्हें बैच में जोड़ें। संरचनात्मक और बारकोड जांच नियंत्रण सक्रिय करने के लिए हरे 'सुपुर्दगी पूर्ण' बटन पर क्लिक करें।"
  },
  "HANDED OVER BATCH": { en: "HANDED OVER BATCH", hi: "सौंपा गया बैच" },
  "Buffered scans for workstation triage": { en: "Buffered scans for workstation triage", hi: "कार्य केंद्र जांच के लिए संग्रहित स्कैन" },
  "ITEMS": { en: "ITEMS", hi: "आइटम" },
  "Batch is currently empty": { en: "Batch is currently empty", hi: "बैच अभी खाली है" },
  "Scan identifiers above to build the current active batch schedule.": {
    en: "Scan identifiers above to build the current active batch schedule.",
    hi: "सक्रिय बैच बनाने के लिए ऊपर पहचान संख्याएं स्कैन करें।"
  },
  "ACTIVE RECOVERY WORKSTATION MONITOR": { en: "ACTIVE RECOVERY WORKSTATION MONITOR", hi: "सक्रिय पुनर्प्राप्ति कार्य केंद्र निगरानी" },
  "Interactive mechanical instructions & update persistence deck": {
    en: "Interactive mechanical instructions & update persistence deck",
    hi: "इंटरेक्टिव यांत्रिक निर्देश और अपडेट पैनल"
  },
  "MONITOR LOCKED": { en: "MONITOR LOCKED", hi: "निगरानी लॉक है" },
  "The active triage monitor is offline. Scan received items into the Handover Deck first, then click \"Handover complete\" to enable the workstation triaging monitor.": {
    en: "The active triage monitor is offline. Scan received items into the Handover Deck first, then click \"Handover complete\" to enable the workstation triaging monitor.",
    hi: "सक्रिय जांच निगरानी बंद है। पहले प्राप्त आइटम हैंडओवर डेक में स्कैन करें, फिर 'सुपुर्दगी पूर्ण' पर क्लिक करें।"
  },
  "Active Inspected Item": { en: "Active Inspected Item", hi: "सक्रिय निरीक्षित आइटम" },
  "PACKAGING DAMAGE DETECTED": { en: "PACKAGING DAMAGE DETECTED", hi: "पैकेजिंग क्षति मिली" },
  "BARCODE DAMAGE DETECTED": { en: "BARCODE DAMAGE DETECTED", hi: "बारकोड क्षति मिली" },
  "Mechanical Recovery Action Plan": { en: "Mechanical Recovery Action Plan", hi: "यांत्रिक पुनर्प्राप्ति कार्य योजना" },
  "Follow steps on work deck and log when complete": { en: "Follow steps on work deck and log when complete", hi: "कार्य डेक के चरणों का पालन करें और पूर्ण होने पर दर्ज करें" },
  "RE-PRINT AND APPLY BARCODE LABEL:": { en: "RE-PRINT AND APPLY BARCODE LABEL:", hi: "बारकोड लेबल पुनः प्रिंट करें और लगाएं:" },
  "1. Place the retail item on the scale print surface.": { en: "1. Place the retail item on the scale print surface.", hi: "1. खुदरा आइटम को प्रिंट सतह पर रखें।" },
  "2. Verify SKU is": { en: "2. Verify SKU is", hi: "2. SKU सत्यापित करें:" },
  "3. Click print button on physical printer to generate a clean SKU sticker.": { en: "3. Click print button on physical printer to generate a clean SKU sticker.", hi: "3. साफ SKU स्टिकर बनाने के लिए प्रिंटर का बटन दबाएं।" },
  "4. Carefully inspect and peel the generated barcode, and paste it directly over the damaged LPN barcode spot.": {
    en: "4. Carefully inspect and peel the generated barcode, and paste it directly over the damaged LPN barcode spot.",
    hi: "4. उत्पन्न बारकोड को ध्यान से छीलें और क्षतिग्रस्त LPN बारकोड स्थान पर चिपकाएं।"
  },
  "STRUCTURAL RE-TAP / REPLACEMENT STEPS:": { en: "STRUCTURAL RE-TAP / REPLACEMENT STEPS:", hi: "संरचनात्मक मरम्मत / प्रतिस्थापन चरण:" },
  "1. Inspect structural safety of packaging. Remove dynamic debris.": { en: "1. Inspect structural safety of packaging. Remove dynamic debris.", hi: "1. पैकेजिंग की संरचनात्मक सुरक्षा जांचें। मलबा हटाएं।" },
  "2. Apply industrial transparent tape along standard structural box joints.": { en: "2. Apply industrial transparent tape along standard structural box joints.", hi: "2. डिब्बे के जोड़ों पर औद्योगिक पारदर्शी टेप लगाएं।" },
  "3. If box structure has buckled completely, discard old board and repack into a fresh refurbished box.": {
    en: "3. If box structure has buckled completely, discard old board and repack into a fresh refurbished box.",
    hi: "3. यदि डिब्बा पूरी तरह ध्वस्त हो, तो पुराना बोर्ड हटाएं और नए नवीनीकृत डिब्बे में दोबारा पैक करें।"
  },
  "4. Tick the checkpoint option if a replacement refurbished retail package was used.": {
    en: "4. Tick the checkpoint option if a replacement refurbished retail package was used.",
    hi: "4. यदि नवीनीकृत पैकेज का उपयोग किया हो तो चेकबॉक्स में निशान लगाएं।"
  },
  "Using Refurbished Box": { en: "Using Refurbished Box", hi: "नवीनीकृत डिब्बा उपयोग में है" },
  "Close Monitor": { en: "Close Monitor", hi: "निगरानी बंद करें" },
  "Item Damaged": { en: "Item Damaged", hi: "आइटम क्षतिग्रस्त" },
  "Barcode Changed": { en: "Barcode Changed", hi: "बारकोड बदला गया" },
  "Box Changed": { en: "Box Changed", hi: "डिब्बा बदला गया" },
  "PERSISTING TO SUPABASE...": { en: "PERSISTING TO SUPABASE...", hi: "SUPABASE में सहेजा जा रहा है..." },
  "packaging damage": { en: "packaging damage", hi: "पैकेजिंग क्षति" },
  "barcode damage": { en: "barcode damage", hi: "बारकोड क्षति" },
  "Workstation Standby": { en: "Workstation Standby", hi: "कार्य केंद्र प्रतीक्षारत" },
  "Scan or search for a pending LPN or SKU from your Handed-over Batch here to put it in-progress (yellow) and display instructions.": {
    en: "Scan or search for a pending LPN or SKU from your Handed-over Batch here to put it in-progress (yellow) and display instructions.",
    hi: "प्रगति (पीला) में रखने और निर्देश देखने के लिए सौंपे गए बैच से लंबित LPN या SKU स्कैन करें या खोजें।"
  },
  "Scan / Type LPN or SKU in Batch...": { en: "Scan / Type LPN or SKU in Batch...", hi: "बैच में LPN या SKU स्कैन/टाइप करें..." },
  "ACTIVATE": { en: "ACTIVATE", hi: "सक्रिय करें" },
  "Confirm Item Damaged": { en: "Confirm Item Damaged", hi: "आइटम क्षति की पुष्टि करें" },
  "Are you sure this item is damaged? This action cannot be undone.": {
    en: "Are you sure this item is damaged? This action cannot be undone.",
    hi: "क्या आप सुनिश्चित हैं कि यह आइटम क्षतिग्रस्त है? यह क्रिया वापस नहीं होगी।"
  },
  "Confirm Damaged": { en: "Confirm Damaged", hi: "क्षति की पुष्टि करें" },
  "Unscanned Items Remaining": { en: "Unscanned Items Remaining", hi: "बिना स्कैन किए आइटम शेष हैं" },
  "products left unscanned from the expected recovery pool. Are you sure this is it?": {
    en: "products left unscanned from the expected recovery pool. Are you sure this is it?",
    hi: "उत्पाद अपेक्षित पुनर्प्राप्ति पूल में बिना स्कैन के हैं। क्या आप आगे बढ़ना चाहते हैं?"
  },
  "Note: Selecting \"Yes\" will automatically update the status of those missing/unscanned items to exactly 'missing at recovery'.": {
    en: "Note: Selecting \"Yes\" will automatically update the status of those missing/unscanned items to exactly 'missing at recovery'.",
    hi: "नोट: 'हाँ' चुनने पर बिना स्कैन किए आइटम स्वचालित रूप से 'पुनर्प्राप्ति में लापता' हो जाएंगे।"
  },
  "No, Go Back": { en: "No, Go Back", hi: "नहीं, वापस जाएं" },
  "Yes, This is It": { en: "Yes, This is It", hi: "हाँ, यही सही है" },
  "Item is already in the handover batch. Click 'Handover complete' to unlock physical triaging updates.": {
    en: "Item is already in the handover batch. Click 'Handover complete' to unlock physical triaging updates.",
    hi: "आइटम पहले से बैच में है। भौतिक जांच अपडेट अनलॉक करने के लिए 'सुपुर्दगी पूर्ण' पर क्लिक करें।"
  },
  "Only items with \"recovery\" status can be included in the handover batch. (Current status:": {
    en: "Only items with \"recovery\" status can be included in the handover batch. (Current status:",
    hi: "केवल 'पुनर्प्राप्ति' स्थिति वाले आइटम बैच में शामिल हो सकते हैं। (वर्तमान स्थिति:"
  },
  "Item not found in expected recovery pool": { en: "Item not found in expected recovery pool", hi: "आइटम अपेक्षित पुनर्प्राप्ति पूल में नहीं मिला" },
  "Failed to query database": { en: "Failed to query database", hi: "डेटाबेस क्वेरी विफल रहा" },
  "Scanned: Added": { en: "Scanned: Added", hi: "स्कैन किया: जोड़ा गया" },
  "to hand-over batch.": { en: "to hand-over batch.", hi: "सुपुर्दगी बैच में।" },
  "Loaded": { en: "Loaded", hi: "लोड हो गया" },
  "at active workstation.": { en: "at active workstation.", hi: "सक्रिय कार्य केंद्र पर।" },
  "Item": { en: "Item", hi: "आइटम" },
  "is already recovered.": { en: "is already recovered.", hi: "पहले से पुनर्प्राप्त हो गया है।" },
  "is already marked as damaged.": { en: "is already marked as damaged.", hi: "पहले से क्षतिग्रस्त चिह्नित है।" },
  "Workstation active: Loaded": { en: "Workstation active: Loaded", hi: "कार्य केंद्र सक्रिय: लोड हुआ" },
  "Scanned item is not in the current handover batch. Register it in the Handover Deck first!": {
    en: "Scanned item is not in the current handover batch. Register it in the Handover Deck first!",
    hi: "स्कैन किया आइटम वर्तमान बैच में नहीं है। पहले हैंडओवर डेक में दर्ज करें!"
  },
  "Item successfully recovered! Database synchronized.": { en: "Item successfully recovered! Database synchronized.", hi: "आइटम सफलतापूर्वक पुनर्प्राप्त! डेटाबेस अपडेट हो गया।" },
  "Failed to save recovery parameters to database": { en: "Failed to save recovery parameters to database", hi: "पुनर्प्राप्ति पैरामीटर डेटाबेस में सहेजने में विफल" },
  "marked as DAMAGED. Switched status to 'requires review at recovery'.": {
    en: "marked as DAMAGED. Switched status to 'requires review at recovery'.",
    hi: "क्षतिग्रस्त चिह्नित। स्थिति 'पुनर्प्राप्ति समीक्षा आवश्यक' में बदली।"
  },
  "Failed to save damaged status to database": { en: "Failed to save damaged status to database", hi: "क्षतिग्रस्त स्थिति डेटाबेस में सहेजने में विफल" },
  "Please scan/add at least default hand-over items to the batch before concluding the handover phase!": {
    en: "Please scan/add at least default hand-over items to the batch before concluding the handover phase!",
    hi: "सुपुर्दगी समाप्त करने से पहले कृपया कम से कम डिफ़ॉल्ट आइटम बैच में स्कैन/जोड़ें!"
  },
  "Failed to perform reconciliation check": { en: "Failed to perform reconciliation check", hi: "समन्वय जांच विफल रही" },
  "Handover completed successfully! ACTIVE RECOVERY WORKSTATION MONITOR is now unlocked.": {
    en: "Handover completed successfully! ACTIVE RECOVERY WORKSTATION MONITOR is now unlocked.",
    hi: "सुपुर्दगी सफलतापूर्वक पूर्ण! सक्रिय पुनर्प्राप्ति कार्य केंद्र निगरानी अब अनलॉक हो गई।"
  },
  "Failed to finalize handover status updates": { en: "Failed to finalize handover status updates", hi: "सुपुर्दगी स्थिति अपडेट अंतिम करने में विफल" },

  // ── Language toggle ────────────────────────────────────────────────────────
  "EN": { en: "EN", hi: "EN" },
  "HI": { en: "HI", hi: "HI" },
  "Switch to Hindi": { en: "Switch to Hindi", hi: "हिंदी में जाएं" },
  "Switch to English": { en: "Switch to English", hi: "अंग्रेज़ी में जाएं" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Core translate function
// ─────────────────────────────────────────────────────────────────────────────

export function translate(text: string, lang: PreferredLanguage): string {
  const entry = UI_TRANSLATIONS[text];
  if (!entry) return text;
  return entry[lang] || text;
}

// ─────────────────────────────────────────────────────────────────────────────
// React Context — provides reactive language state across the whole app
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useCallback, ReactNode, createElement } from "react";

interface LangContextValue {
  lang: PreferredLanguage;
  setLang: (l: PreferredLanguage) => void;
  t: (text: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (text) => text,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<PreferredLanguage>(getStoredLanguage);

  const setLang = useCallback((l: PreferredLanguage) => {
    persistLanguage(l);
    setLangState(l);
  }, []);

  const tFn = useCallback((text: string) => translate(text, lang), [lang]);

  return createElement(LangContext.Provider, { value: { lang, setLang, t: tFn } }, children);
}

export function useLanguage(): LangContextValue {
  return useContext(LangContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy non-reactive t() — kept for backwards compatibility.
// Components that call this will NOT re-render on language change.
// Migrate to useLanguage().t() for reactive behaviour.
// ─────────────────────────────────────────────────────────────────────────────

export function getUrlLanguage(): PreferredLanguage {
  return getStoredLanguage();
}

export function t(text: string): string {
  return translate(text, getStoredLanguage());
}
