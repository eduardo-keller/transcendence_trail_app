-- AlterTable
ALTER TABLE "User" ADD COLUMN "bio" TEXT,
ADD COLUMN "username" TEXT;

-- Quem já tinha conta ganha um username provisório e único (dá para trocar no perfil)
UPDATE "User" SET "username" = 'user_' || substr(md5("id"), 1, 10) WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
