import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronJobs } from "@/lib/cron";
import { requireCronAuth } from "@/lib/cronAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    const now = new Date();
    const results: Array<{
      jobKey: string;
      label: string;
      status: "triggered" | "skipped" | "failed";
      lastSuccessAt: Date | null;
      lastRunAt: Date;
      error?: string;
    }> = [];

    for (const job of cronJobs) {
      const state = await prisma.cronJobState.findUnique({
        where: { jobKey: job.key },
      });
      const lastSuccessAt = state?.lastSuccessAt ?? null;
      const lastRunAt = state?.lastRunAt ?? null;
      const lastError = state?.lastError ?? null;

      // 1. Check if the job is already running in the background (with a 15-minute lock threshold)
      const isRunning =
        lastRunAt &&
        (!lastSuccessAt || lastRunAt.getTime() > lastSuccessAt.getTime()) &&
        !lastError &&
        (now.getTime() - lastRunAt.getTime() < 15 * 60 * 1000);

      if (isRunning) {
        results.push({
          jobKey: job.key,
          label: job.label,
          status: "skipped",
          lastSuccessAt,
          lastRunAt: lastRunAt,
          error: "Job is already running in the background",
        });
        continue;
      }

      // 2. Check if the job is due based on its interval
      const isDue =
        !lastSuccessAt || now.getTime() - lastSuccessAt.getTime() >= job.intervalMs;

      if (!isDue) {
        results.push({
          jobKey: job.key,
          label: job.label,
          status: "skipped",
          lastSuccessAt,
          lastRunAt: lastRunAt ?? now,
        });
        continue;
      }

      const startedAt = new Date();

      try {
        // Synchronously record the start of the job and clear any old error to block concurrent triggers
        await prisma.cronJobState.upsert({
          where: { jobKey: job.key },
          create: {
            jobKey: job.key,
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
            console.log(`[Cron Master] Starting job ${job.key} in background...`);
            await job.run();
            await prisma.cronJobState.update({
              where: { jobKey: job.key },
              data: {
                lastRunAt: startedAt,
                lastSuccessAt: new Date(),
                lastError: null,
              },
            });
            console.log(`[Cron Master] Background job ${job.key} completed successfully.`);
          } catch (jobError: any) {
            console.error(`[Cron ${job.key}] Background job execution failed:`, jobError);
            await prisma.cronJobState.update({
              where: { jobKey: job.key },
              data: {
                lastRunAt: startedAt,
                lastError: jobError?.message || "Cron job failed",
              },
            }).catch((dbErr) => {
              console.error(`[Cron ${job.key}] Failed to write failure state to database:`, dbErr);
            });
          }
        })();

        results.push({
          jobKey: job.key,
          label: job.label,
          status: "triggered",
          lastSuccessAt,
          lastRunAt: startedAt,
        });
      } catch (error: any) {
        console.error(`[Cron ${job.key}] Failed to initiate background run:`, error);
        results.push({
          jobKey: job.key,
          label: job.label,
          status: "failed",
          lastSuccessAt,
          lastRunAt: startedAt,
          error: error?.message || "Failed to initiate job",
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        results,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Cron Master] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
