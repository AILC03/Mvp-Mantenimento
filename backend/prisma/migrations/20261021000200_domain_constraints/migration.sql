-- Un solo caso abierto por autobús, incluso ante solicitudes concurrentes.
-- Índice parcial mantenido en SQL: Prisma 6 no lo representa en schema.prisma.
CREATE UNIQUE INDEX "TripChecklist_one_open_per_bus"
ON "TripChecklist" ("busId") WHERE "closedAt" IS NULL;

ALTER TABLE "Inspection"
ADD CONSTRAINT "Inspection_odometer_nonnegative"
CHECK ("odometerKm" IS NULL OR "odometerKm" >= 0);

ALTER TABLE "TripChecklist"
ADD CONSTRAINT "TripChecklist_trip_dates"
CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt"),
ADD CONSTRAINT "TripChecklist_review_pair"
CHECK (("reviewerId" IS NULL) = ("reviewedAt" IS NULL)),
ADD CONSTRAINT "TripChecklist_closed_requires_review"
CHECK ("closedAt" IS NULL OR (
  "reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL
  AND "closedAt" >= "reviewedAt"
  AND "closedAt" >= "startedAt"
));

ALTER TABLE "Incident"
ADD CONSTRAINT "Incident_resolution_pair"
CHECK (("resolvedById" IS NULL) = ("resolvedAt" IS NULL)),
ADD CONSTRAINT "Incident_resolution_date"
CHECK ("resolvedAt" IS NULL OR "resolvedAt" >= "createdAt");
