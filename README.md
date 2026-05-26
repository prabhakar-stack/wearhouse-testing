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
