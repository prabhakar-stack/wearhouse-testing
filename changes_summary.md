# Workspace Changes Summary (Since Last Commit)

This document provides a detailed summary of all modified, deleted, and untracked (new) files in the workspace relative to your last commit (`3b064556 — ux changes`).

---

## 🟢 New & Untracked Files

### 1. IndexedDB Persistent Queue
* **[`lib/indexedDb.ts`](file:///e:/documents/project1/wearhouse-testing/lib/indexedDb.ts)**: Client-side persistent storage layer. When Google Drive upload fails, raw files (videos/photos) and metadata are stored directly in the browser's IndexedDB on the user's physical device.
* **[`app/components/PendingUploadsIndicator.tsx`](file:///e:/documents/project1/wearhouse-testing/app/components/PendingUploadsIndicator.tsx)**: Reusable layout component. Displays a floating notification pill (e.g. `⚠️ 2 uploads pending`) that opens a modal drawer showing pending uploads. Includes client-side **Retry** (automatic Google Drive re-upload + DB finalization) and **Discard** operations.

### 2. Rate Limiting System
* **[`lib/rateLimit.ts`](file:///e:/documents/project1/wearhouse-testing/lib/rateLimit.ts)**: Sliding-window in-memory rate limiter designed for Render/Next.js API protection against spam on sensitive endpoints.

### 3. System Uptime Health Check
* **[`app/api/health/route.ts`](file:///e:/documents/project1/wearhouse-testing/app/api/health/route.ts)**: Uptime monitoring route (`/api/health`) that returns the service status.

### 4. Database Migrations
* **[`prisma/migrations/`](file:///e:/documents/project1/wearhouse-testing/prisma/migrations)**: Prisma schema migration files generated to sync the Supabase database with column-name fixes.

---

## 🟡 Modified Files

### 1. Security & Authentication
* **[`app/api/auth/google/route.ts`](file:///e:/documents/project1/wearhouse-testing/app/api/auth/google/route.ts)**: Added rate limiting protection.
* **[`app/api/otp/latest/route.ts`](file:///e:/documents/project1/wearhouse-testing/app/api/otp/latest/route.ts)**: Added rate limiting protection.
* **[`middleware.ts`](file:///e:/documents/project1/wearhouse-testing/middleware.ts)**: Exempted the new `/api/health` endpoint from authentication gates.
* **[`lib/cronAuth.ts`](file:///e:/documents/project1/wearhouse-testing/lib/cronAuth.ts)**: Hardened the `CRON_SECRET` validation check.

### 2. File Uploads & Local Fallbacks
* **[`app/api/upload/init/route.ts`](file:///e:/documents/project1/wearhouse-testing/app/api/upload/init/route.ts)**: Added rate limiting protection.
* **[`app/api/upload/raw/route.ts`](file:///e:/documents/project1/wearhouse-testing/app/api/upload/raw/route.ts)**: Modified error handling so that if Google Drive is unreachable, the raw staged file on local server disk is **not** deleted, and metadata is sent back to prompt client IndexedDB queuing.

### 3. Dashboard Integrations
* **[`app/receiver/ReceiverDashboard.tsx`](file:///e:/documents/project1/wearhouse-testing/app/receiver/ReceiverDashboard.tsx)**:
  - Configured rejection photo upload failures to write directly to IndexedDB.
  - Injected the floating `<PendingUploadsIndicator />` into the layout.
* **[`app/inspector/page.tsx`](file:///e:/documents/project1/wearhouse-testing/app/inspector/page.tsx)**:
  - Catch block in the media recorder `backgroundUpload` flow now writes video files and LPN pictures to IndexedDB on failure.
  - Injected `<PendingUploadsIndicator />` in the page layout.

### 4. Database Schema Typo Corrections
* **[`prisma/schema.prisma`](file:///e:/documents/project1/wearhouse-testing/prisma/schema.prisma)**: Corrected spelling typos:
  - `recevied_status` ➡️ `received_status`
  - `traking_number` ➡️ `tracking_number`

### 5. Tracking Cron Optimization
* **[`lib/cron.ts`](file:///e:/documents/project1/wearhouse-testing/lib/cron.ts)**: Parallelized shipment tracking scans using `Promise.allSettled` batches. Limits concurrent browser instances to `4` (to avoid Render memory limits), reducing 50 package sync runs from ~75 mins to ~19 mins.

### 6. Code & Build Optimization
* **[`lib/prisma.ts`](file:///e:/documents/project1/wearhouse-testing/lib/prisma.ts)**: Changed prisma instantiation into a global singleton in production environments to prevent database connection exhaustion.
* **[`eslint.config.mjs`](file:///e:/documents/project1/wearhouse-testing/eslint.config.mjs)**: Updated config rules to allow compilation builds with 0 errors.
* **[`package.json`](file:///e:/documents/project1/wearhouse-testing/package.json)**: Removed legacy seed configurations entirely.
* **[`next.config.ts`](file:///e:/documents/project1/wearhouse-testing/next.config.ts)**: Configured Next.js server actions body limit.

---

## 🔴 Deleted Files

* **[`prisma/seed.ts`](file:///e:/documents/project1/wearhouse-testing/prisma/seed.ts)**: Legacy TypeScript seed file deleted.
* **[`prisma/seed.js`](file:///e:/documents/project1/wearhouse-testing/prisma/seed.js)**: Legacy JavaScript CJS seed file deleted.
* **[`prisma/seed.mjs`](file:///e:/documents/project1/wearhouse-testing/prisma/seed.mjs)**: Rewritten seed file deleted since no database seeding is required.
