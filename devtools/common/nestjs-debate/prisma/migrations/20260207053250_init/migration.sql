-- CreateTable
CREATE TABLE "debates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "debate_type" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'AWAITING_OPPONENT',
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CreateTable
CREATE TABLE "arguments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "type" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "client_request_id" TEXT,
    "seq" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "arguments_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "arguments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "arguments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "arguments_debate_id_idx" ON "arguments"("debate_id");

-- CreateIndex
CREATE INDEX "arguments_parent_id_idx" ON "arguments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "arguments_debate_id_client_request_id_key" ON "arguments"("debate_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "arguments_debate_id_seq_key" ON "arguments"("debate_id", "seq");
