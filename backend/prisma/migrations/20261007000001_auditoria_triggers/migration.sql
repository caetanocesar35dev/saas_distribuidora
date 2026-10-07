-- ============================================================
-- AUDITORIA VIA TRIGGERS (SCD Tipo 2) + SOFT DELETE OBRIGATÓRIO
-- ============================================================
-- Convenções (ver comentário no topo do schema.prisma):
--   tb_<x>  -> tabela de negócio, com "modifierId", "modifiedEndpoint", "deletedAt"
--   th_<x>_history -> histórico, escrito SOMENTE por fc_auditoria
--   "historyEnd" IS NULL = versão vigente
--
-- fc_auditoria é GENÉRICA: copia NEW para o th_ casando as colunas por NOME
-- (jsonb_populate_record). Por isso:
--   - coluna nova na tb_ só precisa ser criada também no th_ (sem alterar esta função);
--   - coluna que não existe no th_ é ignorada (ex.: passwordHash, balances);
--   - UPDATE que não altera nenhuma coluna espelhada (fora as de autoria) não gera versão.
--
-- Argumentos do trigger: TG_ARGV[0] = nome da tabela th_, TG_ARGV[1..] = colunas da PK.
-- Todas as PKs do projeto são TEXT (uuid), o que permite a comparação via ->>.
--
-- Datas gravadas em UTC (timestamp sem fuso), mesmo padrão do Prisma.

CREATE OR REPLACE FUNCTION fc_auditoria()
RETURNS TRIGGER AS $$
DECLARE
    v_hist     text   := TG_ARGV[0];
    v_pk       text[] := TG_ARGV[1:TG_NARGS - 1];
    v_agora    timestamp := now() AT TIME ZONE 'UTC';
    v_ignorar  text[] := ARRAY['historyId', 'historyStart', 'historyEnd', 'modifierId', 'modifiedEndpoint'];
    v_new      jsonb;
    v_old      jsonb;
    v_where    text;
BEGIN
    -- NEW "recortado" para as colunas que existem no histórico
    EXECUTE format('SELECT to_jsonb(r) FROM jsonb_populate_record(NULL::%I, $1) r', v_hist)
        INTO v_new USING to_jsonb(NEW);

    IF (TG_OP = 'UPDATE') THEN
        EXECUTE format('SELECT to_jsonb(r) FROM jsonb_populate_record(NULL::%I, $1) r', v_hist)
            INTO v_old USING to_jsonb(OLD);

        -- Nada relevante mudou (ex.: só stock/balance não auditados, ou só updatedAt)
        IF (v_new - v_ignorar) = (v_old - v_ignorar) THEN
            RETURN NULL;
        END IF;

        -- Fecha a versão vigente
        SELECT string_agg(format('%I = ($1 ->> %L)', c, c), ' AND ')
          INTO v_where
          FROM unnest(v_pk) AS c;

        EXECUTE format('UPDATE %I SET "historyEnd" = $2 WHERE %s AND "historyEnd" IS NULL', v_hist, v_where)
            USING to_jsonb(OLD), v_agora;
    END IF;

    -- INSERT ou UPDATE: cria a nova versão
    v_new := v_new || jsonb_build_object(
        'historyId',    gen_random_uuid()::text,
        'historyStart', v_agora,
        'historyEnd',   NULL
    );

    EXECUTE format('INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1)', v_hist, v_hist)
        USING v_new;

    RETURN NULL; -- trigger AFTER: retorno ignorado
END;
$$ LANGUAGE plpgsql;

-- Soft delete obrigatório: qualquer DELETE físico em tb_* é rejeitado.
-- (TRUNCATE e DROP, usados por "prisma migrate reset", não disparam este trigger.)
CREATE OR REPLACE FUNCTION fc_bloqueia_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'DELETE físico não permitido em "%". Use soft delete (UPDATE ... SET "deletedAt" = now()).', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- tb_users
CREATE TRIGGER tr_auditoria_tb_users
AFTER INSERT OR UPDATE ON "tb_users"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_user_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_users
BEFORE DELETE ON "tb_users"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_companies
CREATE TRIGGER tr_auditoria_tb_companies
AFTER INSERT OR UPDATE ON "tb_companies"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_company_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_companies
BEFORE DELETE ON "tb_companies"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_memberships
CREATE TRIGGER tr_auditoria_tb_memberships
AFTER INSERT OR UPDATE ON "tb_memberships"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_membership_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_memberships
BEFORE DELETE ON "tb_memberships"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_organizations
CREATE TRIGGER tr_auditoria_tb_organizations
AFTER INSERT OR UPDATE ON "tb_organizations"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_organization_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_organizations
BEFORE DELETE ON "tb_organizations"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_plans
CREATE TRIGGER tr_auditoria_tb_plans
AFTER INSERT OR UPDATE ON "tb_plans"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_plan_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_plans
BEFORE DELETE ON "tb_plans"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_stores
CREATE TRIGGER tr_auditoria_tb_stores
AFTER INSERT OR UPDATE ON "tb_stores"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_store_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_stores
BEFORE DELETE ON "tb_stores"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_membership_stores
CREATE TRIGGER tr_auditoria_tb_membership_stores
AFTER INSERT OR UPDATE ON "tb_membership_stores"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_membership_store_history', 'membershipId', 'storeId');

CREATE TRIGGER tr_bloqueia_delete_tb_membership_stores
BEFORE DELETE ON "tb_membership_stores"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_products
CREATE TRIGGER tr_auditoria_tb_products
AFTER INSERT OR UPDATE ON "tb_products"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_product_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_products
BEFORE DELETE ON "tb_products"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_store_products
CREATE TRIGGER tr_auditoria_tb_store_products
AFTER INSERT OR UPDATE ON "tb_store_products"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_store_product_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_store_products
BEFORE DELETE ON "tb_store_products"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_bottle_types
CREATE TRIGGER tr_auditoria_tb_bottle_types
AFTER INSERT OR UPDATE ON "tb_bottle_types"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_bottle_type_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_bottle_types
BEFORE DELETE ON "tb_bottle_types"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_store_bottle_types
CREATE TRIGGER tr_auditoria_tb_store_bottle_types
AFTER INSERT OR UPDATE ON "tb_store_bottle_types"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_store_bottle_type_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_store_bottle_types
BEFORE DELETE ON "tb_store_bottle_types"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_customers
CREATE TRIGGER tr_auditoria_tb_customers
AFTER INSERT OR UPDATE ON "tb_customers"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_customer_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_customers
BEFORE DELETE ON "tb_customers"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_customer_store_balances
CREATE TRIGGER tr_auditoria_tb_customer_store_balances
AFTER INSERT OR UPDATE ON "tb_customer_store_balances"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_customer_store_balance_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_customer_store_balances
BEFORE DELETE ON "tb_customer_store_balances"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_customer_payments
CREATE TRIGGER tr_auditoria_tb_customer_payments
AFTER INSERT OR UPDATE ON "tb_customer_payments"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_customer_payment_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_customer_payments
BEFORE DELETE ON "tb_customer_payments"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_customer_payment_allocations
CREATE TRIGGER tr_auditoria_tb_customer_payment_allocations
AFTER INSERT OR UPDATE ON "tb_customer_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_customer_payment_allocation_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_customer_payment_allocations
BEFORE DELETE ON "tb_customer_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_customer_store_bottle_balances
CREATE TRIGGER tr_auditoria_tb_customer_store_bottle_balances
AFTER INSERT OR UPDATE ON "tb_customer_store_bottle_balances"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_customer_store_bottle_balance_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_customer_store_bottle_balances
BEFORE DELETE ON "tb_customer_store_bottle_balances"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_sales
CREATE TRIGGER tr_auditoria_tb_sales
AFTER INSERT OR UPDATE ON "tb_sales"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_sale_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_sales
BEFORE DELETE ON "tb_sales"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_sale_items
CREATE TRIGGER tr_auditoria_tb_sale_items
AFTER INSERT OR UPDATE ON "tb_sale_items"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_sale_item_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_sale_items
BEFORE DELETE ON "tb_sale_items"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_cash_registers
CREATE TRIGGER tr_auditoria_tb_cash_registers
AFTER INSERT OR UPDATE ON "tb_cash_registers"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_cash_register_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_cash_registers
BEFORE DELETE ON "tb_cash_registers"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_cash_movements
CREATE TRIGGER tr_auditoria_tb_cash_movements
AFTER INSERT OR UPDATE ON "tb_cash_movements"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_cash_movement_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_cash_movements
BEFORE DELETE ON "tb_cash_movements"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_command_tabs
CREATE TRIGGER tr_auditoria_tb_command_tabs
AFTER INSERT OR UPDATE ON "tb_command_tabs"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_command_tab_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_command_tabs
BEFORE DELETE ON "tb_command_tabs"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_command_items
CREATE TRIGGER tr_auditoria_tb_command_items
AFTER INSERT OR UPDATE ON "tb_command_items"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_command_item_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_command_items
BEFORE DELETE ON "tb_command_items"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_bottle_movements
CREATE TRIGGER tr_auditoria_tb_bottle_movements
AFTER INSERT OR UPDATE ON "tb_bottle_movements"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_bottle_movement_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_bottle_movements
BEFORE DELETE ON "tb_bottle_movements"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_notifications
CREATE TRIGGER tr_auditoria_tb_notifications
AFTER INSERT OR UPDATE ON "tb_notifications"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_notification_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_notifications
BEFORE DELETE ON "tb_notifications"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_notification_reads
CREATE TRIGGER tr_auditoria_tb_notification_reads
AFTER INSERT OR UPDATE ON "tb_notification_reads"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_notification_read_history', 'notificationId', 'userId');

CREATE TRIGGER tr_bloqueia_delete_tb_notification_reads
BEFORE DELETE ON "tb_notification_reads"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

