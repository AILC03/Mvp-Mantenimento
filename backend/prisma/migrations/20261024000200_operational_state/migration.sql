CREATE TABLE "OperationState" (
  "id" INTEGER PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0,
  "data" JSONB NOT NULL, "imported" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OperationState_revision_nonnegative" CHECK ("revision" >= 0)
);
CREATE TABLE "OperationDraft" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "form" JSONB NOT NULL, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "OperationEvent" (
  "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "type" VARCHAR(50) NOT NULL, "revision" INTEGER NOT NULL, "digest" CHAR(64) NOT NULL,
  "payload" JSONB NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OperationEvent_createdAt_idx" ON "OperationEvent"("createdAt");
