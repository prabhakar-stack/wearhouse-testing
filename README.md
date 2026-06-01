<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>


This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/27cbe715-031e-457e-9614-e23435f5d0c8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Amazon Live Sync

1. Add these variables to `.env.local` or `.env`:
   `REGION`, `REFRESH_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `MARKETPLACE_ID`, `DATABASE_URL`
2. Run the sync:
   `npm run sync:amazon-returns`

The sync pulls the live reports for orders, customer returns, reimbursements, removal orders, and removal shipments.

## cron-job.org

Use cron-job.org to trigger the app's cron endpoints directly.

1. Set `CRON_SECRET` in your deployment environment.
2. For a single master job, create one HTTP GET job for:
   - `/api/cron?secret=<CRON_SECRET>`
3. If you want separate schedules, create one HTTP GET job for each endpoint:
   - `/api/cron/amazon-returns?secret=<CRON_SECRET>`
   - `/api/cron/expected-tracking?secret=<CRON_SECRET>`
   - `/api/cron/escalations?secret=<CRON_SECRET>`
4. If you prefer headers instead of a query string, send either `Authorization: Bearer <CRON_SECRET>` or `X-Cron-Secret: <CRON_SECRET>`.

Recommended schedules:

1. Master cron: every hour, or whatever interval you want for all due jobs.
2. Amazon returns: every 5 days.
3. Expected tracking: every hour.
4. Escalations: every hour.

The cron endpoints now return quickly with `202 Accepted` and continue the work in the background, which avoids cron-job.org timeout errors.

## Live OTP Bridge

If your SIM module sits on another PC over RS232, that PC cannot write directly into the browser UI. Use a small bridge process on that PC to POST each received OTP to the app.

1. Set `OTP_BRIDGE_SECRET` in your deployment environment.
2. When the RS232 PC receives an OTP, POST it to:
    - `/api/otp/bridge?secret=<OTP_BRIDGE_SECRET>`
3. Send JSON like this:

```json
{
   "otp": "123456",
   "trackingId": "optional-tracking-id",
   "source": "rs232-bridge"
}
```

The receiver screen polls `/api/otp/latest` automatically and shows the live OTP once it arrives.

For tracking-linked OTPs (recommended): the bridge requires a `trackingId` and the receiver polls for OTPs by `trackingId`.

POST to bridge (required `trackingId`):

```
POST /api/otp/bridge?secret=<OTP_BRIDGE_SECRET>
Content-Type: application/json

{
   "otp": "123456",
   "trackingId": "REMOVAL_ORDER_12345",
   "source": "rs232-bridge"
}
```

Fetch latest OTP for a tracking id:

```
GET /api/otp/latest?trackingId=REMOVAL_ORDER_12345
```

## Tracking Sync & Dynamic Fallback ETAs

For tracking IDs that do not return a scheduled delivery date from the courier (e.g. initial checkpoints or incomplete tracking details), the sync job dynamically applies a fallback expected delivery date:
* **Fallback calculation**: If the ETA is empty, `null`, or invalid (`NaN`), it is resolved as **`currentDate + 5 days`** at run time.
* **On-going Updates**: The engine evaluates and recalculates this fallback dynamically on every subsequent execution to keep dates active and forward-moving until the courier updates its official ETA.

