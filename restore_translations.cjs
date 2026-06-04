const fs = require('fs');
const path = 'app/receiver/ReceiverDashboard.tsx';
let content = fs.readFileSync(path, 'utf16le'); // Read as UTF-16 if it's encoded weirdly
if (!content.includes('import')) {
  content = fs.readFileSync(path, 'utf8');
}

// Ensure the helper functions exist in the component if not already there
// We already added it to ReceiverDashboard, but what about the sub-tabs?
const tabs = ['ExpectedTab', 'AlertsTab', 'ReceiveTab', 'LedgerTab'];
tabs.forEach(tab => {
  const funcDecl = `function ${tab}(`;
  if (content.includes(funcDecl) && !content.includes(`function ${tab}(` + `\n  const preferredLanguage`)) {
    content = content.replace(funcDecl, `function ${tab}(props) {\n  const { preferredLanguage = getStoredLanguage() } = props || {};\n  const t = (text) => translateInstruction(text, preferredLanguage);\n  const tt = (en, hi) => preferredLanguage === "hi" ? hi : en;\n  // `);
  }
});

// Replace strings they had translated
const pairs = [
  ['"All Clear — No Pending Alerts"', '{tt("All Clear — No Pending Alerts", "सब ठीक है — कोई लंबित अलर्ट नहीं")}'],
  ['"All Clear"', '{tt("All Clear", "सब ठीक है")}'],
  ['"Items Received"', '{tt("Items Received", "प्राप्त आइटम")}'],
  ['"Accuracy Rate"', '{tt("Accuracy Rate", "सटीकता दर")}'],
  ['"Profile is read-only · Contact Admin to update details."', '{tt("Profile is read-only · Contact Admin to update details.", "प्रोफाइल केवल पढ़ने के लिए है. विवरण अपडेट करने के लिए एडमिन से संपर्क करें.")}'],
  ['"Switch to Super Access Role"', '{tt("Switch to Super Access Role", "सुपर एक्सेस भूमिका पर जाएं")}'],
  ['"Switch to Admin Role"', '{tt("Switch to Admin Role", "एडमिन भूमिका पर जाएं")}'],
  ['"Expected Today"', '{tt("Expected Today", "आज अपेक्षित")}'],
  ['"INBOUND"', '{tt("INBOUND", "इनबाउंड")}'],
  ['"Syncing Inbound Ledger..."', '{tt("Syncing Inbound Ledger...", "इनबाउंड लेजर सिंक हो रहा है...")}']
];

pairs.forEach(([en, hi]) => {
  content = content.split(en).join(hi);
});

fs.writeFileSync(path, content, 'utf8');
console.log('Restored translations.');
