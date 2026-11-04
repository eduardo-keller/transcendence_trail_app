-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GENERAL', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'FRIEND_DECLINED', 'FRIEND_REMOVED', 'MESSAGE');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'GENERAL';
