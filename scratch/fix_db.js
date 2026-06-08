import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Renaming column 'isRefurbished' to 'is_refurbished' in database...");
    
    // 1. Rename column in sample_recovery table if it exists as isRefurbished
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "sample_recovery" RENAME COLUMN "isRefurbished" TO "is_refurbished";
      `);
      console.log("✅ Successfully renamed 'isRefurbished' to 'is_refurbished' in 'sample_recovery' table.");
    } catch (e) {
      console.log("⚠️ Could not rename column in 'sample_recovery' (maybe it is already renamed or table does not exist):", e.message);
    }

    // 2. Rename column in ItemStatus table if it exists as isRefurbished
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ItemStatus" RENAME COLUMN "isRefurbished" TO "is_refurbished";
      `);
      console.log("✅ Successfully renamed 'isRefurbished' to 'is_refurbished' in 'ItemStatus' table.");
    } catch (e) {
      console.log("⚠️ Could not rename column in 'ItemStatus' (maybe it is already renamed or table does not exist):", e.message);
    }
    
    // 3. Make sure the column is_refurbished exists in ItemStatus
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ItemStatus" ADD COLUMN IF NOT EXISTS "is_refurbished" BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log("✅ Verified 'is_refurbished' column exists in 'ItemStatus' table.");
    } catch (e) {
      console.error("❌ Failed to add/verify 'is_refurbished' column in 'ItemStatus':", e.message);
    }

    console.log("🎉 Database fix execution completed!");
  } catch (err) {
    console.error("❌ Unexpected error during database fix:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
