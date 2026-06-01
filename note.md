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
