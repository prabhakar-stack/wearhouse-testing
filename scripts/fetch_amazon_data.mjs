import "dotenv/config";
import { runFetchAndStage } from "./fetch_returns_to_supabase.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

runFetchAndStage()
  .catch((e) => console.error(e))
  .finally(async () => { await prisma.$disconnect().catch(() => {}); });
