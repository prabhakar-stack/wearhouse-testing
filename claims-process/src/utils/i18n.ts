export type PreferredLanguage = "en" | "hi";

export function getUrlLanguage(): PreferredLanguage {
  if (typeof window === "undefined") return "en";
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  if (lang === "hi") return "hi";
  
  // Fallback to localStorage
  try {
    const stored = window.localStorage.getItem("preferredLanguage");
    if (stored === "hi") return "hi";
  } catch (e) {}
  
  return "en";
}

const UI_TRANSLATIONS: Record<string, Record<PreferredLanguage, string>> = {
  // Dashboard
  "Total Active Claims": {
    en: "Total Active Claims",
    hi: "कुल सक्रिय दावे"
  },
  "Awaiting Triage": {
    en: "Awaiting Triage",
    hi: "ट्रायेज की प्रतीक्षा में"
  },
  "Recovery Rate": {
    en: "Recovery Rate",
    hi: "रिकवरी दर"
  },
  "Projected Recovery": {
    en: "Projected Recovery",
    hi: "प्रक्षेपित रिकवरी"
  },
  "Executive Overview": {
    en: "Executive Overview",
    hi: "कार्यकारी अवलोकन"
  },
  "Real-time recovery metrics and pipeline status.": {
    en: "Real-time recovery metrics and pipeline status.",
    hi: "वास्तविक समय रिकवरी मेट्रिक्स और पाइपलाइन स्थिति।"
  },
  "Claim Volume Trends": {
    en: "Claim Volume Trends",
    hi: "दावा मात्रा रुझान"
  },
  "Pipeline Breakdown": {
    en: "Pipeline Breakdown",
    hi: "पाइपलाइन विवरण"
  },
  "Initial Handoff": {
    en: "Initial Handoff",
    hi: "प्रारंभिक सौंपना (Handoff)"
  },
  "Triage & Escalation": {
    en: "Triage & Escalation",
    hi: "ट्रायेज और एस्केलेशन"
  },
  "Filing Process": {
    en: "Filing Process",
    hi: "फाइलिंग प्रक्रिया"
  },
  "Reporting": {
    en: "Reporting",
    hi: "रिपोर्टिंग"
  },
  "Manual OTP Required": {
    en: "Manual OTP Required",
    hi: "मैन्युअल ओटीपी आवश्यक"
  },
  "The Amazon Bot encountered an OTP request. Please visit the Smart Filing Hub to assist.": {
    en: "The Amazon Bot encountered an OTP request. Please visit the Smart Filing Hub to assist.",
    hi: "अमेज़ॅन बॉट को एक ओटीपी अनुरोध मिला। कृपया सहायता के लिए स्मार्ट फाइलिंग हब पर जाएं।"
  },
  "RESOLVE NOW": {
    en: "RESOLVE NOW",
    hi: "अभी समाधान करें"
  },
  "[Chart Visualization Area]": {
    en: "[Chart Visualization Area]",
    hi: "[चार्ट विज़ुअलाइज़ेशन क्षेत्र]"
  },
  "30 DAYS": {
    en: "30 DAYS",
    hi: "30 दिन"
  },

  // Triage
  "Triage Queue": {
    en: "Triage Queue",
    hi: "ट्रायेज कतार"
  },
  "Manage and escalate pending inventory claims.": {
    en: "Manage and escalate pending inventory claims.",
    hi: "लंबित इन्वेंट्री दावों का प्रबंधन और समाधान करें।"
  },
  "All": {
    en: "All",
    hi: "सभी"
  },
  "Missing": {
    en: "Missing",
    hi: "गायब (Missing)"
  },
  "Damaged": {
    en: "Damaged",
    hi: "क्षतिग्रस्त"
  },
  "Rejected Delivery": {
    en: "Rejected Delivery",
    hi: "अस्वीकृत डिलीवरी"
  },
  "Filed Claims": {
    en: "Filed Claims",
    hi: "दायर किए गए दावे"
  },
  "Search ID, SKU...": {
    en: "Search ID, SKU...",
    hi: "आईडी, SKU खोजें..."
  },
  "C1: Company & Order": {
    en: "C1: Company & Order",
    hi: "C1: कंपनी और ऑर्डर"
  },
  "C2: Inventory Details": {
    en: "C2: Inventory Details",
    hi: "C2: इन्वेंट्री विवरण"
  },
  "C3: Reason Analysis": {
    en: "C3: Reason Analysis",
    hi: "C3: कारण विश्लेषण"
  },
  "C4: Drive Link": {
    en: "C4: Drive Link",
    hi: "C4: ड्राइव लिंक"
  },
  "C5: SLA / Status": {
    en: "C5: SLA / Status",
    hi: "C5: SLA / स्थिति"
  },
  "C6: Reimbursement": {
    en: "C6: Reimbursement",
    hi: "C6: प्रतिपूर्ति"
  },
  "VIEW EVIDENCE": {
    en: "VIEW EVIDENCE",
    hi: "साक्ष्य देखें"
  },
  "No evidence link": {
    en: "No evidence link",
    hi: "कोई साक्ष्य लिंक नहीं"
  },
  "FILE WITH BOT": {
    en: "FILE WITH BOT",
    hi: "बॉट से फाइल करें"
  },
  "BOT COOLING...": {
    en: "BOT COOLING...",
    hi: "बॉट कूलिंग..."
  },
  "GROUPED QTY:": {
    en: "GROUPED QTY:",
    hi: "सामूहिक मात्रा:"
  },
  "TRK:": {
    en: "TRK:",
    hi: "ट्रैकिंग:"
  },
  "Qty:": {
    en: "Qty:",
    hi: "मात्रा:"
  },
  "Unfiled": {
    en: "Unfiled",
    hi: "फाइल नहीं किया गया"
  },
  "Resolved": {
    en: "Resolved",
    hi: "हल किया गया"
  },
  "Escalated": {
    en: "Escalated",
    hi: "एस्केलेट किया गया"
  },
  "Pending": {
    en: "Pending",
    hi: "लंबित"
  },

  // SmartFiling
  "Smart Filing Hub": {
    en: "Smart Filing Hub",
    hi: "स्मार्ट फाइलिंग हब"
  },
  "Automated Amazon filing bot powered by Playwright.": {
    en: "Automated Amazon filing bot powered by Playwright.",
    hi: "प्लेराइट द्वारा संचालित स्वचालित अमेज़ॅन फाइलिंग बॉट।"
  },
  "Bot Health": {
    en: "Bot Health",
    hi: "बॉट स्वास्थ्य"
  },
  "REFRESH QUEUE": {
    en: "REFRESH QUEUE",
    hi: "कतार रीफ्रेश करें"
  },
  "Live Bot Monitor": {
    en: "Live Bot Monitor",
    hi: "लाइव बॉट मॉनिटर"
  },
  "Showing browser workspace...": {
    en: "Showing browser workspace...",
    hi: "ब्राउज़र कार्यक्षेत्र दिखा रहा है..."
  },
  "Encrypted Stream": {
    en: "Encrypted Stream",
    hi: "एन्क्रिप्टेड स्ट्रीम"
  },
  "Active Automation Queue": {
    en: "Active Automation Queue",
    hi: "सक्रिय स्वचालन कतार"
  },
  "No active or recent automated tasks found.": {
    en: "No active or recent automated tasks found.",
    hi: "कोई सक्रिय या हालिया स्वचालित कार्य नहीं मिले।"
  },
  "Trigger a filing from the Triage Queue to see logs here.": {
    en: "Trigger a filing from the Triage Queue to see logs here.",
    hi: "यहां लॉग देखने के लिए ट्रायेज कतार से फाइलिंग ट्रिगर करें।"
  },
  "BOT BUSY": {
    en: "BOT BUSY",
    hi: "बॉट व्यस्त"
  },
  "COOLING": {
    en: "COOLING",
    hi: "कूलिंग"
  },
  "RUN FILING": {
    en: "RUN FILING",
    hi: "फाइलिंग शुरू करें"
  },
  "Bot Execution Logs": {
    en: "Bot Execution Logs",
    hi: "बॉट निष्पादन लॉग"
  },
  "Bot Configuration": {
    en: "Bot Configuration",
    hi: "बॉट कॉन्फ़िगरेशन"
  },
  "READY": {
    en: "READY",
    hi: "तैयार"
  },
  "SETUP REQUIRED": {
    en: "SETUP REQUIRED",
    hi: "सेटअप आवश्यक"
  },
  "Target Account": {
    en: "Target Account",
    hi: "लक्षित खाता"
  },
  "TOTP Secret": {
    en: "TOTP Secret",
    hi: "TOTP सीक्रेट"
  },
  "Headless Mode": {
    en: "Headless Mode",
    hi: "हेडलेस मोड"
  },
  "Manual Test Trigger": {
    en: "Manual Test Trigger",
    hi: "मैन्युअल टेस्ट ट्रिगर"
  },
  "Amazon Order ID / Tracking ID / LPN": {
    en: "Amazon Order ID / Tracking ID / LPN",
    hi: "अमेज़न ऑर्डर आईडी / ट्रैकिंग आईडी / LPN"
  },
  "RUN TEST": {
    en: "RUN TEST",
    hi: "परीक्षण चलाएं"
  },
  "Security Notice": {
    en: "Security Notice",
    hi: "सुरक्षा सूचना"
  },
  "Bot actions are recorded for audit purposes. Ensure your TOTP secret is stored in encrypted environment variables before production.": {
    en: "Bot actions are recorded for audit purposes. Ensure your TOTP secret is stored in encrypted environment variables before production.",
    hi: "बॉट कार्यों को ऑडिट उद्देश्यों के लिए रिकॉर्ड किया जाता है। उत्पादन से पहले सुनिश्चित करें कि आपका TOTP सीक्रेट एन्क्रिप्टेड पर्यावरण चर में संग्रहीत है।"
  },
  "Validation Complete. All shipment items are marked as 'Inspected'. Ready for SAFE-T filing.": {
    en: "Validation Complete. All shipment items are marked as 'Inspected'. Ready for SAFE-T filing.",
    hi: "सत्यापन पूर्ण। सभी शिपमेंट आइटम 'निरीक्षण किए गए' के रूप में चिह्नित हैं। SAFE-T फाइलिंग के लिए तैयार।"
  },
  "Rejected Delivery detected. Ready for automatic SAFE-T filing.": {
    en: "Rejected Delivery detected. Ready for automatic SAFE-T filing.",
    hi: "अस्वीकृत डिलीवरी का पता चला। स्वचालित SAFE-T फाइलिंग के लिए तैयार।"
  },

  // QCAudit
  "compliance and qc audit": {
    en: "compliance and qc audit",
    hi: "अनुपालन और क्यूसी ऑडिट"
  },
  "Defensive monitor designed to prevent incorrect inventory categorizations and packaging mix-ups on re-inventorisation.": {
    en: "Defensive monitor designed to prevent incorrect inventory categorizations and packaging mix-ups on re-inventorisation.",
    hi: "पुनः इन्वेंटराइजेशन पर गलत वर्गीकरण और पैकेजिंग की गड़बड़ी को रोकने के लिए बनाया गया सुरक्षात्मक मॉनिटर।"
  },
  "Synchronize Datasets": {
    en: "Synchronize Datasets",
    hi: "डेटासेट सिंक्रोनाइज़ करें"
  },
  "Process 01": {
    en: "Process 01",
    hi: "प्रक्रिया 01"
  },
  "SKU Handover Process": {
    en: "SKU Handover Process",
    hi: "SKU हैंडओवर प्रक्रिया"
  },
  "Scan physical barcodes to track counted numbers under strict blind verification boundaries.": {
    en: "Scan physical barcodes to track counted numbers under strict blind verification boundaries.",
    hi: "सख्त ब्लाइंड सत्यापन सीमाओं के तहत गिने गए नंबरों को ट्रैक करने के लिए भौतिक बारकोड को स्कैन करें।"
  },
  "Batch Overview": {
    en: "Batch Overview",
    hi: "बैच अवलोकन"
  },
  "Active SKU checklist under audit": {
    en: "Active SKU checklist under audit",
    hi: "ऑडिट के तहत सक्रिय SKU चेकलिस्ट"
  },
  "No SKUs loaded in handover": {
    en: "No SKUs loaded in handover",
    hi: "हैंडओवर में कोई SKU लोड नहीं है"
  },
  "Active QC Monitor": {
    en: "Active QC Monitor",
    hi: "सक्रिय क्यूसी मॉनिटर"
  },
  "Active scan validation workstation desk": {
    en: "Active scan validation workstation desk",
    hi: "सक्रिय स्कैन सत्यापन वर्कस्टेशन डेस्क"
  },
  "Scan / Register Hard Label": {
    en: "Scan / Register Hard Label",
    hi: "हार्ड लेबल स्कैन / पंजीकृत करें"
  },
  "Laser-scan or code-type SKU barcode...": {
    en: "Laser-scan or code-type SKU barcode...",
    hi: "लेज़र-स्कैन या कोड-टाइप SKU बारकोड..."
  },
  "Verify Scan": {
    en: "Verify Scan",
    hi: "स्कैन सत्यापित करें"
  },
  "Active Workstation Action Deck": {
    en: "Active Workstation Action Deck",
    hi: "सक्रिय वर्कस्टेशन एक्शन डेक"
  },
  "Selected Active SKU": {
    en: "Selected Active SKU",
    hi: "चयनित सक्रिय SKU"
  },
  "WIP Checked Focus": {
    en: "WIP Checked Focus",
    hi: "कार्य प्रगति पर (WIP) फोकस"
  },
  "Perform visual inspection inside the physical container. If product, container packaging, or barcode labels suffer retail damage flag here.": {
    en: "Perform visual inspection inside the physical container. If product, container packaging, or barcode labels suffer retail damage flag here.",
    hi: "भौतिक कंटेनर के अंदर दृश्य निरीक्षण करें। यदि उत्पाद, पैकेजिंग, या बारकोड लेबल क्षतिग्रस्त हैं तो यहां ध्वजांकित करें।"
  },
  "Flag SKU as Damaged": {
    en: "Flag SKU as Damaged",
    hi: "SKU को क्षतिग्रस्त ध्वजांकित करें"
  },
  "Handover Complete": {
    en: "Handover Complete",
    hi: "हैंडओवर पूर्ण"
  },
  "Confirm Integrity Violation?": {
    en: "Confirm Integrity Violation?",
    hi: "क्या आप अखंडता उल्लंघन की पुष्टि करते हैं?"
  },
  "Cancel": {
    en: "Cancel",
    hi: "रद्द करें"
  },
  "Yes, Flag Damage": {
    en: "Yes, Flag Damage",
    hi: "हाँ, क्षति ध्वजांकित करें"
  },
  "Confirm Discrepancy Bypass?": {
    en: "Confirm Discrepancy Bypass?",
    hi: "क्या विसंगति बायपास की पुष्टि करते हैं?"
  },
  "Cancel & Count": {
    en: "Cancel & Count",
    hi: "रद्द करें और गिनें"
  },
  "Yes, Proceed": {
    en: "Yes, Proceed",
    hi: "हाँ, आगे बढ़ें"
  },
  "Process 02": {
    en: "Process 02",
    hi: "प्रक्रिया 02"
  },
  "Recovery Integrity Check": {
    en: "Recovery Integrity Check",
    hi: "रिकवरी अखंडता जांच"
  },
  "Detect mismatched packaging types. Flag items that are wrapped in standard retail packaging, even though they should use custom refurbished materials.": {
    en: "Detect mismatched packaging types. Flag items that are wrapped in standard retail packaging, even though they should use custom refurbished materials.",
    hi: "गलत पैकेजिंग प्रकारों का पता लगाएं। उन वस्तुओं को ध्वजांकित करें जो मानक खुदरा पैकेजिंग में लिपटे हैं, भले ही उन्हें कस्टम नवीनीकृत (refurbished) सामग्रियों का उपयोग करना चाहिए।"
  },
  "LPN Identifier": {
    en: "LPN Identifier",
    hi: "LPN पहचानकर्ता"
  },
  "SKU Code": {
    en: "SKU Code",
    hi: "SKU कोड"
  },
  "Damage Profile": {
    en: "Damage Profile",
    hi: "क्षति प्रोफ़ाइल"
  },
  "Packaging Box Check": {
    en: "Packaging Box Check",
    hi: "package बॉक्स जांच"
  },
  "Audit Status": {
    en: "Audit Status",
    hi: "ऑडिट स्थिति"
  },
  "Actions": {
    en: "Actions",
    hi: "कार्रवाई"
  },
  "Original Box Detected": {
    en: "Original Box Detected",
    hi: "मूल बॉक्स का पता चला"
  },
  "Refurbished Packaging OK": {
    en: "Refurbished Packaging OK",
    hi: "नवीनीकृत (Refurbished) पैकेजिंग ठीक"
  },
  "Requires Recovery Review": {
    en: "Requires Recovery Review",
    hi: "रिकवरी समीक्षा आवश्यक"
  },
  "Process 03": {
    en: "Process 03",
    hi: "प्रक्रिया 03"
  },
  "Rejected Claims Verification": {
    en: "Rejected Claims Verification",
    hi: "अस्वीकृत दावों का सत्यापन"
  },
  "Audit case decisions directly. Expand items to inspect drive evidence photos inline and make corrective routing updates.": {
    en: "Audit case decisions directly. Expand items to inspect drive evidence photos inline and make corrective routing updates.",
    hi: "केस के निर्णयों का सीधे ऑडिट करें। इनलाइन ड्राइव साक्ष्य फ़ोटो का निरीक्षण करने और सुधारात्मक रूटिंग अपडेट करने के लिए आइटमों का विस्तार करें।"
  },
  "Embedded Evidence Explorer (Drive Document)": {
    en: "Embedded Evidence Explorer (Drive Document)",
    hi: "एम्बेडेड साक्ष्य एक्सप्लोरर (ड्राइव दस्तावेज़)"
  },
  "Open in New Tab": {
    en: "Open in New Tab",
    hi: "नए टैब में खोलें"
  },
  "Automation System Failure Reason": {
    en: "Automation System Failure Reason",
    hi: "स्वचालन प्रणाली विफलता का कारण"
  },

  // RecoveryHub
  "Beta Module": {
    en: "Beta Module",
    hi: "बीटा मॉड्यूल"
  },
  "Claims Administration Panel": {
    en: "Claims Administration Panel",
    hi: "दावा प्रशासन पैनल"
  },
  "Recovery Hub Workstation": {
    en: "Recovery Hub Workstation",
    hi: "रिकवरी हब वर्कस्टेशन"
  },
  "Perform physical refurbishment triage of items suffering from retail damage state.": {
    en: "Perform physical refurbishment triage of items suffering from retail damage state.",
    hi: "खुदरा क्षति स्थिति से पीड़ित वस्तुओं का भौतिक नवीनीकरण ट्रायेज करें।"
  },
  "SUPABASE LIVE": {
    en: "SUPABASE LIVE",
    hi: "सुपर्बेस लाइव"
  },
  "BARCODE & BOX SCANNING WORKSTATION DECK": {
    en: "BARCODE & BOX SCANNING WORKSTATION DECK",
    hi: "बारकोड और बॉक्स स्कैनिंग वर्कस्टेशन डेक"
  },
  "Scan/Type LPN Barcode (e.g., LPN001) or SKU item (e.g., 1120100)...": {
    en: "Scan/Type LPN Barcode (e.g., LPN001) or SKU item (e.g., 1120100)...",
    hi: "LPN बारकोड (जैसे, LPN001) या SKU आइटम (जैसे, 1120100) स्कैन/टाइप करें..."
  },
  "SUBMIT SCAN": {
    en: "SUBMIT SCAN",
    hi: "स्कैन सबमिट करें"
  },
  "HANDED OVER BATCH": {
    en: "HANDED OVER BATCH",
    hi: "सौंपा गया बैच"
  },
  "Buffered scans for workstation triage": {
    en: "Buffered scans for workstation triage",
    hi: "वर्कस्टेशन ट्रायेज के लिए बफर स्कैन"
  },
  "Batch is currently empty": {
    en: "Batch is currently empty",
    hi: "बैच वर्तमान में खाली है"
  },
  "Scan identifiers above to build the current active batch schedule.": {
    en: "Scan identifiers above to build the current active batch schedule.",
    hi: "वर्तमान सक्रिय बैच शेड्यूल बनाने के लिए ऊपर पहचानकर्ताओं को स्कैन करें।"
  },
  "ACTIVE RECOVERY WORKSTATION MONITOR": {
    en: "ACTIVE RECOVERY WORKSTATION MONITOR",
    hi: "सक्रिय रिकवरी वर्कस्टेशन मॉनिटर"
  },
  "Interactive mechanical instructions & update persistence deck": {
    en: "Interactive mechanical instructions & update persistence deck",
    hi: "इंटरैक्टिव यांत्रिक निर्देश और अपडेट स्थिरता डेक"
  },
  "MONITOR LOCKED": {
    en: "MONITOR LOCKED",
    hi: "मॉनिटर लॉक है"
  },
  "The active triage monitor is offline. Scan received items into the Handover Deck first, then click \"Handover complete\" to enable the workstation triaging monitor.": {
    en: "The active triage monitor is offline. Scan received items into the Handover Deck first, then click \"Handover complete\" to enable the workstation triaging monitor.",
    hi: "सक्रिय ट्रायेज मॉनिटर ऑफ़लाइन है। पहले प्राप्त वस्तुओं को हैंडओवर डेक में स्कैन करें, फिर वर्कस्टेशन ट्रायेज मॉनिटर को सक्षम करने के लिए \"हैंडओवर पूर्ण\" पर क्लिक करें।"
  },
  "Mechanical Recovery Action Plan": {
    en: "Mechanical Recovery Action Plan",
    hi: "यांत्रिक रिकवरी कार्य योजना"
  },
  "Follow steps on work deck and log when complete": {
    en: "Follow steps on work deck and log when complete",
    hi: "कार्य डेक पर चरणों का पालन करें और पूर्ण होने पर लॉग करें"
  },
  "RE-PRINT AND APPLY BARCODE LABEL:": {
    en: "RE-PRINT AND APPLY BARCODE LABEL:",
    hi: "बारकोड लेबल को दोबारा प्रिंट करें और लगाएं:"
  },
  "STRUCTURAL RE-TAP / REPLACEMENT STEPS:": {
    en: "STRUCTURAL RE-TAP / REPLACEMENT STEPS:",
    hi: "संरचनात्मक री-टैप / प्रतिस्थापन चरण:"
  },
  "Using Refurbished Box": {
    en: "Using Refurbished Box",
    hi: "नवीनीकृत (Refurbished) बॉक्स का उपयोग करना"
  },
  "Close Monitor": {
    en: "Close Monitor",
    hi: "मॉनिटर बंद करें"
  },
  "Item Damaged": {
    en: "Item Damaged",
    hi: "आइटम क्षतिग्रस्त"
  },
  "Barcode Changed": {
    en: "Barcode Changed",
    hi: "बारकोड बदला गया"
  },
  "Box Changed": {
    en: "Box Changed",
    hi: "बॉक्स बदला गया"
  },
  "Workstation Standby": {
    en: "Workstation Standby",
    hi: "वर्कस्टेशन स्टैंडबाय"
  },
  "Scan or search for a pending LPN or SKU from your Handed-over Batch here to put it in-progress (yellow) and display instructions.": {
    en: "Scan or search for a pending LPN or SKU from your Handed-over Batch here to put it in-progress (yellow) and display instructions.",
    hi: "yellow में प्रगति पर रखने और निर्देश प्रदर्शित करने के लिए अपने सौंपे गए बैच से लंबित LPN या SKU को स्कैन या खोजें।"
  },
  "Scan / Type LPN or SKU in Batch...": {
    en: "Scan / Type LPN or SKU in Batch...",
    hi: "बैच में LPN या SKU स्कैन / टाइप करें..."
  },
  "ACTIVATE": {
    en: "ACTIVATE",
    hi: "सक्रिय करें"
  },
  "Confirm Item Damaged": {
    en: "Confirm Item Damaged",
    hi: "आइटम क्षतिग्रस्त होने की पुष्टि करें"
  },
  "Are you sure this item is damaged? This action cannot be undone.": {
    en: "Are you sure this item is damaged? This action cannot be undone.",
    hi: "क्या आप सुनिश्चित हैं कि यह आइटम क्षतिग्रस्त है? इस कार्रवाई को वापस नहीं लिया जा सकता।"
  },
  "Confirm Damaged": {
    en: "Confirm Damaged",
    hi: "क्षतिग्रस्त होने की पुष्टि करें"
  },
  "Unscanned Items Remaining": {
    en: "Unscanned Items Remaining",
    hi: "बिना स्कैन किए गए आइटम शेष"
  },
  "No, Go Back": {
    en: "No, Go Back",
    hi: "नहीं, वापस जाएं"
  },
  "Yes, This is It": {
    en: "Yes, This is It",
    hi: "हाँ, यही है"
  }
};

export function translate(text: string, lang: PreferredLanguage): string {
  const entry = UI_TRANSLATIONS[text];
  if (!entry) return text;
  return entry[lang] || text;
}

export function t(text: string): string {
  const lang = getUrlLanguage();
  return translate(text, lang);
}
