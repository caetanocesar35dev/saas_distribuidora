# SaaS Distribuidora

SaaS multi-tenant para distribuidoras de bebidas: PDV, estoque, caixa, comandas,
vasilhames e fiado. Hierarquia: `Organization` (cobrança) → `Company` (distribuidora)
→ `Store` (loja). O acesso é por papel em cada loja (`OWNER` > `MANAGER` > `EMPLOYEE`;
não existe `ADMIN`).

- `backend/`: NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16.
- `frontend/`: React + Vite.

## Leia antes de mexer

| Documento | Quando |
|---|---|
| [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) | Qualquer coisa que toque o banco: tabelas, relações, auditoria, soft delete, migrations |
| [plano_implementacao_backend.md](plano_implementacao_backend.md) | Implementação do backend: fases, regras gerais e **paradas obrigatórias (P1–P10)** em que é preciso perguntar ao usuário |
| [plano_implementacao_frontend.md](plano_implementacao_frontend.md) | Implementação do frontend |
| [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | Fonte da verdade do modelo de dados |

`GUIA_IMPLEMENTACAO_AUDITORIA.md` descreve **outro projeto**. Não siga o
`AuditInterceptor` dele.

## Estado atual

- O banco e o schema estão no modelo novo (multi-tenant, auditoria, cobrança com Asaas).
- **O código de `backend/src` e do frontend é legado** (versão single-tenant) e não
  compila contra o schema. Ele será refeito seguindo os planos. As regras de negócio
  antigas ficam no git (`git show a4ff703:<arquivo>`).

## Regras que nunca podem ser quebradas

**Banco**
- Toda tabela de negócio `tb_*` tem um histórico `th_*_history` gravado **só por
  trigger** (`fc_auditoria`). Nunca escrever em `th_*`.
- Toda escrita em `tb_*` precisa de `modifierId` (usuário) e `modifiedEndpoint` (rota).
  Sem isso, o histórico atribui a mudança ao autor anterior. Jobs e seed usam
  `modifierId = 'system'`.
- **Soft delete obrigatório:** o banco recusa `DELETE`. Excluir =
  `deletedAt = now()`. Consultas filtram `deletedAt: null`. Os únicos são globais:
  reative o registro em vez de recriar.
- Sem `onDelete: Cascade`; as relações usam `Restrict`.
- `StoreBottleType.stock` e os saldos de cliente (`CustomerStoreBalance.balance`,
  `CustomerStoreBottleBalance.balance`) **não têm histórico**: só mudam junto com o
  registro da movimentação (`BottleMovement`, `Sale` fiado,
  `CustomerPaymentAllocation`).
- **Mudança de schema exige aprovação do usuário.** Coluna nova vai também no
  `*History`; tabela nova ganha os dois triggers. Sempre por migration, nunca SQL
  manual. Detalhes em `docs/BANCO_DE_DADOS.md` §7.

**Multi-tenancy**
- Os ids da company/loja vêm na rota (`/companies/:companyId/...`,
  `/stores/:storeId/...`). Toda consulta é filtrada pelo tenant; ids recebidos no body
  também são validados. Recurso de outro tenant → 404.

**Assinatura (decidido pelo usuário)**
- Trial de **14 dias**; carência de **5 dias** após a mensalidade vencer.
- Inadimplência ou trial vencido **nunca bloqueia o sistema inteiro**: vira **somente
  leitura**. Continuam liberados consultar tudo, **fechar o caixa já aberto** e
  **pagar a assinatura**.
- Gateway: **Asaas** (cartão recorrente + Pix Automático). O número do cartão nunca
  passa pela nossa API nem pelo nosso frontend.

**Código**
- Bodies tipados com classe DTO (class-validator), nunca `any` ou `Dto & {...}` (isso
  desliga a validação). Nunca retornar `passwordHash`. Preços sempre lidos do banco.

## Ambiente local

- Postgres em Docker: container `banco_saas_distribuidora`, porta **5437**,
  `DATABASE_URL` em `backend/.env`. **Não existe docker-compose.** O container não tem
  restart automático: se o banco não responder, rode `docker start banco_saas_distribuidora`.
- Container novo (Redis, Mailpit etc.) só com aprovação do usuário.

## Comandos (em `backend/`)

```bash
npx prisma validate
npx prisma migrate deploy          # aplica migrations pendentes
npx prisma migrate status
npx prisma generate
npm run build
npm run lint
npm test
```

- `prisma migrate dev` **não funciona em sessão não interativa**. Para criar uma
  migration: alterar o schema, gerar o SQL com
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_<nome>/migration.sql`,
  acrescentar triggers se houver tabela nova, aplicar com `migrate deploy` e conferir
  com `migrate diff ... --exit-code` (0 = sem diferença).
- `prisma migrate reset` apaga o banco: só com confirmação explícita do usuário.
- Para limpar dados em testes use `TRUNCATE`, nunca `deleteMany`.
