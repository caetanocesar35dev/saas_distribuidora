-- Origem da venda (decidido pelo usuário, 2026-11-22).

-- AlterTable
ALTER TABLE "tb_sales" ADD COLUMN     "channelId" TEXT;

-- AlterTable
ALTER TABLE "th_sale_history" ADD COLUMN     "channelId" TEXT;

-- CreateTable
CREATE TABLE "tb_sale_channels" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_sale_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "th_sale_channel_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_sale_channel_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE INDEX "tb_sale_channels_companyId_idx" ON "tb_sale_channels"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_sale_channels_companyId_name_key" ON "tb_sale_channels"("companyId", "name");

-- CreateIndex
CREATE INDEX "ix_th_sale_channel_history_vigente" ON "th_sale_channel_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "tb_sales_channelId_idx" ON "tb_sales"("channelId");

-- AddForeignKey
ALTER TABLE "tb_sales" ADD CONSTRAINT "tb_sales_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "tb_sale_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sale_channels" ADD CONSTRAINT "tb_sale_channels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Auditoria e soft delete da tabela nova (mesmo padrão da migration auditoria_triggers).
CREATE TRIGGER tr_auditoria_tb_sale_channels
AFTER INSERT OR UPDATE ON "tb_sale_channels"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_sale_channel_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_sale_channels
BEFORE DELETE ON "tb_sale_channels"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- As empresas que já existem ganham a lista padrão (a mesma de DEFAULT_SALE_CHANNELS), com Balcão
-- como padrão. As vendas antigas continuam sem origem.
INSERT INTO "tb_sale_channels" ("id", "companyId", "name", "isDefault", "updatedAt", "modifierId", "modifiedEndpoint")
SELECT gen_random_uuid()::text, c."id", n."name", n."isDefault", CURRENT_TIMESTAMP, 'system', 'migration:sale_channels'
FROM "tb_companies" c
CROSS JOIN (VALUES
  ('Balcão', true),
  ('WhatsApp/Telefone', false),
  ('iFood', false),
  ('Zé Delivery', false),
  ('Anota AI', false)
) AS n("name", "isDefault");
