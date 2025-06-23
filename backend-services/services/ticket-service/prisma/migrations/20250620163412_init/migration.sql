-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticket_id" BIGINT NOT NULL,
    "event_id" TEXT NOT NULL,
    "ticket_pda" TEXT NOT NULL,
    "owner_wallet" TEXT NOT NULL,
    "owner_email" TEXT,
    "tier" TEXT NOT NULL,
    "purchase_price" BIGINT NOT NULL,
    "mint_job_id" TEXT,
    "mint_status" TEXT NOT NULL DEFAULT 'PENDING',
    "minted_at" DATETIME,
    "transaction_id" TEXT,
    "qrCode" TEXT,
    "verification_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "mint_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "result" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_id_key" ON "tickets"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_pda_key" ON "tickets"("ticket_pda");

-- CreateIndex
CREATE INDEX "tickets_event_id_idx" ON "tickets"("event_id");

-- CreateIndex
CREATE INDEX "tickets_owner_wallet_idx" ON "tickets"("owner_wallet");

-- CreateIndex
CREATE INDEX "tickets_owner_email_idx" ON "tickets"("owner_email");

-- CreateIndex
CREATE UNIQUE INDEX "mint_jobs_job_id_key" ON "mint_jobs"("job_id");

-- CreateIndex
CREATE INDEX "mint_jobs_event_id_idx" ON "mint_jobs"("event_id");

-- CreateIndex
CREATE INDEX "mint_jobs_user_id_idx" ON "mint_jobs"("user_id");
