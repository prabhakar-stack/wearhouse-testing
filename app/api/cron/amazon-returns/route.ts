import { NextResponse } from "next/server";
import { runAmazonReturnsJob } from "@/lib/cron";
import { requireCronAuth } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    const jobKey = "amazon-returns";
    const now = new Date();

    const state = await prisma.cronJobState.findUnique({
      where: { jobKey },
    });
    const lastSuccessAt = state?.lastSuccessAt ?? null;
    const lastRunAt = state?.lastRunAt ?? null;
    const lastError = state?.lastError ?? null;

    // Check if the job is already running in the background (with 15 min lock threshold)
    const isRunning =
      lastRunAt &&
      (!lastSuccessAt || lastRunAt.getTime() > lastSuccessAt.getTime()) &&
      !lastError &&
      (now.getTime() - lastRunAt.getTime() < 15 * 60 * 1000);

    if (isRunning) {
      return NextResponse.json(
        {
          success: false,
          message: "Amazon returns job is already running in the background",
        },
        { status: 409 }
      );
    }

    const startedAt = new Date();

    // Record starting of the job to prevent concurrent runs
    await prisma.cronJobState.upsert({
      where: { jobKey },
      create: {
        jobKey,
        lastRunAt: startedAt,
        lastError: null,
      },
      update: {
        lastRunAt: startedAt,
        lastError: null,
      },
    });

    // Spawn the job asynchronously in the background
    (async () => {
      try {
        console.log(`[Cron Amazon Returns] Starting job in background...`);
        await runAmazonReturnsJob();
        await prisma.cronJobState.update({
          where: { jobKey },
          data: {
            lastRunAt: startedAt,
            lastSuccessAt: new Date(),
            lastError: null,
          },
        });
        console.log(`[Cron Amazon Returns] Background job completed successfully.`);
      } catch (jobError: any) {
        console.error(`[Cron Amazon Returns] Background job execution failed:`, jobError);
        await prisma.cronJobState.update({
          where: { jobKey },
          data: {
            lastRunAt: startedAt,
            lastError: jobError?.message || "Job failed",
          },
        }).catch((dbErr) => {
          console.error(`[Cron Amazon Returns] Failed to write failure state to database:`, dbErr);
        });
      }
    })();

    return NextResponse.json(
      {
        success: true,
        message: "Amazon returns job triggered in background",
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("[Cron Amazon Returns] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
