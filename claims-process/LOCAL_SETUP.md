# Local Setup Guide

Follow these steps to run the application on your computer:

## 1. Prerequisites
- **Node.js** (v18 or higher)
- **Git** (optional, for cloning)
- **Supabase Account** (with a Database ready)

## 2. Initial Setup
1. **Clone/Download** the repository to your local machine.
2. Open a terminal in the project folder.
3. Run `npm install` to install dependencies.
4. Run `npx playwright install chromium` to install the bot's browser.

## 3. Environment Configuration
1. Create a file named **`.env`** in the root directory.
2. Copy the content from `.env.example` into `.env`.
3. **Database URI**: Navigate to your Supabase Dashboard -> Project Settings -> Database.
   - Find the **Connection String** section and select **URI**.
   - Copy the URI (starts with `postgresql://`).
   - Replace `[YOUR-PASSWORD]` in the URI with your actual database password.
   - Paste this into `SUPABASE_URL` in your `.env`.
4. **Port Management**: If you get `EADDRINUSE` for port 3000, change `PORT=3001` in your `.env`.

## 4. Running the App
- **Development Mode**: `npm run dev` (with Auto-Reload)
- **Production Mode**: `npm run build` then `npm start`

## 5. Troubleshooting Supabase Connection
- **Check the Logs**: The server will print `✅ Successfully connected` or an error on startup.
- **Port 5432**: Standard PostgreSQL port is supported. If you encounter issues with standard port 5432, Supabase also provides port 6543 for transaction pooling.
- **SSL**: The app automatically handles SSL for remote connections.
- **Network Restrictions**: In Supabase settings, ensure your local IP is not blocked.
