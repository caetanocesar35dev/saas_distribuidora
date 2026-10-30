# API: rotas e permissões

> **Arquivo gerado** por `npm run docs:api` a partir do código (controllers e decorators). Não edite à mão:
> rode o comando de novo ao mudar rotas ou permissões. O Swagger (`/api/docs`, fora de produção) lista as
> rotas, mas ainda não descreve os corpos nem as respostas: para isso, veja os DTOs (`src/**/dto/*.ts`) e
> os services. O frontend mantém esses contratos em `frontend/src/lib/api/types.ts`.

Total: **118 rotas**. Todas começam com `/api`.

## Como ler

- **Quem pode:** o papel mínimo. Hierarquia por loja: `OWNER` > `MANAGER` > `EMPLOYEE`. Em rotas de empresa, vale o maior papel do usuário em alguma loja dela.
- **Recurso de outra empresa/loja → 404** (nunca 403), para não revelar que existe. Papel insuficiente dentro do próprio tenant → 403.
- **Somente leitura:** quando a assinatura está vencida (teste acabou, atraso depois da carência ou cancelada), as leituras (`GET`) continuam e as escritas respondem **402** `{ code: "SUBSCRIPTION_READ_ONLY", reason }`, exceto as marcadas "Funciona (exceção)": fechar o caixa já aberto.
- Rotas fora de empresa/loja (`/auth`, `/me`, `/plans`, `/platform`) não dependem da assinatura (—).
- Os ids de empresa e loja ficam **na URL** (`:companyId`, `:storeId`), nunca em headers.

## Regras que dependem do conteúdo da requisição

- `POST /stores/:storeId/cash-register/movements`: entrada (`IN`) é de funcionário; **saída (`OUT`) exige gerente**.
- `POST /stores/:storeId/bottle-movements`: envio/recebimento de fornecedor é de funcionário; **`MANUAL_ADJUSTMENT` exige gerente**.
- `GET /companies/:companyId/customers/:id/balances` e `/payments`: **funcionário só vê as lojas dele e não recebe o `total`**; gerente e dono veem tudo.
- `POST /stores/:storeId/customers/:customerId/bottle-returns`: a devolução só abate a dívida **da própria loja** (409 se o cliente deve em outra).
- **Funcionário nunca recebe custo nem lucro**: `costPrice`, `totalCost`, `totalProfit` e `profit` são retirados de toda resposta de loja ou empresa (`HideCostInterceptor`).
- `POST/PATCH /companies/:companyId/customers`: o campo `creditLimit` **exige gerente** (403 para o funcionário).
- `POST /stores/:storeId/sales` e `POST /stores/:storeId/command-tabs/:id/close` no fiado: acima do limite de crédito do cliente (soma de todas as lojas), **funcionário recebe 403**; gerente e dono recebem 409, a menos que enviem `allowOverCreditLimit: true`. O funcionário passa enviando `managerApproval: { email, password }` de um gerente ou dono **desta loja** (400 se a senha estiver errada, 403 se não for gerente da loja, 429 depois de 5 erros por e-mail em 15 min).
- `GET /companies/:companyId/products?deleted=true`: lista só os produtos excluídos; `POST /companies/:companyId/products/:id/restore` os reativa junto com as ofertas das lojas.
- `PATCH /organizations/:organizationId/plan`: o responsável pela assinatura troca de plano (vale na hora, **liberado em somente leitura**). 409 para o plano gratuito (só do período de teste), para o plano atual e para o downgrade que não cabe (mais empresas, ou uma empresa com mais lojas, que o plano novo permite).
- `GET /companies/:companyId/customers?deleted=true`: lista só os clientes excluídos, **exige gerente** (403 para o funcionário).
- `POST /companies/:companyId/stores/:id/restore`: reativa a loja excluída respeitando o limite de lojas do plano (409 se já estiver no limite). `POST /companies/:companyId/members/:membershipId/restore` devolve à pessoa removida as lojas e os papéis que ela tinha ao sair (409 se todas essas lojas foram excluídas).
- **Gerente geral** (`Membership.isGeneralManager`): é MANAGER em todas as lojas da empresa (também nas criadas depois) e passa nas rotas "OWNER ou gerente geral" (painel e histórico da empresa, editar loja, equipe). Na equipe, não mexe em donos nem em outro gerente geral e não dá o papel de dono (403). Mudar o papel ou tirar de uma loja quem é gerente geral → 409 (desmarque antes). `PUT /companies/:companyId/members/:membershipId/general-manager` `{ isGeneralManager }` é só do dono (409 para dono ou a própria pessoa).
- `POST /auth/signup`: exige `acceptTerms: true` (aceite dos termos de uso e da política de privacidade). `referralCode` (opcional) é o código de indicação de um cliente ou representante: 400 se não existir; grava a indicação pendente e o desconto de quem se cadastrou.
- `GET /organizations/:organizationId/referral` ("Indique e ganhe"): cria o código da organização na primeira chamada. A recompensa de quem indicou (desconto do cliente ou comissão do representante) só vale quando o indicado paga: hoje, quando `PATCH /platform/organizations/:id` põe `subscriptionStatus: ACTIVE`.
- `POST /platform/referrals/:id/commission-paid`: só indicação de representante já confirmada e ainda não paga (409 nos outros casos). `POST /platform/referrals/:id/cancel` anula a indicação e os meses de desconto não usados (409 se a comissão já foi paga).
- Rotas `/platform/*`: `SUPPORT` só lê; `SUPERADMIN` lê e escreve (cada escrita aparece como "Plataforma: SUPERADMIN").

## audit

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId/audit/:entity/:id` | Empresa: OWNER ou gerente geral | Funciona |
| GET | `/api/stores/:storeId/audit/:entity/:id` | Loja: MANAGER ou mais | Funciona |

## auth

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| POST | `/api/auth/change-password` | Qualquer usuário logado | — |
| POST | `/api/auth/forgot-password` | Pública (sem login) | — |
| POST | `/api/auth/login` | Pública (sem login) | — |
| POST | `/api/auth/logout` | Pública (sem login) | — |
| POST | `/api/auth/logout-all` | Qualquer usuário logado | — |
| POST | `/api/auth/refresh` | Pública (sem login) | — |
| POST | `/api/auth/reset-password` | Pública (sem login) | — |
| POST | `/api/auth/signup` | Pública (sem login) | — |

## bottles

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/stores/:storeId/bottle-movements` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/bottle-movements` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| GET | `/api/stores/:storeId/bottle-stock` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/customers/:customerId/bottle-loans` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/customers/:customerId/bottle-returns` | Loja: EMPLOYEE ou mais | Bloqueada (402) |

## cash-register

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/stores/:storeId/cash-register/:id` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/cash-register/close` | Loja: EMPLOYEE ou mais | **Funciona (exceção)** |
| GET | `/api/stores/:storeId/cash-register/current` | Loja: EMPLOYEE ou mais | Funciona |
| GET | `/api/stores/:storeId/cash-register/history` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/cash-register/movements` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/cash-register/open` | Loja: EMPLOYEE ou mais | Bloqueada (402) |

## catalog

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId/bottle-types` | Empresa: EMPLOYEE ou mais | Funciona |
| POST | `/api/companies/:companyId/bottle-types` | Empresa: MANAGER ou mais | Bloqueada (402) |
| DELETE | `/api/companies/:companyId/bottle-types/:id` | Empresa: MANAGER ou mais | Bloqueada (402) |
| PATCH | `/api/companies/:companyId/bottle-types/:id` | Empresa: MANAGER ou mais | Bloqueada (402) |
| POST | `/api/companies/:companyId/bottle-types/:id/restore` | Empresa: MANAGER ou mais | Bloqueada (402) |
| GET | `/api/companies/:companyId/products` | Empresa: EMPLOYEE ou mais | Funciona |
| POST | `/api/companies/:companyId/products` | Empresa: MANAGER ou mais | Bloqueada (402) |
| GET | `/api/companies/:companyId/products/:id` | Empresa: EMPLOYEE ou mais | Funciona |
| DELETE | `/api/companies/:companyId/products/:id` | Empresa: MANAGER ou mais | Bloqueada (402) |
| PATCH | `/api/companies/:companyId/products/:id` | Empresa: MANAGER ou mais | Bloqueada (402) |
| POST | `/api/companies/:companyId/products/:id/restore` | Empresa: MANAGER ou mais | Bloqueada (402) |
| GET | `/api/stores/:storeId/store-products` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/store-products` | Loja: MANAGER ou mais | Bloqueada (402) |
| GET | `/api/stores/:storeId/store-products/:id` | Loja: EMPLOYEE ou mais | Funciona |
| DELETE | `/api/stores/:storeId/store-products/:id` | Loja: MANAGER ou mais | Bloqueada (402) |
| PATCH | `/api/stores/:storeId/store-products/:id` | Loja: MANAGER ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/store-products/:id/stock-adjustments` | Loja: MANAGER ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/store-products/:id/stock-entries` | Loja: MANAGER ou mais | Bloqueada (402) |
| GET | `/api/stores/:storeId/store-products/by-code/:code` | Loja: EMPLOYEE ou mais | Funciona |
| GET | `/api/stores/:storeId/store-products/low-stock` | Loja: MANAGER ou mais | Funciona |

## companies

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId` | Empresa: EMPLOYEE ou mais | Funciona |
| PATCH | `/api/companies/:companyId` | Empresa: OWNER | Bloqueada (402) |

## customers

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId/customers` | Empresa: EMPLOYEE ou mais | Funciona |
| POST | `/api/companies/:companyId/customers` | Empresa: EMPLOYEE ou mais | Bloqueada (402) |
| GET | `/api/companies/:companyId/customers/:id` | Empresa: EMPLOYEE ou mais | Funciona |
| DELETE | `/api/companies/:companyId/customers/:id` | Empresa: MANAGER ou mais | Bloqueada (402) |
| PATCH | `/api/companies/:companyId/customers/:id` | Empresa: EMPLOYEE ou mais | Bloqueada (402) |
| GET | `/api/companies/:companyId/customers/:id/balances` | Empresa: EMPLOYEE ou mais | Funciona |
| GET | `/api/companies/:companyId/customers/:id/payments` | Empresa: EMPLOYEE ou mais | Funciona |
| POST | `/api/companies/:companyId/customers/:id/restore` | Empresa: MANAGER ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/customers/:customerId/payments` | Loja: EMPLOYEE ou mais | Bloqueada (402) |

## dashboard

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId/dashboard` | Empresa: OWNER ou gerente geral | Funciona |
| GET | `/api/stores/:storeId/dashboard` | Loja: MANAGER ou mais | Funciona |
| GET | `/api/stores/:storeId/onboarding` | Loja: OWNER ou mais | Funciona |

## health

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/health` | Pública (sem login) | — |

## me

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/me` | Qualquer usuário logado | — |
| PATCH | `/api/me` | Qualquer usuário logado | — |
| GET | `/api/me/memberships` | Qualquer usuário logado | — |
| GET | `/api/me/notifications` | Qualquer usuário logado | — |
| POST | `/api/me/notifications/:id/read` | Qualquer usuário logado | — |
| GET | `/api/me/notifications/unread-count` | Qualquer usuário logado | — |

## members

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId/members` | Empresa: OWNER ou gerente geral | Funciona |
| POST | `/api/companies/:companyId/members` | Empresa: OWNER ou gerente geral | Bloqueada (402) |
| DELETE | `/api/companies/:companyId/members/:membershipId` | Empresa: OWNER ou gerente geral | Bloqueada (402) |
| PUT | `/api/companies/:companyId/members/:membershipId/general-manager` | Empresa: OWNER | Bloqueada (402) |
| POST | `/api/companies/:companyId/members/:membershipId/restore` | Empresa: OWNER | Bloqueada (402) |
| PUT | `/api/companies/:companyId/members/:membershipId/stores/:targetStoreId` | Empresa: OWNER ou gerente geral | Bloqueada (402) |
| DELETE | `/api/companies/:companyId/members/:membershipId/stores/:targetStoreId` | Empresa: OWNER ou gerente geral | Bloqueada (402) |
| GET | `/api/companies/:companyId/members/removed` | Empresa: OWNER | Funciona |

## organizations

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| POST | `/api/organizations/:organizationId/companies` | Responsável pela cobrança | Bloqueada (402) |
| PATCH | `/api/organizations/:organizationId/plan` | Responsável pela cobrança | **Funciona (exceção)** |
| GET | `/api/organizations/:organizationId/referral` | Responsável pela cobrança | Funciona |
| GET | `/api/organizations/mine` | Qualquer usuário logado | — |

## plans

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/plans` | Pública (sem login) | — |

## platform

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/platform/notifications` | Plataforma: SUPPORT ou SUPERADMIN | — |
| POST | `/api/platform/notifications` | Plataforma: SUPERADMIN | — |
| DELETE | `/api/platform/notifications/:id` | Plataforma: SUPERADMIN | — |
| PATCH | `/api/platform/notifications/:id` | Plataforma: SUPERADMIN | — |
| GET | `/api/platform/organizations` | Plataforma: SUPPORT ou SUPERADMIN | — |
| GET | `/api/platform/organizations/:id` | Plataforma: SUPPORT ou SUPERADMIN | — |
| PATCH | `/api/platform/organizations/:id` | Plataforma: SUPERADMIN | — |
| GET | `/api/platform/plans` | Plataforma: SUPPORT ou SUPERADMIN | — |
| POST | `/api/platform/plans` | Plataforma: SUPERADMIN | — |
| DELETE | `/api/platform/plans/:id` | Plataforma: SUPERADMIN | — |
| PATCH | `/api/platform/plans/:id` | Plataforma: SUPERADMIN | — |
| POST | `/api/platform/plans/:id/restore` | Plataforma: SUPERADMIN | — |
| GET | `/api/platform/plans/deleted` | Plataforma: SUPPORT ou SUPERADMIN | — |
| GET | `/api/platform/referrals` | Plataforma: SUPPORT ou SUPERADMIN | — |
| POST | `/api/platform/referrals/:id/cancel` | Plataforma: SUPERADMIN | — |
| POST | `/api/platform/referrals/:id/commission-paid` | Plataforma: SUPERADMIN | — |
| GET | `/api/platform/referrals/summary` | Plataforma: SUPPORT ou SUPERADMIN | — |
| GET | `/api/platform/representatives` | Plataforma: SUPPORT ou SUPERADMIN | — |
| POST | `/api/platform/representatives` | Plataforma: SUPERADMIN | — |
| DELETE | `/api/platform/representatives/:id` | Plataforma: SUPERADMIN | — |
| PATCH | `/api/platform/representatives/:id` | Plataforma: SUPERADMIN | — |
| POST | `/api/platform/representatives/:id/restore` | Plataforma: SUPERADMIN | — |
| GET | `/api/platform/users` | Plataforma: SUPPORT ou SUPERADMIN | — |
| PATCH | `/api/platform/users/:id/active` | Plataforma: SUPERADMIN | — |

## sales

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/stores/:storeId/command-tabs` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/command-tabs` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| GET | `/api/stores/:storeId/command-tabs/:id` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/command-tabs/:id/cancel` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/command-tabs/:id/close` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/command-tabs/:id/items` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| DELETE | `/api/stores/:storeId/command-tabs/:id/items/:itemId` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| GET | `/api/stores/:storeId/sales` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/sales` | Loja: EMPLOYEE ou mais | Bloqueada (402) |
| GET | `/api/stores/:storeId/sales/:id` | Loja: EMPLOYEE ou mais | Funciona |
| POST | `/api/stores/:storeId/sales/:id/cancel` | Loja: MANAGER ou mais | Bloqueada (402) |
| POST | `/api/stores/:storeId/sales/late` | Loja: MANAGER ou mais | Bloqueada (402) |

## stores

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId/stores` | Empresa: EMPLOYEE ou mais | Funciona |
| POST | `/api/companies/:companyId/stores` | Empresa: OWNER | Bloqueada (402) |
| GET | `/api/companies/:companyId/stores/:id` | Empresa: EMPLOYEE ou mais | Funciona |
| DELETE | `/api/companies/:companyId/stores/:id` | Empresa: OWNER | Bloqueada (402) |
| PATCH | `/api/companies/:companyId/stores/:id` | Empresa: OWNER ou gerente geral | Bloqueada (402) |
| POST | `/api/companies/:companyId/stores/:id/restore` | Empresa: OWNER | Bloqueada (402) |
| GET | `/api/companies/:companyId/stores/deleted` | Empresa: OWNER | Funciona |
