-- CreateTable
CREATE TABLE "CronJobState" (
    "jobKey" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJobState_pkey" PRIMARY KEY ("jobKey")
);
