# Plano de Implementação — Backend (NestJS + Prisma)

## Contexto
Transformação de um sistema single-tenant (uma distribuidora) em um SaaS multi-tenant
(`Company` → `Store`, controle de acesso por `MembershipStore`). O `schema.prisma` final
já foi definido e deve ser tratado como fonte da verdade para este plano. Não redesenhar
o schema — se algo aqui parecer incompatível com ele, sinalizar antes de prosseguir.

Convenções:
- IDs são `String` (uuid).
- Toda entidade operacional pertence a uma `Company` (catálogo compartilhado) ou a uma
  `Store` (operação física). Nenhum endpoint deve ler/escrever dados sem validar esse
  escopo primeiro.
- Onde este plano diz "⚠️ decisão em aberto", o agente deve implementar a opção sugerida
  como padrão, mas deixar um comentário `// TODO(decisão-produto):` no código e reportar
  a decisão tomada ao final da fase.

---

## Fase 0 — Preparação
1. Rodar `prisma migrate dev` com o `schema.prisma` fornecido.
2. Configurar `DATABASE_URL` e demais envs (JWT secret, etc).
3. Criar script de seed (`prisma/seed.ts`) com: 1 Company, 2 Stores, 3 Users (um OWNER,
   um MANAGER só na Store A, um EMPLOYEE só na Store B), alguns Products/StoreProducts,
   1 Customer com saldo em duas lojas.

**Critério de conclusão:** `prisma migrate dev` roda sem erro e o seed popula o banco.

---

## Fase 1 — Autenticação e base multi-tenant
1. Módulo `AuthModule`: login (email/senha) retornando JWT com `sub = userId`.
2. Endpoint `GET /me/memberships` — retorna todas as `Company`/`Store` que o usuário tem
   acesso, com o `role` em cada loja:
   ```json
   [
     { "companyId": "...", "companyName": "...",
       "stores": [{ "storeId": "...", "storeName": "...", "role": "MANAGER" }] }
   ]
   ```
   Esse endpoint é o contrato que o frontend usa pra montar o seletor de empresa/loja —
   **não alterar o formato sem avisar o plano de frontend**.
3. `CompanyGuard`: valida que o usuário autenticado tem *algum* `Membership` na
   `companyId` resolvida da request (header `x-company-id` ou `:companyId` na rota).
   Roda antes de qualquer outro guard de autorização — é o isolamento de tenant.
4. Decorators: `@CurrentUser()`, `@CurrentCompany()`.

**Critério de conclusão:** um usuário da Company A recebe 403/404 ao tentar acessar
qualquer recurso da Company B, mesmo autenticado.

---

## Fase 2 — Guards e autorização por loja
1. `Role` hierárquico: `OWNER(4) > ADMIN(3) > MANAGER(2) > EMPLOYEE(1)`.
2. Decorator `@MinRole(Role.MANAGER)` (metadata via `Reflector`).
3. `RolesGuard`:
   - Resolve `storeId` da request (param, body ou query — documentar por endpoint).
   - Para rotas onde o recurso não expõe `storeId` diretamente na URL (ex:
     `PATCH /sales/:saleId`), fazer lookup prévio (`sale.storeId`) antes de checar o role.
     Centralizar esse lookup em decorators de recurso (ex: `@ResolveStoreFromSale()`) em
     vez de duplicar lógica em cada guard.
   - Consulta `MembershipStore` (`userId` + `storeId`) e compara com o nível mínimo.
   - Anexa `req.storeContext = { storeId, role, membershipId }` para reuso downstream.

**Critério de conclusão:** testes de guard cobrindo: usuário sem membership na loja (403),
usuário com role insuficiente (403), usuário com role suficiente (200), e o caso de
lookup indireto (ex: rota de `SaleItem` sem `storeId` na URL).

---

## Fase 3 — Cadastro (Company / Store / Membership / User)
1. `CompanyModule`: `GET/PATCH` (dados da própria company — só `OWNER`).
2. `StoreModule`: CRUD de lojas, restrito a `OWNER`/`ADMIN`.
3. `MembershipModule`:
   - `POST /companies/:id/members` — convite por e-mail (cria `User` se não existir +
     `Membership`).
   - `PUT /memberships/:id/stores/:storeId` — define/atualiza o `role` do membership
     naquela loja (cria o `MembershipStore` se não existir).
   - `DELETE /memberships/:id/stores/:storeId` — remove acesso a uma loja específica
     (sem apagar o `Membership` da company, a menos que seja a última loja).
   - `GET /companies/:id/members` — lista membros com seus roles por loja.
4. `UserModule`: perfil, troca de senha.

**Critério de conclusão:** dá pra convidar um usuário, atribuir role em loja A, depois
role diferente em loja B, e revogar só uma delas sem afetar a outra.

---

## Fase 4 — Catálogo (Product / StoreProduct / BottleType / StoreBottleType)
1. `ProductModule`:
   - `POST /companies/:id/products` — cria o `Product` (catálogo). Se o payload incluir
     `storeIds: string[]` (lojas selecionadas na tela de "produto compartilhado"), criar
     um `StoreProduct` para cada uma numa única transação, com `costPrice` pré-preenchido
     igual em todas (editável depois) e `price` obrigatório por loja no mesmo payload.
   - `code` é único por `companyId` — validar antes de criar, retornar erro claro se
     duplicado.
2. `StoreProductModule`:
   - `PATCH /stores/:storeId/store-products/:id` — atualiza price/costPrice/stock/isActive.
   - Antes de sobrescrever, gravar snapshot em `StoreProductHistory` (fazer isso no
     service, dentro da mesma transação — não depender de trigger de banco, para manter
     portável e testável).
   - `GET /stores/:storeId/store-products` — listagem paginada/buscável (por `code`/`name`
     via join com `Product`) para uso no PDV.
3. `BottleTypeModule` + `StoreBottleTypeModule`: mesmo padrão do Product/StoreProduct,
   mas mais simples (só `stock`, sem price/cost).

**Critério de conclusão:** criar um produto marcando 2 lojas gera 2 `StoreProduct` com
`costPrice` igual e `price` podendo ser diferente; editar o preço em uma loja não afeta
a outra nem o `Product` pai.

---

## Fase 5 — Clientes e Fiado (abatimento cruzado entre lojas)
1. `CustomerModule`: CRUD a nível de `Company`.
2. `GET /customers/:id/balances` — retorna:
   ```json
   { "total": 150.0, "perStore": [{ "storeId": "...", "storeName": "...", "balance": 100.0 }, ...] }
   ```
   `total` é `SUM` calculado em runtime (Prisma `aggregate` ou `groupBy`), nunca
   armazenado.
3. `POST /customers/:id/payments`:
   - Payload: `{ storeId (onde foi pago), amount, paymentMethod, allocations?: [{storeId, amount}] }`.
   - Se `allocations` vier preenchido: validar que `sum(allocations.amount) === amount`
     (senão 400). Rodar em `$transaction`: criar `CustomerPayment`, criar
     `CustomerPaymentAllocation[]`, decrementar cada `CustomerStoreBalance` correspondente
     (nunca deixar negativo sem flag explícita — decidir se permite saldo credor).
   - ⚠️ **Decisão em aberto**: se `allocations` **não** vier no payload, o backend deve
     alocar automaticamente. Sugestão padrão: abater primeiro a dívida da loja onde o
     pagamento foi feito (`storeId`), e só then distribuir o excedente para as demais
     lojas por ordem de saldo mais antigo (`updatedAt` mais antigo primeiro). Implementar
     essa regra como função pura e testável (`allocatePayment(balances, amount)`), para
     poder trocar a estratégia facilmente depois.
4. `POST /customers/:id/bottle-payments` (devolução de vasilhame) — mesmo padrão de
   alocação cruzada, mas sobre `CustomerStoreBottleBalance`.

**Critério de conclusão:** pagar R$100 na Store B abatendo R$60 da dívida da Store A e
R$40 da própria Store B funciona numa chamada só, atômica, e reflete corretamente em
`GET /customers/:id/balances`.

---

## Fase 6 — Vendas / Caixa / Comandas / Vasilhames
1. `SaleModule` — `POST /stores/:storeId/sales`, transação única:
   - Validar estoque de cada `StoreProduct` do carrinho (lock via `$transaction` +
     `SELECT ... FOR UPDATE` ou verificação otimista com retry).
   - Decrementar `StoreProduct.stock`.
   - Criar `Sale` + `SaleItem[]`.
   - Se `paymentMethod === CREDIT_STORE`: incrementar `CustomerStoreBalance` daquela loja
     (criar se não existir).
   - Se algum item envolver vasilhame (produto com `bottleTypeId`): criar
     `BottleMovement` (`CUSTOMER_BORROW`) e ajustar `StoreBottleType.stock` /
     `CustomerStoreBottleBalance`.
2. `CashRegisterModule`: abrir/fechar caixa, `CashMovement` (entrada/saída/venda —
   movimento `SALE` é criado automaticamente ao concluir uma `Sale` com caixa aberto).
3. `CommandTabModule`:
   - ⚠️ **Decisão em aberto**: o estoque é decrementado ao **adicionar item na comanda**
     (produto já saiu fisicamente) ou só ao **fechar/converter em Sale**? Sugestão padrão:
     decrementar ao adicionar (reflete a realidade física), e no fechamento apenas
     consolidar em `Sale`/`SaleItem` sem mexer em estoque de novo.
4. `BottleMovementModule`: movimentos manuais (`SUPPLIER_SEND`, `SUPPLIER_RECEIVE`,
   `MANUAL_ADJUSTMENT`), sempre ajustando `StoreBottleType.stock`.

**Critério de conclusão:** uma venda com produto normal + produto com vasilhame gera,
numa única transação: `Sale`, `SaleItem[]`, decremento de `StoreProduct.stock`,
`BottleMovement` e ajuste de `StoreBottleType.stock`/`CustomerStoreBottleBalance`.

---

## Fase 7 — Testes
1. Unit: guards (Fase 2), função de alocação de pagamento (Fase 5), transação de venda
   (Fase 6) incluindo caso de estoque insuficiente (deve dar rollback completo).
2. Integração/e2e: isolamento entre companies, fluxo completo de venda com fiado,
   pagamento cruzado entre lojas ponta a ponta.

---

## Fase 8 — Migração de dados legados (se aplicável)
1. Script único (`scripts/migrate-legacy.ts`):
   - Cria uma `Company` "padrão" + uma `Store` "matriz".
   - Migra `Product` antigo → `Product` (catálogo) + 1 `StoreProduct` (preço/custo/estoque
     atuais) na loja matriz.
   - Migra `Sale`/`SaleItem`/`CashRegister`/`CommandTab`/`Customer`/`BottleType` etc.
     atribuindo `storeId`/`companyId` da loja matriz.
   - Rodar em transação, com dry-run (`--dry-run`) antes de aplicar de fato.

**Reportar ao final:** lista de decisões tomadas nos pontos marcados ⚠️, e qualquer
ambiguidade encontrada que não estava coberta neste plano.