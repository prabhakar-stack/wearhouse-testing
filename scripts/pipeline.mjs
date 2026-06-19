#!/usr/bin/env node
// Warehouse data pipeline runner.
// Usage:
//   node scripts/pipeline.mjs                  run all steps in order
//   node scripts/pipeline.mjs <step-key>       run a single step  e.g. amazon-fetch
//   node scripts/pipeline.mjs <group>          run a group        e.g. amazon | smarthub | shopify | tracking
//   node scripts/pipeline.mjs --help

import 'dotenv/config';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline definition — steps run in this exact order when all are selected.
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    key: 'amazon-fetch',
    group: 'amazon',
    label: 'Amazon B2B — Fetch from SP-API → staging tables',
    cmd: 'node scripts/fetch_returns_to_supabase.js',
  },
  {
    key: 'amazon-stage',
    group: 'amazon',
    label: 'Amazon B2B — Stage → Manifest, Order, ReturnItem, Reimbursement',
    cmd: 'node scripts/sync_amz_raw_to_core.js',
  },
  {
    key: 'smarthub-download',
    group: 'smarthub',
    label: 'SmartHub B2C — Download returns CSV via Playwright',
    cmd: 'node scripts/download_smarthub_csv.js',
    note: 'Requires a saved Playwright session — run save_smarthub_session.js once first.',
    optional: true,
  },
  {
    key: 'smarthub-push',
    group: 'smarthub',
    label: 'SmartHub B2C — Push CSV → AMAZON_B2C_SMARTHUB staging table',
    cmd: 'node scripts/push_smarthub_csv_to_supabase.js',
    requires: 'smarthub-download',
  },
  {
    key: 'shopify',
    group: 'shopify',
    label: 'Shopify — Sync returns',
    cmd: 'npx ts-node --esm scripts/run_shopify_returns_sync.ts',
  },
  {
    key: 'tracking',
    group: 'tracking',
    label: 'Tracking — Refresh expected-package tracking states',
    cmd: 'npx ts-node --esm scripts/run_tracking_job.ts',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const hr = (char = '─', n = 64) => char.repeat(n);

function run(step) {
  console.log(`\n${hr()}`);
  console.log(`▶  ${step.label}`);
  console.log(`   $ ${step.cmd}`);
  if (step.note) console.log(`   ⚠  ${step.note}`);
  console.log(hr());

  const start = Date.now();
  try {
    execSync(step.cmd, { stdio: 'inherit', cwd: ROOT });
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅  Done — ${secs}s`);
  } catch (err) {
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\n❌  FAILED after ${secs}s (exit code: ${err.status ?? '?'})`);
    throw err;
  }
}

function printHelp() {
  console.log(`\nUsage:`);
  console.log(`  node scripts/pipeline.mjs            run all ${STEPS.length} steps in order`);
  console.log(`  node scripts/pipeline.mjs <step>     run one step by key`);
  console.log(`  node scripts/pipeline.mjs <group>    run all steps in a group`);
  console.log(`  node scripts/pipeline.mjs --help     show this message`);

  console.log(`\nSteps (in pipeline order):`);
  STEPS.forEach(s =>
    console.log(`  ${s.key.padEnd(22)} [${s.group.padEnd(8)}]  ${s.label}`)
  );

  const groups = [...new Set(STEPS.map(s => s.group))];
  console.log(`\nGroups:`);
  groups.forEach(g => {
    const keys = STEPS.filter(s => s.group === g).map(s => s.key).join(', ');
    console.log(`  ${g.padEnd(12)}  → ${keys}`);
  });

  console.log(`\nExamples:`);
  console.log(`  npm run pipeline                      # full pipeline`);
  console.log(`  npm run pipeline -- amazon            # B2B only`);
  console.log(`  npm run pipeline -- smarthub          # B2C only`);
  console.log(`  npm run pipeline -- amazon-fetch      # one step`);
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument resolution
// ─────────────────────────────────────────────────────────────────────────────
const arg = process.argv[2];

if (arg === '--help' || arg === '-h') {
  printHelp();
  process.exit(0);
}

let stepsToRun;
if (!arg || arg === 'all') {
  stepsToRun = STEPS;
} else {
  stepsToRun = STEPS.filter(s => s.key === arg || s.group === arg);
  if (stepsToRun.length === 0) {
    console.error(`\nUnknown step or group: "${arg}"`);
    printHelp();
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${hr('═')}`);
console.log(`WAREHOUSE PIPELINE`);
console.log(`Steps (${stepsToRun.length}/${STEPS.length}): ${stepsToRun.map(s => s.key).join(' → ')}`);
console.log(hr('═'));

const pipelineStart = Date.now();
const failedSteps = new Set();

for (const step of stepsToRun) {
  if (step.requires && failedSteps.has(step.requires)) {
    console.log(`\n${hr()}`);
    console.log(`⏭  Skipped: ${step.label}`);
    console.log(`   Reason: dependency step "${step.requires}" did not complete`);
    console.log(hr());
    continue;
  }

  try {
    run(step);
  } catch {
    if (step.optional) {
      console.warn(`\n⚠  Optional step "${step.key}" failed — continuing pipeline.`);
      failedSteps.add(step.key);
    } else {
      console.error(`\nPipeline aborted at step: ${step.key}`);
      process.exit(1);
    }
  }
}

const totalSecs = ((Date.now() - pipelineStart) / 1000).toFixed(1);
console.log(`\n${hr('═')}`);
console.log(`PIPELINE COMPLETE — ${stepsToRun.length} step(s) finished in ${totalSecs}s`);
console.log(hr('═'));
console.log('');
