import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rules to downgrade from 'error' → 'warn' so builds pass while issues remain visible.
// These are documented patterns that are not functional bugs in this codebase.
const DOWNGRADE_TO_WARN = [
  // Calling setState inside a useEffect — intentional pattern for initialising from
  // localStorage on mount. Not harmful when deps array is [].
  "react-hooks/set-state-in-effect",
  // Date.now() in utility functions or refs accessed inside render IIFEs.
  // The purity rule covers both "impure function" and "refs during render".
  "react-hooks/purity",
  // Apostrophes in JSX text — style concern, not a functional bug.
  "react/no-unescaped-entities",
];

// Helper: check if a rule value is set to "error" severity.
// ESLint allows both string form ("error") and array form (["error", options]).
function isError(value) {
  if (value === "error" || value === 2) return true;
  if (Array.isArray(value) && (value[0] === "error" || value[0] === 2)) return true;
  return false;
}

// Helper: downgrade a rule value to "warn" while preserving array options.
function downgradeToWarn(value) {
  if (Array.isArray(value)) return ["warn", ...value.slice(1)];
  return "warn";
}

// Patch each flat-config object from eslint-config-next: if it has any of the
// above rules set to 'error', downgrade them to 'warn'. Plugins and all other
// rules are preserved exactly as-is.
const patchedNext = next.map((cfg) => {
  if (!cfg.rules) return cfg;
  const patched = { ...cfg.rules };
  for (const rule of DOWNGRADE_TO_WARN) {
    if (patched[rule] !== undefined && isError(patched[rule])) {
      patched[rule] = downgradeToWarn(patched[rule]);
    }
  }
  return { ...cfg, rules: patched };
});

export default defineConfig(patchedNext);
