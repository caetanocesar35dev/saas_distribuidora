-- Enquete nas notificações (decidido pelo usuário, 2026-11-18).
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'POLL';

-- AlterTable
ALTER TABLE "tb_notifications" ADD COLUMN     "pollEndsAt" TIMESTAMP(3),
ADD COLUMN     "pollMultiple" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "th_notification_history" ADD COLUMN     "pollEndsAt" TIMESTAMP(3),
ADD COLUMN     "pollMultiple" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tb_notification_poll_options" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_notification_poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_notification_poll_votes" (
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_notification_poll_votes_pkey" PRIMARY KEY ("optionId","userId")
);

-- CreateTable
CREATE TABLE "th_notification_poll_option_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_notification_poll_option_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_notification_poll_vote_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_notification_poll_vote_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE INDEX "tb_notification_poll_options_notificationId_idx" ON "tb_notification_poll_options"("notificationId");

-- CreateIndex
CREATE INDEX "tb_notification_poll_votes_notificationId_userId_idx" ON "tb_notification_poll_votes"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "ix_th_notification_poll_option_history_vigente" ON "th_notification_poll_option_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_notification_poll_vote_history_vigente" ON "th_notification_poll_vote_history"("optionId", "userId", "historyEnd");

-- AddForeignKey
ALTER TABLE "tb_notification_poll_options" ADD CONSTRAINT "tb_notification_poll_options_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "tb_notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification_poll_votes" ADD CONSTRAINT "tb_notification_poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "tb_notification_poll_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification_poll_votes" ADD CONSTRAINT "tb_notification_poll_votes_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "tb_notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification_poll_votes" ADD CONSTRAINT "tb_notification_poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Auditoria e soft delete das tabelas novas (mesmo padrão da migration auditoria_triggers).
CREATE TRIGGER tr_auditoria_tb_notification_poll_options
AFTER INSERT OR UPDATE ON "tb_notification_poll_options"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_notification_poll_option_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_notification_poll_options
BEFORE DELETE ON "tb_notification_poll_options"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

CREATE TRIGGER tr_auditoria_tb_notification_poll_votes
AFTER INSERT OR UPDATE ON "tb_notification_poll_votes"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_notification_poll_vote_history', 'optionId', 'userId');

CREATE TRIGGER tr_bloqueia_delete_tb_notification_poll_votes
BEFORE DELETE ON "tb_notification_poll_votes"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();