-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone_number" TEXT,
    "wallet_preference" TEXT NOT NULL DEFAULT 'CUSTODIAL',
    "custodial_wallet" TEXT,
    "phantom_wallet" TEXT,
    "encrypted_seed" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "wallet_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "wallet_type" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "migration_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migration_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_wallet" TEXT NOT NULL,
    "to_wallet" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "tickets_migrated" INTEGER NOT NULL DEFAULT 0,
    "total_tickets" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_custodial_wallet_idx" ON "users"("custodial_wallet");

-- CreateIndex
CREATE INDEX "users_phantom_wallet_idx" ON "users"("phantom_wallet");

-- CreateIndex
CREATE INDEX "wallet_history_user_id_idx" ON "wallet_history"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_jobs_migration_id_key" ON "migration_jobs"("migration_id");

-- CreateIndex
CREATE INDEX "migration_jobs_user_id_idx" ON "migration_jobs"("user_id");
