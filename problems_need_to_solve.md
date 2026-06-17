# Problems to Solve / Architectural Technical Debt

This document tracks identified issues, code smells, and architectural technical debt in the warehouse returns management system to be addressed in future discussions.

---

## 1. Brittle and Duplicated Client-Side Translation for Alerts

### Context & Current Behavior
Currently, alerts are generated on the backend (e.g., in [`lib/cron.ts`](file:///e:/documents/project1/wearhouse-testing/lib/cron.ts)) and saved with an English description string in the database `Alert` table. 

To display Hindi descriptions, the application relies on client-side translation in the frontend dashboards (e.g., [`AdminDashboard.tsx`](file:///e:/documents/project1/wearhouse-testing/app/admin/AdminDashboard.tsx), `ReceiverDashboard.tsx`, `RecovererDashboard.tsx`, etc.). 

This is done by:
1. Duplicating a large dictionary `HINDI_ALERT_DESCRIPTIONS` across **7 different dashboard files**.
2. Using regex parsing on the client side to extract parameters (like `trackingId` and `orderId`) from the English description, and inserting them into the Hindi template:
   ```typescript
   HINDI_ALERT_DESCRIPTIONS[alert.type]
     .replace('{trackingId}', alert.manifest?.trackingId || alert.description.match(/\b\d{8,15}\b/)?.[0] || '')
     .replace('{orderId}', alert.description.match(/Removal Order (\S+)/i)?.[1] || alert.manifest?.removalOrderId || '')
   ```

### Problems & Risks
* **High Maintenance:** Adding, removing, or changing an alert type requires updating the translation mapping in 7 separate client-side files.
* **Fragile Regex Parsing:** If the English template in [`lib/alertRules.ts`](file:///e:/documents/project1/wearhouse-testing/lib/alertRules.ts) is modified slightly, the frontend regexes might fail to match variables, leading to broken translations or empty fields in the Hindi UI.
* **Client Overhead:** Unnecessary regex computations and duplicate dictionaries sent to the browser.

### Proposed Solution: Database-Driven Translation
Move translation resolving to the backend/database at creation time.

1. **Schema Migration:**
   Add a `descriptionHi` column to the `Alert` model in [`prisma/schema.prisma`](file:///e:/documents/project1/wearhouse-testing/prisma/schema.prisma):
   ```prisma
   model Alert {
     id            String  @id @default(uuid())
     type          String
     description   String  // English
     descriptionHi String? // Hindi
     ...
   }
   ```
2. **Rules Registry Update:**
   Add `descriptionHi` to the `AlertRule` type in [`lib/alertRules.ts`](file:///e:/documents/project1/wearhouse-testing/lib/alertRules.ts).
3. **Backend Compilation:**
   When triggering alerts in `lib/cron.ts`, replace the templates (`{trackingId}`, `{orderId}`) on both strings using the actual data variables, then write both compiled strings (`description` and `descriptionHi`) to the database.
4. **Client Cleanup:**
   Delete all `HINDI_ALERT_DESCRIPTIONS` structures from the dashboard files and replace the rendering logic with a direct bilingual display:
   ```typescript
   {lang === 'hi' && alert.descriptionHi ? alert.descriptionHi : alert.description}
   ```

---

## 2. Browser OOM Risk with High Quality Video Recording on Workstations

### Context & Current Behavior
To support crystal-clear inspections, the video recording bitrate is configured at **3 Mbps** (~22 MB per minute). 
Currently, the `MediaRecorder` pushes recorded chunks every 1 second directly into a JavaScript array (`chunksRef.current`) held in browser RAM.

If an inspector leaves the terminal open and walks away, or forgets to submit the inspection, the recording can run for **100+ minutes**. At 3 Mbps, this accumulates **~2.2 GB of raw video blobs in browser memory**, which exceeds the browser tab's RAM allocation limits and crashes the tab (Out Of Memory crash), causing the entire inspection state to be lost.

### Problems & Risks
* **Tab Crashes / Data Loss**: Workspace terminals left idle will freeze or crash, wiping out the currently scanned package data and requiring the inspector to restart.
* **Workstation RAM Exhaustion**: Workstations with lower-end RAM specifications will lag severely when video files get larger than 200–300 MB.

### Proposed Solution: Direct-to-Disk (IndexedDB) Staging
Instead of holding all chunks in browser RAM, stream them to the user's local disk in real-time.

1. **IndexedDB Schema**:
   Add a simple key-value object store named `video_chunks` in the existing client IndexedDB configuration ([`lib/indexedDb.ts`](file:///e:/documents/project1/wearhouse-testing/lib/indexedDb.ts)).
2. **Streaming to Disk**:
   Modify the `ondataavailable` handler of `MediaRecorder` in [`app/inspector/page.tsx`](file:///e:/documents/project1/wearhouse-testing/app/inspector/page.tsx) to asynchronously write each 1-second chunk to IndexedDB as it arrives and release it from RAM:
   ```typescript
   mr.ondataavailable = async (e) => {
     if (e.data.size > 0) {
       await saveVideoChunk(orderId, index++, e.data);
     }
   }
   ```
3. **Sequential Chunk Upload**:
   When finalizing, read the chunks sequentially from IndexedDB and upload them in parts using the same-origin chunked upload proxy (`/api/upload/chunk`), then clear the chunk records from IndexedDB.
