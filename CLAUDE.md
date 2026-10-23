# SaaS Distribuidora

SaaS multi-tenant para distribuidoras de bebidas: PDV, estoque, caixa, comandas,
vasilhames e fiado. Hierarquia: `Organization` (cobrança) → `Company` (distribuidora)
→ `Store` (loja). O acesso é por papel em cada loja (`OWNER` > `MANAGER` > `EMPLOYEE`;
não existe `ADMIN`).

- `backend/`: NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16.
- `frontend/`: **Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS +
  shadcn/ui** (decisão do usuário). Substituiu o legado em Vite, que só existe no git.

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
  caixa, vendas, comandas, dashboard, auditoria, plataforma e notificações, com 392
  testes. **Só a cobrança com Asaas (Fase 10) não foi feita**, por decisão do usuário:
  hoje o status da assinatura é ajustado manualmente por `PATCH /api/platform/organizations/:id`.
- **Frontend em Next.js implementado** (`plano_implementacao_frontend.md`, relatório nele):
  login/cadastro, seleção de empresa e loja, PDV, caixa, comandas, vendas, estoque, produtos,
  vasilhames, clientes/fiado, painéis, histórico de alterações, equipe, lojas, assinatura
  (aviso e somente leitura), área da plataforma (`/plataforma`) e Central de Dúvidas, com 78
  testes unitários e 34 de ponta a ponta. **Falta** só a tela de pagamento da assinatura
  (depende do Asaas, Fase 10 do backend). As regras de negócio do sistema antigo ficam no git
  (`git show a4ff703:<arquivo>`).

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
- Rate limit em memória (`@nestjs/throttler`); **sem Redis e sem cache** por enquanto. A chave é o
  usuário logado ou o IP; o frontend chama a API por um BFF e repassa o IP em `X-Forwarded-For`,
  por isso o backend confia nesse cabeçalho **só** de proxies de loopback/rede privada
  (`trust proxy` em `app.setup.ts`).

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
- **Atendente (EMPLOYEE) nunca recebe custo nem lucro:** o `HideCostInterceptor` global tira
  `costPrice`, `totalCost`, `totalProfit` e `profit` de toda resposta de rota de loja/empresa
  quando o papel é menor que MANAGER. Campo novo de custo ou lucro: use um desses nomes (ou
  inclua o nome novo em `COST_KEYS`).

**Fiado: limite de crédito (decidido pelo usuário)**
- `Customer.creditLimit` (null = sem limite) vale contra a dívida **somada em todas as lojas**.
  Só gerente e dono definem (403 para o atendente). Na venda fiada (PDV e fechamento de
  comanda), acima do limite o atendente é barrado (403) e gerente/dono só passam com
  `allowOverCreditLimit: true` (sem isso, 409). A conferência é `assertCreditLimit`
  (`src/customers/credit-limit.ts`), dentro da transação da venda.

**LGPD (decidido pelo usuário)**
- O cadastro público exige `acceptTerms: true` e grava `User.termsAcceptedAt` e `termsVersion`.
  Os textos ficam em `frontend/src/content/legal.ts` (páginas `/termos` e `/privacidade`, são um
  **modelo**: falta revisão jurídica). Os dados de quem opera o sistema vêm das variáveis
  `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_CNPJ`, `LEGAL_CONTACT_EMAIL` e `LEGAL_FORUM` do
  ambiente do frontend (decidido pelo usuário; ver `frontend/.env.example`). Mudou o texto: troque
  `TERMS_VERSION` nos dois lugares (`backend/src/auth/terms.ts` e o `legal.ts`).

**Frontend (decidido pelo usuário)**
- O sistema tem uma **Central de Dúvidas** que ensina donos, gerentes e atendentes a usar
  cada funcionalidade e **onde encontrá-la no menu**. Toda tela criada ou alterada só está
  pronta quando o artigo dela foi criado ou atualizado (`frontend/src/content/duvidas/`; o
  botão "?" de cada tela aponta para o artigo). Detalhes na seção "Central de Dúvidas" do
  `plano_implementacao_frontend.md`.
- **Sessão no navegador (decidido pelo usuário, F1):** o navegador só fala com o próprio Next
  (`/api/*`), que repassa ao backend (BFF). Os tokens ficam em **cookies httpOnly**; o
  JavaScript da página nunca os vê. O BFF renova a sessão sozinho, em fila (refresh token é de
  uso único). Env do servidor: `API_URL` (não é `NEXT_PUBLIC_`).
- Os tipos da API ficam só em `frontend/src/lib/api/types.ts`, escritos à mão (o Swagger do
  backend não descreve corpos nem respostas). **Mudou um DTO ou uma resposta no backend: atualize
  esse arquivo.** Nunca enviar preço/custo em venda ou comanda; ids de empresa/loja só na URL.
- Bibliotecas além da stack (aprovadas em F2): TanStack Query, React Hook Form + Zod, Recharts,
  Vitest e Playwright. Outras só com aprovação. Componentes do shadcn são **Base UI** (`render=`, não `asChild`).
- **CNPJ é alfanumérico** (12 primeiros caracteres letras ou dígitos, 2 verificadores numéricos):
  nunca tratar com `onlyDigits`; usar `normalizeCnpj`/`isValidCnpj` (backend em
  `src/common/utils/document.ts`, frontend em `src/lib/format.ts`). Grava sem máscara e em
  maiúsculas. No cadastro, em "Nova empresa" e em Lojas (CNPJ opcional da loja), o **navegador**
  consulta `publica.cnpj.ws` (3 consultas/min por IP, por isso não passa pelo BFF) e preenche
  razão social e nome fantasia, ou o endereço e telefone da loja (`useCnpjAutofill`); a consulta é
  só sugestão (decidido pelo usuário).

## Ambiente local

- Postgres em Docker: container `banco_saas_distribuidora`, porta **5437**,
  `DATABASE_URL` em `backend/.env`. **Não existe docker-compose.** O container não tem
  restart automático: se o banco não responder, rode `docker start banco_saas_distribuidora`.
- Container novo (Redis, Mailpit etc.) só com aprovação do usuário.
- Portas em desenvolvimento: API na **3001** e frontend Next na **3000**. O padrão de
  `CORS_ORIGINS` e `APP_URL` no backend é `http://localhost:3000` (decidido pelo usuário).

## Comandos do frontend (em `frontend/`)

```bash
npm run dev          # http://localhost:3000 (precisa do backend na 3001)
npm run build        # build de produção
npm run lint         # ESLint; deve terminar sem erros nem avisos
npx tsc --noEmit     # tipos
npm test             # unitários (Vitest)
npm run test:e2e     # ponta a ponta (Playwright; precisa de banco, backend e seed; grava dados)
```

Tela ou regra nova no frontend precisa de teste: lógica pura em `*.test.ts` (Vitest) e fluxo
com banco em `e2e/` (Playwright). O login do backend tem limite (5/min, 20/h por e-mail), por
isso os testes de ponta a ponta reaproveitam sessões salvas (`e2e/global-setup.ts`).

Antes de mexer em API de rota, layout ou arquivo especial do Next, leia o guia em
`frontend/node_modules/next/dist/docs/` (versão nova, com mudanças; ver `frontend/AGENTS.md`).
Não monte código com `node -e`/heredoc no shell (os escapes quebram): use Write/Edit.

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
