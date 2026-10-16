# SaaS Distribuidora

SaaS multi-tenant para distribuidoras de bebidas: PDV, estoque, caixa, comandas,
vasilhames e fiado. Hierarquia: `Organization` (cobrança) → `Company` (distribuidora)
→ `Store` (loja). O acesso é por papel em cada loja (`OWNER` > `MANAGER` > `EMPLOYEE`;
não existe `ADMIN`).

- `backend/`: NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16.
- `frontend/`: será refeito em **Next.js (App Router) + React + TypeScript (strict) +
  Tailwind CSS** (decisão do usuário). O código atual é legado (React + Vite + JavaScript)
  e só serve de referência visual.

## Leia antes de mexer

| Documento | Quando |
|---|---|
| [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) | Qualquer coisa que toque o banco: tabelas, relações, auditoria, soft delete, migrations |
| [plano_implementacao_backend.md](plano_implementacao_backend.md) | Implementação do backend: fases, regras gerais e **paradas obrigatórias (P1–P10)** em que é preciso perguntar ao usuário |
| [plano_implementacao_frontend.md](plano_implementacao_frontend.md) | Implementação do frontend |
| [docs/API.md](docs/API.md) | Lista das rotas do backend e quem pode chamar cada uma (**gerada**: rode `npm run docs:api` em `backend/` ao mudar rotas ou permissões; não edite à mão) |
| [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | Fonte da verdade do modelo de dados |

`GUIA_IMPLEMENTACAO_AUDITORIA.md` descreve **outro projeto**. Não siga o
`AuditInterceptor` dele (aqui o interceptor só abre o contexto de auditoria; quem grava
os campos é a extensão do Prisma).

## Estado atual

- O banco e o schema estão no modelo novo (multi-tenant, auditoria, cobrança com Asaas,
  refresh tokens).
- **Backend implementado** (`plano_implementacao_backend.md`, status e relatório nele):
  fundação, autenticação, empresas/lojas/membros, catálogo, vasilhames, clientes/fiado,
  caixa, vendas, comandas, dashboard, auditoria, plataforma e notificações, com 377
  testes. **Só a cobrança com Asaas (Fase 10) não foi feita**, por decisão do usuário:
  hoje o status da assinatura é ajustado manualmente por `PATCH /api/platform/organizations/:id`.
- **O frontend ainda é legado** (versão single-tenant) e será refeito pelo plano dele. As
  regras de negócio antigas ficam no git (`git show a4ff703:<arquivo>`).

## Regras que nunca podem ser quebradas

**Banco**
- Toda tabela de negócio `tb_*` tem um histórico `th_*_history` gravado **só por
  trigger** (`fc_auditoria`). Nunca escrever em `th_*`.
- Toda escrita em `tb_*` precisa de `modifierId` (usuário) e `modifiedEndpoint` (rota).
  Sem isso, o histórico atribui a mudança ao autor anterior. **Isso já é automático:** um
  interceptor global (`AuditContextInterceptor`) guarda usuário e rota no `AuditContext` e
  a extensão do Prisma grava os campos; sem contexto, a escrita falha. **Não passe esses
  campos à mão** e não use escrita aninhada (`create: {...}` dentro de outro create): a
  extensão recusa, porque o filho ficaria sem autor. Jobs e seed usam
  `AuditContext.runAsSystem` (`modifierId = 'system'`).
- **Soft delete obrigatório:** o banco recusa `DELETE`. Excluir =
  `deletedAt = now()`. Consultas filtram `deletedAt: null`. Os únicos são globais:
  reative o registro em vez de recriar.
- Sem `onDelete: Cascade`; as relações usam `Restrict`.
- `StoreBottleType.stock` e os saldos de cliente (`CustomerStoreBalance.balance`,
  `CustomerStoreBottleBalance.balance`) **não têm histórico**: só mudam junto com o
  registro da movimentação (`BottleMovement`, `Sale` fiado,
  `CustomerPaymentAllocation`). Alterar só pelos helpers `src/bottles/bottle-ledger.ts` e
  `src/customers/customer-ledger.ts`.
- **Devolução de vasilhame só na mesma loja da dívida** (decisão do usuário): o schema não
  consegue registrar devolução entre lojas (`BottleMovement` tem um só `storeId`), então
  devolver na loja B uma dívida da loja A é recusado com 409. Mudar isso exige mudar o
  schema (pedir aprovação). Veja `docs/BANCO_DE_DADOS.md` §3.3.
- Dinheiro é `Float`: arredondar toda conta para centavos (`roundMoney`).
- **Mudança de schema exige aprovação do usuário.** Coluna nova vai também no
  `*History`; tabela nova ganha os dois triggers. Sempre por migration, nunca SQL
  manual. Detalhes em `docs/BANCO_DE_DADOS.md` §7.

**Multi-tenancy**
- Os ids da company/loja vêm na rota (`/companies/:companyId/...`,
  `/stores/:storeId/...`). Toda consulta é filtrada pelo tenant; ids recebidos no body
  também são validados. Recurso de outro tenant → 404.
- Em rotas de company, ids de recursos aninhados **não** podem se chamar `storeId` nem
  `companyId` (nomes reservados ao `TenantGuard`): use `:id`, `:targetStoreId` etc.

**Sessão (decidido pelo usuário)**
- **Access token** JWT de 15 min + **refresh token com rotação** (opaco, só o hash fica em
  `tb_refresh_tokens`, validade de 30 dias). Cada renovação devolve um par novo e invalida o
  refresh token usado; reutilizar um já usado derruba a sessão inteira. Troca de senha e
  logout geral revogam tudo. O guard confere a cada requisição se o usuário está ativo.
  Detalhes em `docs/BANCO_DE_DADOS.md` §3.1.1.
- Rate limit em memória (`@nestjs/throttler`); **sem Redis e sem cache** por enquanto.

**Assinatura (decidido pelo usuário)**
- Trial de **14 dias**; carência de **5 dias** após a mensalidade vencer.
- Inadimplência ou trial vencido **nunca bloqueia o sistema inteiro**: vira **somente
  leitura**. Continuam liberados consultar tudo, **fechar o caixa já aberto** e
  **pagar a assinatura**. Todo o resto fica bloqueado, **inclusive receber pagamento
  de fiado**, até a assinatura ser paga.
- Gateway: **Asaas** (cartão recorrente + Pix Automático). O número do cartão nunca
  passa pela nossa API nem pelo nosso frontend.

**Código**
- Bodies tipados com classe DTO (class-validator), nunca `any` ou `Dto & {...}` (isso
  desliga a validação). Nunca retornar `passwordHash`. Preços sempre lidos do banco.

**Frontend (decidido pelo usuário)**
- O sistema tem uma **Central de Dúvidas** que ensina donos, gerentes e atendentes a usar
  cada funcionalidade e **onde encontrá-la no menu**. Toda tela criada ou alterada só está
  pronta quando o artigo dela foi criado ou atualizado. Detalhes na seção "Central de
  Dúvidas" do `plano_implementacao_frontend.md`.

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
npm run lint                       # formata (Prettier) e confere; deve terminar sem erros
npm test                           # todos os testes (unitários, de service e e2e)
npm run db:seed                    # dados de demonstração (dev; não duplica)
npm run docs:api                   # regenera docs/API.md
```

- `prisma migrate dev` **não funciona em sessão não interativa**. Para criar uma
  migration: alterar o schema, gerar o SQL com
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_<nome>/migration.sql`,
  acrescentar triggers se houver tabela nova, aplicar com `migrate deploy` e conferir
  com `migrate diff ... --exit-code` (0 = sem diferença).
- `prisma migrate reset` apaga o banco: só com confirmação explícita do usuário.
- Para limpar dados em testes use `TRUNCATE`, nunca `deleteMany`.
- **Testes** (`npm test`, `npm run test:e2e`) rodam no banco `distribuidora_test`, criado e
  migrado sozinho; recusam rodar em outro banco. Os testes de service usam o Prisma
  **real** (extensão de auditoria e triggers incluídos), não mocks; só o e-mail é falso.
  Todo service novo precisa de testes. Em testes de service, o `await` do Prisma tem de
  acontecer dentro de `ctx.asRequest(...)`/`AuditContext` (sem contexto a escrita falha).
- Versões: `@nestjs/config` ^4, `@nestjs/schedule` ^6 e `@nestjs/swagger` ^11. As linhas
  12 desses pacotes são ESM-only/para Nest 12 e quebram o Jest: não atualize.
- **Produção:** a imagem Docker não roda migrations. Elas são aplicadas com
  `prisma migrate deploy` na pipeline de deploy (que ainda não existe e não deve ser
  implementada sem pedido do usuário).
- **`.env` é do usuário:** não edite. Se faltar variável, diga qual e peça para ele
  preencher (inclusive `JWT_SECRET`, que ele define).

**Gravações sem usuário logado** usam `AuditContext.runAsSystem(origem, fn)`, e a `origem`
vai exatamente assim para `modifiedEndpoint`: `'seed'`, `'webhook:asaas'` ou
`'job:<nome-do-job>'`. Quando o autor é alguém ainda não autenticado (cadastro, login,
esqueci a senha), use `AuditContext.actAs(idDoUsuario, fn)`.
