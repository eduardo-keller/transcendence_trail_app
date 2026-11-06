-- pgvector: o init do Postgres já cria a extensão no banco principal, mas não no banco de teste (*_test)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "RagSource" AS ENUM ('TRAIL', 'WIKIPEDIA', 'GUIDE');

-- CreateTable
CREATE TABLE "RagDocument" (
    "id" TEXT NOT NULL,
    "source" "RagSource" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "license" TEXT,
    "trailExternalId" TEXT,

    CONSTRAINT "RagDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagChunk" (
    "id" SERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,

    CONSTRAINT "RagChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RagChunk_documentId_idx" ON "RagChunk"("documentId");

-- AddForeignKey
ALTER TABLE "RagChunk" ADD CONSTRAINT "RagChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RagDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
