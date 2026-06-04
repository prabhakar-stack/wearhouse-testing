const fs = require('fs');

const path = 'app/inspector/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. LedgerTab changes:
// Pass preferredLanguage as prop
content = content.replace('function LedgerTab() {', 'function LedgerTab({ preferredLanguage = "en" }: { preferredLanguage?: string }) {\n  const t = (text: string) => translateInstruction(text, preferredLanguage as any);');
content = content.replace('My Custody Ledger', '{t("My Custody Ledger")}');
content = content.replace('{ledger.length} PENDING', '{ledger.length} {t("PENDING")}');
content = content.replace('Syncing Custody Ledger...', '{t("Syncing Custody Ledger...")}');
content = content.replace('No Pending Inspections', '{t("No Pending Inspections")}');
content = content.replace('You have no active taken packages. Proceed to Takeover to pull from\n            Receiver.', '{t("You have no active taken packages. Proceed to Takeover to pull from Receiver.")}');
content = content.replace('IN PROGRESS', '{t("IN PROGRESS")}');
content = content.replace('PENDING\n                    </span>', '{t("PENDING")}\n                    </span>');
content = content.replace('Items Scanned', '{t("Items Scanned")}');
content = content.replace('Taken:{" "}', '{t("Taken:")}{" "}');

// 2. TakeoverTab changes:
// Pass preferredLanguage as prop
content = content.replace('function TakeoverTab() {', 'function TakeoverTab({ preferredLanguage = "en" }: { preferredLanguage?: string }) {\n  const t = (text: string) => translateInstruction(text, preferredLanguage as any);');
content = content.replace('setError(data.error || "Takeover failed");', 'setError(t(data.error || "Takeover failed"));');
content = content.replace('setError(err.message || "Network error");', 'setError(t(err.message || "Network error"));');
content = content.replace('Custody Transferred', '{t("Custody Transferred")}');
content = content.replace('Successfully!', '{t("Successfully!")}');
content = content.replace('Tracking ID: ', '{t("Tracking ID:")} ');
content = content.replace('Items to Inspect: ', '{t("Items to Inspect:")} ');
content = content.replace('Mechanical Handshake', '{t("Mechanical Handshake")}');
content = content.replace('Scan Box from Receiver', '{t("Scan Box from Receiver")}');
content = content.replace('placeholder="ENTER TRACKING ID..."', 'placeholder={t("ENTER TRACKING ID...")}');
content = content.replace('Confirm Takeover', '{t("Confirm Takeover")}');

// 3. InspectTab changes (mostly HUD and text blocks):
content = content.replace('Scan Order ID\n            </h2>', '{t("Scan Order ID")}\n            </h2>');
content = content.replace('To Begin Continuous Evidence\n            </p>', '{t("To Begin Continuous Evidence")}\n            </p>');
content = content.replace('placeholder="ENTER ORDER ID..."', 'placeholder={t("ENTER ORDER ID...")}');
content = content.replace('Initialize', '{t("Initialize")}');
content = content.replace('Phase 1', '{t("Phase 1")}');
content = content.replace('Box Evidence\n              </h2>', '{t("Box Evidence")}\n              </h2>');
content = content.replace('Phase 2', '{t("Phase 2")}');
content = content.replace('Product Verification\n                </h2>', '{t("Product Verification")}\n                </h2>');
content = content.replace('Items Processed\n                </p>', '{t("Items Processed")}\n                </p>');
content = content.replace('Items Processed\n                </p>', '{t("Items Processed")}\n                </p>'); // twice
content = content.replace('Authentication error. Please log in again.', 't("Authentication error. Please log in again.")');
content = content.replace('This Order ID / Tracking ID is not found in the system.', 't("This Order ID / Tracking ID is not found in the system.")');
content = content.replace('This package is not active in your inspection stack. Take custody from the receiver before scanning.', 't("This package is not active in your inspection stack. Take custody from the receiver before scanning.")');
content = content.replace('This package has already been inspected.', 't("This package has already been inspected.")');
content = content.replace('This tracking ID contains multiple orders. Please scan the exact Order ID before inspection.', 't("This tracking ID contains multiple orders. Please scan the exact Order ID before inspection.")');
content = content.replace('Failed to verify custody. Please try again.', 't("Failed to verify custody. Please try again.")');
content = content.replace('Scan or type the LPN before continuing.', 't("Scan or type the LPN before continuing.")');
content = content.replace('This LPN has already been scanned for this order.', 't("This LPN has already been scanned for this order.")');
content = content.replace('LPN validation failed.', 't("LPN validation failed.")');
content = content.replace('Connection error while validating LPN.', 't("Connection error while validating LPN.")');
content = content.replace('`This item (FNSKU: ${resolvedFnsku}) is not expected in this removal order.`', 't(`This item (FNSKU: ${resolvedFnsku}) is not expected in this removal order.`)');
content = content.replace('`All expected units of this item (FNSKU: ${resolvedFnsku}) have already been scanned.`', 't(`All expected units of this item (FNSKU: ${resolvedFnsku}) have already been scanned.`)');
content = content.replace('REC &bull; Continuous Evidence', '{t("REC • Continuous Evidence")}');
content = content.replace('BOX AREA', '{t("BOX AREA")}');
content = content.replace('ITEM AREA', '{t("ITEM AREA")}');
content = content.replace('HUD Visual Assist Active', '{t("HUD Visual Assist Active")}');
content = content.replace('Reference Sample', '{t("Reference Sample")}');
content = content.replace('Next Rotation &rarr;', '{t("Next Rotation →")}');
content = content.replace('Capture Image', '{t("Capture Image")}');
content = content.replace('SHOPIFY REFERENCE', '{t("SHOPIFY REFERENCE")}');
content = content.replace('RECEIVED ITEM', '{t("RECEIVED ITEM")}');

// Translate the CLAIM_REASONS array:
content = content.replace('label: "1. I received damaged/ used item(s)"', 'label: t("1. I received damaged/ used item(s)")');
content = content.replace('label: "a. Item(s) heavily damaged"', 'label: t("a. Item(s) heavily damaged")');
content = content.replace('label: "b. Item(s) with minor damages/dents/scratches"', 'label: t("b. Item(s) with minor damages/dents/scratches")');
content = content.replace('label: "c. Only product packaging damaged"', 'label: t("c. Only product packaging damaged")');
content = content.replace('label: "2. I received different item or empty box"', 'label: t("2. I received different item or empty box")');
content = content.replace('label: "a. Different/junk item received"', 'label: t("a. Different/junk item received")');
content = content.replace('label: "b. Empty box received"', 'label: t("b. Empty box received")');
content = content.replace('label: "c. Fake/ replica/ counterfeit item received"', 'label: t("c. Fake/ replica/ counterfeit item received")');

// 4. Pass props to child tabs in InspectorDashboard component
content = content.replace('{activeTab === "ledger" && <LedgerTab />}', '{activeTab === "ledger" && <LedgerTab preferredLanguage={preferredLanguage} />}');
content = content.replace('{activeTab === "takeover" && <TakeoverTab />}', '{activeTab === "takeover" && <TakeoverTab preferredLanguage={preferredLanguage} />}');

// Save changes
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully wrapped Inspector dashboard tabs in t() translations!');
