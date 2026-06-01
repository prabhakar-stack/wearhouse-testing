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
      status: "executed" | "skipped" | "failed";
      lastSuccessAt: Date | null;
      lastRunAt: Date;
      error?: string;
    }> = [];

    for (const job of cronJobs) {
      const state = await prisma.cronJobState.findUnique({
        where: { jobKey: job.key },
      });
      const lastSuccessAt = state?.lastSuccessAt ?? null;
      const isDue =
        !lastSuccessAt || now.getTime() - lastSuccessAt.getTime() >= job.intervalMs;

      if (!isDue) {
        results.push({
          jobKey: job.key,
          label: job.label,
          status: "skipped",
          lastSuccessAt,
          lastRunAt: state?.lastRunAt ?? now,
        });
        continue;
      }

      const startedAt = new Date();

      try {
        await prisma.cronJobState.upsert({
          where: { jobKey: job.key },
          create: {
            jobKey: job.key,
            lastRunAt: startedAt,
          },
          update: {
            lastRunAt: startedAt,
            lastError: null,
          },
        });

        await job.run();

        await prisma.cronJobState.update({
          where: { jobKey: job.key },
          data: {
            lastRunAt: startedAt,
            lastSuccessAt: new Date(),
            lastError: null,
          },
        });

        results.push({
          jobKey: job.key,
          label: job.label,
          status: "executed",
          lastSuccessAt: new Date(),
          lastRunAt: startedAt,
        });
      } catch (error: any) {
        console.error(`[Cron ${job.key}] Job execution failed:`, error);
        await prisma.cronJobState.update({
          where: { jobKey: job.key },
          data: {
            lastRunAt: startedAt,
            lastError: error?.message || "Cron job failed",
          },
        });

        results.push({
          jobKey: job.key,
          label: job.label,
          status: "failed",
          lastSuccessAt,
          lastRunAt: startedAt,
          error: error?.message || "Cron job failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    }, { status: 200 });
  } catch (error: any) {
    console.error("[Cron Master] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
