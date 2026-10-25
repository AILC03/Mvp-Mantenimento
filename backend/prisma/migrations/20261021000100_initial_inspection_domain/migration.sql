-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DRIVER', 'LEAD_MECHANIC', 'TECHNICIAN', 'WAREHOUSE_CLERK');

-- CreateEnum
CREATE TYPE "TechnicalStatus" AS ENUM ('PENDING_REVIEW', 'CLEARED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "InspectionStage" AS ENUM ('PRE_TRIP', 'POST_TRIP');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" UUID NOT NULL,
    "fleetNumber" VARCHAR(30) NOT NULL,
    "licensePlate" VARCHAR(30),
    "vin" VARCHAR(17),
    "brand" VARCHAR(80),
    "model" VARCHAR(80),
    "modelYear" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalDecision" (
    "id" UUID NOT NULL,
    "busId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "status" "TechnicalStatus" NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripChecklist" (
    "id" UUID NOT NULL,
    "busId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "tripNotes" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNotes" TEXT,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TripChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "stage" "InspectionStage" NOT NULL,
    "odometerKm" INTEGER,
    "answers" JSONB NOT NULL,
    "formVersion" VARCHAR(30) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "incidentId" UUID,
    "busPart" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "photoObjectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "busId" UUID NOT NULL,
    "reportedById" UUID NOT NULL,
    "associatedDriverId" UUID,
    "busPart" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "photoObjectKey" TEXT,
    "preventsOperation" BOOLEAN NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" UUID,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_fleetNumber_key" ON "Bus"("fleetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_licensePlate_key" ON "Bus"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_vin_key" ON "Bus"("vin");

-- CreateIndex
CREATE INDEX "TechnicalDecision_busId_createdAt_idx" ON "TechnicalDecision"("busId", "createdAt");

-- CreateIndex
CREATE INDEX "TripChecklist_busId_createdAt_idx" ON "TripChecklist"("busId", "createdAt");

-- CreateIndex
CREATE INDEX "TripChecklist_driverId_idx" ON "TripChecklist"("driverId");

-- CreateIndex
CREATE INDEX "TripChecklist_reviewerId_idx" ON "TripChecklist"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_checklistId_stage_key" ON "Inspection"("checklistId", "stage");

-- CreateIndex
CREATE INDEX "Observation_inspectionId_idx" ON "Observation"("inspectionId");

-- CreateIndex
CREATE INDEX "Observation_incidentId_idx" ON "Observation"("incidentId");

-- CreateIndex
CREATE INDEX "Incident_busId_resolvedAt_idx" ON "Incident"("busId", "resolvedAt");

-- CreateIndex
CREATE INDEX "Incident_reportedById_idx" ON "Incident"("reportedById");

-- CreateIndex
CREATE INDEX "Incident_associatedDriverId_idx" ON "Incident"("associatedDriverId");

-- CreateIndex
CREATE INDEX "Incident_resolvedById_idx" ON "Incident"("resolvedById");

-- AddForeignKey
ALTER TABLE "TechnicalDecision" ADD CONSTRAINT "TechnicalDecision_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalDecision" ADD CONSTRAINT "TechnicalDecision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChecklist" ADD CONSTRAINT "TripChecklist_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChecklist" ADD CONSTRAINT "TripChecklist_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChecklist" ADD CONSTRAINT "TripChecklist_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "TripChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_associatedDriverId_fkey" FOREIGN KEY ("associatedDriverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
