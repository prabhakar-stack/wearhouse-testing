# Amazon Reimbursements Sync Documentation

## Sync Behavior for Warehouse Damage Adjustments (No Order ID)

### Current Sync Strategy
We **do synchronize** warehouse damage/loss adjustments from the raw staging table (`AMZ_reimbursements`) to the operational `Reimbursement` table.

* **No Order ID Requirement**: If a reimbursement is issued for FBA warehouse-damaged or lost inventory (meaning it is a warehouse adjustment, not a customer issue), the `amazonOrderId` is missing/null.
* **Order Table Excluded**: In these cases, the script skips upserting any records into the operational `Order` table.
* **Reimbursement Table Included**: The script still successfully inserts the record into the operational `Reimbursement` table, using the unique `reimbursementId` directly as the `returnItemId` to bypass the relational constraint.

---

### Previous Behavior (Skipped Records)
Previously, any raw reimbursement record lacking a customer `orderId` was entirely skipped. This resulted in differences between the raw staging count and the operational sync count:
* **The Cause**: FBA warehouse damages do not generate customer orders.
* **The Check**: The old code rejected any rows where `amazonOrderId` was missing.
* **The Fix**: We removed the `amazonOrderId` requirement check so that these records now sync to the core tables seamlessly.

- **Performance tip**: Adding an extra parallel loop in the tracking job (e.g., processing tracking numbers in batches) can increase throughput and reduce overall execution time.

## Tracking AdditionalInfo Date Normalization
When parsing `AdditionalInfo` from tracking snapshots, dates appear in varied formats (e.g., "Scheduled Delivery: 05-Jun-2026" or "06 Jun 2026, Evening").

**Normalization steps**:
1. Strip all characters up to the first numeric character.
2. Remove non‑alphanumeric separators, keeping digits and month letters.
3. Parse the cleaned string with a flexible date parser (e.g., `new Date`, `date-fns`).
4. Store the resulting `Date` as `scheduledDelivery`.

**Utility example (TypeScript):**
```ts
function parseAdditionalInfoDate(info: string): Date | null {
  const match = info.match(/\d.*$/);
  if (!match) return null;
  const cleaned = match[0].replace(/[^\dA-Za-z]/g, " ").trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}
```

Integrate this logic in `trackcourier.ts` when extracting the `scheduledDelivery` field from `AdditionalInfo`.

## Dynamic Fallback for Empty Courier ETAs

When syncing tracking snapshots, some couriers do not set or provide an expected delivery date (resulting in an empty, `null`, or invalid date value in the tracking data). 

To ensure the system always maintains a valid estimated time of arrival (ETA), the sync engine utilizes a dynamic fallback:
* **Dynamic Recalculation**: If `scheduledDelivery` is empty, `null`, or resolves to an invalid date (`NaN`), it is automatically fallback-estimated to exactly **`currentDate + 5 days`** at execution time.
* **Continuous Updates**: This fallback is recalculated and applied dynamically on every sync run. This guarantees that missing ETAs are continuously updated forward relative to the latest run rather than being set once and left stale.

