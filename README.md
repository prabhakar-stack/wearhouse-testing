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
2. Create one HTTP GET job for each endpoint:
   - `/api/cron/amazon-returns?secret=<CRON_SECRET>`
   - `/api/cron/expected-tracking?secret=<CRON_SECRET>`
   - `/api/cron/escalations?secret=<CRON_SECRET>`
3. If you prefer headers instead of a query string, send either `Authorization: Bearer <CRON_SECRET>` or `X-Cron-Secret: <CRON_SECRET>`.

Recommended schedules:

1. Amazon returns: every 5 days.
2. Expected tracking: every hour.
3. Escalations: every hour.

The shared `/api/cron` endpoint still exists, but cron-job.org works best when you schedule the individual job URLs above.
