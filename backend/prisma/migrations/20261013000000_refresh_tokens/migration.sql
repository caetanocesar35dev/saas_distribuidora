-- CreateTable
CREATE TABLE "tb_refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "th_refresh_token_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_refresh_token_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_refresh_tokens_tokenHash_key" ON "tb_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "tb_refresh_tokens_userId_idx" ON "tb_refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "tb_refresh_tokens_familyId_idx" ON "tb_refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "tb_refresh_tokens_expiresAt_idx" ON "tb_refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "ix_th_refresh_token_history_vigente" ON "th_refresh_token_history"("id", "historyEnd");

-- AddForeignKey
ALTER TABLE "tb_refresh_tokens" ADD CONSTRAINT "tb_refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Auditoria e soft delete da tabela nova (mesmo padrão da migration auditoria_triggers).
-- tokenHash não existe em th_refresh_token_history: a função genérica ignora o que não está no histórico.

-- tb_refresh_tokens
CREATE TRIGGER tr_auditoria_tb_refresh_tokens
AFTER INSERT OR UPDATE ON "tb_refresh_tokens"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_refresh_token_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_refresh_tokens
BEFORE DELETE ON "tb_refresh_tokens"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();
