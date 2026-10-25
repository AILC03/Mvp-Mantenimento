-- Extensión aditiva: conserva UUID, relaciones y unidades existentes.
CREATE TYPE "VehicleType" AS ENUM ('BUS', 'TRUCK');
ALTER TABLE "Bus"
  ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'BUS',
  ADD COLUMN "odometerKm" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_odometerKm_nonnegative" CHECK ("odometerKm" >= 0);
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_version_positive" CHECK ("version" > 0);
