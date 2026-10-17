-- CreateEnum
CREATE TYPE "TrailSource" AS ENUM ('OSM', 'USER');

-- AlterTable
ALTER TABLE "Trail" ADD COLUMN     "elevationLoss" DOUBLE PRECISION,
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "highway" TEXT,
ADD COLUMN     "isCircular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "osmTags" JSONB,
ADD COLUMN     "sacScale" TEXT,
ADD COLUMN     "source" "TrailSource" NOT NULL DEFAULT 'USER',
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "startLat" DOUBLE PRECISION,
ADD COLUMN     "startLon" DOUBLE PRECISION,
ADD COLUMN     "surface" TEXT,
ALTER COLUMN "elevationGain" DROP NOT NULL,
ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Trail_externalId_key" ON "Trail"("externalId");

-- CreateIndex
CREATE INDEX "Trail_source_difficulty_idx" ON "Trail"("source", "difficulty");

-- CreateIndex
CREATE INDEX "Trail_distance_idx" ON "Trail"("distance");

