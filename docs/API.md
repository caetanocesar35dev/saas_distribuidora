# API: rotas e permissões

> **Arquivo gerado** por `npm run docs:api` a partir do código (controllers e decorators). Não edite à mão:
> rode o comando de novo ao mudar rotas ou permissões. O Swagger (`/api/docs`, fora de produção) lista as
> rotas, mas ainda não descreve os corpos nem as respostas: para isso, veja os DTOs (`src/**/dto/*.ts`) e
> os services. O frontend mantém esses contratos em `frontend/src/lib/api/types.ts`.

Total: **100 rotas**. Todas começam com `/api`.

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
- `POST /stores/:storeId/sales` e `POST /stores/:storeId/command-tabs/:id/close` no fiado: acima do limite de crédito do cliente (soma de todas as lojas), **funcionário recebe 403**; gerente e dono recebem 409, a menos que enviem `allowOverCreditLimit: true`.
- `POST /auth/signup`: exige `acceptTerms: true` (aceite dos termos de uso e da política de privacidade).
- Rotas `/platform/*`: `SUPPORT` só lê; `SUPERADMIN` lê e escreve (cada escrita aparece como "Plataforma: SUPERADMIN").

## audit

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| GET | `/api/companies/:companyId/audit/:entity/:id` | Empresa: OWNER ou mais | Funciona |
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
| PATCH | `/api/companies/:companyId` | Empresa: OWNER ou mais | Bloqueada (402) |

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
| GET | `/api/companies/:companyId/dashboard` | Empresa: OWNER ou mais | Funciona |
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
| GET | `/api/companies/:companyId/members` | Empresa: OWNER ou mais | Funciona |
| POST | `/api/companies/:companyId/members` | Empresa: OWNER ou mais | Bloqueada (402) |
| DELETE | `/api/companies/:companyId/members/:membershipId` | Empresa: OWNER ou mais | Bloqueada (402) |
| PUT | `/api/companies/:companyId/members/:membershipId/stores/:targetStoreId` | Empresa: OWNER ou mais | Bloqueada (402) |
| DELETE | `/api/companies/:companyId/members/:membershipId/stores/:targetStoreId` | Empresa: OWNER ou mais | Bloqueada (402) |

## organizations

| Método | Rota | Quem pode | Em somente leitura |
|---|---|---|---|
| POST | `/api/organizations/:organizationId/companies` | Responsável pela cobrança | Bloqueada (402) |
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
| POST | `/api/companies/:companyId/stores` | Empresa: OWNER ou mais | Bloqueada (402) |
| GET | `/api/companies/:companyId/stores/:id` | Empresa: EMPLOYEE ou mais | Funciona |
| DELETE | `/api/companies/:companyId/stores/:id` | Empresa: OWNER ou mais | Bloqueada (402) |
| PATCH | `/api/companies/:companyId/stores/:id` | Empresa: OWNER ou mais | Bloqueada (402) |
