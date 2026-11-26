-- Fornecedores, o mínimo (decidido pelo usuário, 2026-11-24): o nome do fornecedor no envio e no
-- recebimento de cascos, para saber o saldo de cascos com cada um.

-- AlterTable
ALTER TABLE "tb_bottle_movements" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "th_bottle_movement_history" ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "tb_suppliers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "th_supplier_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_supplier_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE INDEX "tb_suppliers_companyId_idx" ON "tb_suppliers"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_suppliers_companyId_name_key" ON "tb_suppliers"("companyId", "name");

-- CreateIndex
CREATE INDEX "ix_th_supplier_history_vigente" ON "th_supplier_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "tb_bottle_movements_supplierId_idx" ON "tb_bottle_movements"("supplierId");

-- AddForeignKey
ALTER TABLE "tb_bottle_movements" ADD CONSTRAINT "tb_bottle_movements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "tb_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_suppliers" ADD CONSTRAINT "tb_suppliers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Auditoria e soft delete da tabela nova (mesmo padrão da migration auditoria_triggers).
CREATE TRIGGER tr_auditoria_tb_suppliers
AFTER INSERT OR UPDATE ON "tb_suppliers"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_supplier_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_suppliers
BEFORE DELETE ON "tb_suppliers"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

