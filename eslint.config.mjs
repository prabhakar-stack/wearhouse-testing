import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

const DOWNGRADE_TO_WARN = ["react-hooks/set-state-in-effect", "react-hooks/purity", "react/no-unescaped-entities"];

function isError(value) {
  if (value === "error" || value === 2) return true;
  if (Array.isArray(value) && (value[0] === "error" || value[0] === 2)) return true;
  return false;
}

function downgradeToWarn(value) {
  if (Array.isArray(value)) return ["warn", ...value.slice(1)];
  return "warn";
}

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

export default defineConfig([
  {
    ignores: ["**/dist/**","**/.next/**","**/node_modules/**","**/scratch/**","**/uploads/**","**/failed_uploads/**"],
  },
  ...patchedNext
]);
