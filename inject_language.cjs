const fs = require('fs');
const path = 'app/receiver/ReceiverDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Imports
if (!content.includes('LanguagePreference')) {
  content = content.replace(
    'import Image from "next/image";',
    `import Image from "next/image";\nimport LanguagePreference from "@/app/components/LanguagePreference";\nimport { getStoredLanguage, translateInstruction } from "@/lib/i18n";`
  );
}

// 2. Add State and Helpers
const targetState = `const [userData, setUserData] = useState<any>(null);`;
if (!content.includes('const [preferredLanguage')) {
  const newHook = `
  const [preferredLanguage, setPreferredLanguage] = useState("en");

  useEffect(() => {
    setPreferredLanguage(getStoredLanguage());
    const syncLanguage = () => setPreferredLanguage(getStoredLanguage());
    window.addEventListener("preferred-language-changed", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("preferred-language-changed", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  const t = (text: string) => translateInstruction(text, preferredLanguage);
  const tt = (en: string, hi: string) => preferredLanguage === "hi" ? hi : en;
`;
  content = content.replace(targetState, targetState + newHook);
}

// 3. Add to UI Profile section
const targetUI = `                )}
                <p className="text-[10px] text-slate-400 text-center font-medium pt-1">
                  Profile is read-only`;
                  
if (!content.includes('<LanguagePreference />')) {
  content = content.replace(targetUI, `                )}\n                <LanguagePreference />\n                <p className="text-[10px] text-slate-400 text-center font-medium pt-1">\n                  Profile is read-only`);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Language toggle restored cleanly!');
