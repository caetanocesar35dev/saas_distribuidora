# Plano de Implementação — Backend (NestJS + Prisma)

## Contexto

O sistema era single-tenant (uma distribuidora) e está virando um SaaS multi-tenant:
`Organization` (cobrança) → `Company` (distribuidora) → `Store` (loja), com acesso por
`Membership` + `MembershipStore` (papel por loja).

**O banco já está pronto e não deve ser redesenhado:**
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) é a fonte da verdade.
- [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) explica tabelas, relações, auditoria e
  soft delete. **Leia antes de começar.**
- As migrations `init` e `auditoria_triggers` já existem e estão aplicadas no banco local.

**O código de `backend/src` é legado** (modelo antigo, IDs numéricos, `product.stock`,
`customer.balance`, `user.role`) e não compila contra o schema. Ele será substituído
módulo a módulo. As regras de negócio antigas continuam úteis como referência e ficam
no git (`git show a4ff703:backend/src/<arquivo>`).

O `GUIA_IMPLEMENTACAO_AUDITORIA.md` descreve outro projeto. **Não siga o
`AuditInterceptor` dele**; a abordagem deste projeto está na Fase 0.

Fora do escopo: frontend (tem plano próprio) e alteração de migrations já aplicadas.

---

## Como usar este plano

1. Execute as fases em ordem. Cada fase termina com `npm run build`, lint e testes
   verdes e um relatório curto para o usuário: o que foi feito, decisões ⚠️ tomadas e
   ambiguidades encontradas.
2. Há dois tipos de marcação:
   - **⚠️ Decisão em aberto:** implemente a sugestão padrão, deixe
     `// TODO(decisão-produto): <resumo>` no código e liste a decisão no relatório da fase.
   - **🛑 Parada obrigatória (P1, P2…):** **não implemente sem perguntar ao usuário.**
     Explique a pergunta e a recomendação, e espere a resposta. Estão todas na seção
     [Paradas obrigatórias](#paradas-obrigatórias-perguntar-ao-usuário).
3. Se algo no plano contradizer o schema, a documentação do banco ou o próprio plano,
   pare e pergunte em vez de escolher sozinho.

---

## Regras gerais (valem para todas as fases)

### Banco, auditoria e soft delete
- **Toda escrita** em `tb_*` define `modifierId` (id do usuário) e `modifiedEndpoint`.
  Isso é feito automaticamente pela extensão do Prisma da Fase 0; o código de negócio
  não repassa esses campos manualmente.
- **Sem nested writes** em tabelas de negócio (`create: { items: { create: [...] } }`,
  `connectOrCreate`, `upsert` aninhado): a extensão só enxerga o nível de cima, e o
  registro filho ficaria sem autor. Crie filhos com chamadas próprias (`createMany`)
  dentro da mesma `$transaction`.
- **Nunca usar `delete`/`deleteMany`**: o banco recusa. "Excluir" = soft delete
  (`deletedAt = now()`), via helper da Fase 0.
- **Leituras ignoram registros excluídos.** A extensão filtra o nível de cima; dentro de
  `include`/`select` de relações, filtre `deletedAt: null` explicitamente.
- **Índices únicos são globais:** criar algo cujo único (ex.: `code` do produto,
  `email`, `(storeId, productId)`) pertence a um registro excluído deve **reativar** o
  registro (`deletedAt = null` + novos dados), não criar outro.
- **Nunca escrever em `th_*`.** Só ler (Fase 8).
- **Colunas que só mudam junto com o registro da movimentação** (porque o histórico não
  as versiona):
  - `StoreBottleType.stock` só muda junto com um `BottleMovement`;
  - `CustomerStoreBottleBalance.balance` só muda junto com um `BottleMovement`;
  - `CustomerStoreBalance.balance` só muda junto com uma `Sale` fiado (ou o cancelamento
    dela) ou uma `CustomerPaymentAllocation`.

  Qualquer outra alteração dessas colunas deixa o saldo sem rastro. Não existe
  "editar saldo/estoque de vasilhame" direto.
- **Mudança de schema** (nova tabela, coluna, índice) é 🛑 **P9**. Se aprovada, segue
  §7 da documentação do banco: coluna também no `*History`, tabela nova com triggers,
  sempre por migration.

### Multi-tenancy e autorização
- Todo recurso pertence a uma `Company` ou a uma `Store`. Os ids vêm **na rota**:
  - `/companies/:companyId/...` para recursos da company (catálogo, clientes, membros);
  - `/stores/:storeId/...` para recursos da loja (estoque, vendas, caixa, comandas).
- Antes de qualquer leitura ou escrita, o guard valida que o usuário tem acesso
  àquela company/loja (Fase 2). IDs de outros recursos recebidos no body (ex.:
  `customerId` numa venda) **também** devem ser validados como pertencentes à mesma
  company. Recurso de outro tenant responde **404**, nunca 403 (não revelar que existe).
- Papéis existentes (enum `Role`): `OWNER > MANAGER > EMPLOYEE`. **Não existe `ADMIN`.**

### API
- Prefixo global `/api` (já configurado).
- Todo `@Body()` tipado com **classe DTO** (class-validator), nunca `any`, interseção
  (`Dto & {...}`) ou objeto literal: com isso o `ValidationPipe` global
  (`whitelist` + `forbidNonWhitelisted` + `transform`) passa a validar de verdade.
  IDs com `@IsUUID()`.
- Paginação padrão: `?page=1&limit=20` (máx. 100). Resposta `{ data, meta: { page,
  limit, totalItems, totalPages } }`.
- Nunca retornar `passwordHash`: usar `select` explícito em toda consulta de `User`.
- Preços e custos **sempre lidos do banco**, nunca aceitos do cliente em vendas e comandas.
- Dinheiro é `Float` no schema: arredondar para 2 casas em todo cálculo (helper único
  `roundMoney`). Não mudar o tipo (seria P9).
- Datas no banco em UTC. "Hoje", "semana" e "mês" (dashboard, relatórios) são
  calculados no fuso `APP_TIMEZONE` (padrão `America/Sao_Paulo`).

### Transações e concorrência
- Operações com mais de uma escrita usam `$transaction(async (tx) => ...)`.
- Baixa de estoque **atômica e condicional**, sem ler-e-escrever:
  `updateMany({ where: { id, storeId, stock: { gte: qtd }, deletedAt: null, isActive: true }, data: { stock: { decrement: qtd } } })`.
  Se `count === 0`, lançar erro (rollback da transação inteira).
- "Um caixa aberto por loja" e outras regras de unicidade que o schema não garante:
  `SELECT pg_advisory_xact_lock(hashtext($storeId))` no início da transação.

---

## Paradas obrigatórias (perguntar ao usuário)

Hoje o único container do projeto é o Postgres local (`banco_saas_distribuidora`, porta
5437). **Não existe docker-compose.** Qualquer container novo depende de aprovação.

| ID | Assunto | Quando perguntar | Recomendação a apresentar |
|---|---|---|---|
| **P1** | **Redis** (container local `redis:7-alpine` + `REDIS_URL`) | Antes de implementar P2 ou P3 com armazenamento compartilhado | Só é necessário com mais de uma instância do backend ou cache compartilhado. Com uma instância, memória basta. Recomendar **não usar agora** e deixar a troca para Redis isolada atrás de uma interface. Se aprovado, perguntar também se cria um `docker-compose.yml` ou um `docker run` documentado |
| **P2** | **Rate limiting** (`@nestjs/throttler`) | Fase 1, antes dos endpoints de auth | Limites sugeridos na tabela abaixo. Armazenamento em memória (ou Redis, se P1 aprovado) |
| **P3** | **Cache** | Fase 2 (lookup de permissões) e Fase 7 (dashboard) | Ver candidatos abaixo. Recomendar começar **sem cache**, medir e só então ligar os candidatos 1 e 2 |
| **P4** | **E-mail** (convite, redefinição de senha) | Fase 1, antes do `MailModule` | Em dev, um container **Mailpit** (SMTP falso com caixa visível no navegador), para não mandar e-mail real. Em produção, o SMTP do `.env` (`EMAIL_USER`/`EMAIL_PASS`, Gmail) ou um provedor transacional. Perguntar qual |
| **P5** | **Estratégia de sessão** | Fase 1, antes do login | Padrão sem mudar schema: só access token JWT com expiração de 12h, e guard que confere `isActive`/`deletedAt` do usuário a cada request (revogação imediata). Refresh token rotativo exige tabela nova (P9). Perguntar se 12h é aceitável |
| **P6** | **Asaas** (gateway de cobrança) | Início da Fase 10 | Pedir: conta **sandbox** e chave de API; como expor o webhook local (túnel `cloudflared` ou `ngrok`, ferramenta fora do projeto; nenhum container necessário); confirmação dos pontos ⚠️ da Fase 10 (trial com Pix Automático, troca de plano, eventos que cancelam a assinatura). O schema já está pronto (`Organization.billing*` e `tb_billing_events`) |
| **P7** | **Devolução de vasilhame em outra loja** | Fase 5 | O schema não registra "devolvido fisicamente na loja B, abatendo dívida da loja A" (`BottleMovement` tem um único `storeId` e o saldo não tem histórico). Padrão: **só permitir devolução na mesma loja da dívida**. Cruzar lojas exige mudança de schema (P9) |
| ~~P8~~ | **Trial e inadimplência: já decidido pelo usuário, não perguntar** | — | Trial de **14 dias**; carência de **5 dias** após o vencimento; depois disso, **somente leitura** (não é bloqueio total). Regras completas em "Acesso pela assinatura" (Fase 2, item 5) |
| **P9** | **Qualquer mudança no schema** | Sempre que surgir | Explicar a necessidade, a alternativa sem mudar o schema e o impacto (tabela `th_` + triggers) |
| **P10** | **Nova dependência fora da lista** da seção "Dependências" | Quando surgir | Dizer o porquê e a alternativa sem a dependência |

**P2: limites sugeridos**

| Endpoint | Limite | Chave |
|---|---|---|
| `POST /auth/login` | 5/min e 20/hora | IP + e-mail |
| `POST /auth/signup` | 3/hora | IP |
| `POST /auth/forgot-password` | 3/hora | e-mail (resposta sempre igual, exista ou não) |
| `POST /auth/reset-password` | 10/hora | IP |
| `POST .../members` (convite) | 20/hora | company |
| Demais rotas autenticadas | 300/min | usuário |
| Webhook do Asaas | sem limite | (validado pelo token do header) |

**P3: candidatos a cache**

| # | O quê | TTL sugerido | Invalidação |
|---|---|---|---|
| 1 | Acesso do usuário: `MembershipStore` + `isActive` (consultado em **toda** request pelo guard) | 60 s | Ao alterar papel, revogar acesso, desativar usuário |
| 2 | Métricas do dashboard | 60 s | Só por tempo |
| 3 | Lista de planos (`GET /plans`, pública) | 1 h | Ao editar plano |
| — | **Não cachear** a lista de produtos do PDV nem saldos: estoque e saldo mudam a cada venda | — | — |

---

## Dependências

Já instaladas e usadas: `@nestjs/*` (core, common, platform-express, jwt, schedule),
`@prisma/client` + `@prisma/adapter-pg` + `pg`, `bcryptjs`, `class-validator`,
`class-transformer`, `dotenv`.

A adicionar (aprovadas por este plano):
- `@nestjs/config`: env tipado e validado na subida.
- `nestjs-cls`: contexto da request (usuário, rota) via AsyncLocalStorage, para a
  extensão de auditoria.
- `helmet`: headers de segurança.
- `@nestjs/swagger`: documentação em `/api/docs` (só fora de produção).
- `nodemailer` (+ `@types/nodemailer`): envio de e-mail (configuração depende de P4).

Condicionais (só após a parada correspondente): `@nestjs/throttler` (P2),
`@nestjs/cache-manager` + `cache-manager` (P3), `ioredis`/`@keyv/redis` (P1).

Asaas: **sem SDK**. O Asaas não tem SDK oficial para Node; usar o `fetch` nativo do
Node 24 num client próprio (Fase 10). Pacotes não oficiais do Asaas no npm são P10.

A remover: `passport-jwt` e `@types/passport-jwt` (o guard é próprio, sem Passport).

---

## Fase 0 — Fundação

**Objetivo:** projeto compilando no modelo novo, com auditoria e soft delete
automáticos, sem nenhum endpoint de negócio ainda.

1. **Limpeza do legado:** remover os módulos antigos (`products`, `sales`, `customers`,
   `cash-register`, `command-tabs`, `bottles`, `dashboard`, `auth`,
   `interceptors/audit.interceptor.ts`) e seus imports em `app.module.ts`. Rodar
   `npx prisma generate`. Conferir que `npm run build` passa e que `start:prod`
   (`node dist/src/main`) aponta para o arquivo gerado.
2. **Configuração** (`@nestjs/config`, validação na subida, sem valores padrão inseguros):

   | Variável | Obrigatória | Observação |
   |---|---|---|
   | `DATABASE_URL` | sim | |
   | `JWT_SECRET` | sim | mínimo 32 caracteres. **Remover o fallback `'super_secret_jwt_key'`** do código atual |
   | `JWT_EXPIRES_IN` | não | padrão `12h` (P5) |
   | `PORT` | não | padrão `3001` |
   | `CORS_ORIGINS` | sim | lista separada por vírgula. Substitui o `origin: true` atual, que aceita qualquer origem com credenciais |
   | `APP_URL` | sim | URL do frontend, usada nos links de e-mail |
   | `APP_TIMEZONE` | não | padrão `America/Sao_Paulo` |
   | `TRIAL_DAYS` | não | padrão `14` (decidido pelo usuário). Só é usado no cadastro, para gravar `Organization.trialEndsAt`; mudar o valor não altera trials em andamento |
   | `SUBSCRIPTION_GRACE_DAYS` | não | padrão `5` (decidido pelo usuário): dias de acesso completo após a mensalidade vencer |
   | `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_TO` (já existem), `EMAIL_HOST`, `EMAIL_PORT` | conforme P4 | |
   | `ASAAS_API_URL` | a partir da Fase 10 | sandbox `https://api-sandbox.asaas.com/v3`, produção `https://api.asaas.com/v3` (conferir na documentação) |
   | `ASAAS_API_KEY` | a partir da Fase 10 | nunca logar nem retornar em resposta |
   | `ASAAS_WEBHOOK_TOKEN` | a partir da Fase 10 | token configurado no webhook do painel do Asaas |

   Criar `backend/.env.example` com todas as chaves e valores fictícios.
3. **Contexto da request** (`nestjs-cls`): guardar `userId` e `endpoint` =
   `` `${método} ${request.route.path}` `` (ex.: `POST /api/stores/:storeId/sales`, o
   padrão da rota, sem ids nem query string). Helper `runAsSystem(nome, fn)` para jobs
   e seed, que define `userId = 'system'` e `endpoint = 'job:<nome>'`/`'seed'`.
4. **Extensão do Prisma Client** (`src/prisma/`), aplicada a **todos** os modelos `tb_*`
   (não aos `*History`):
   - `create`, `createMany`, `createManyAndReturn`, `update`, `updateMany`,
     `updateManyAndReturn`, `upsert` (ramos `create` e `update`): injeta `modifierId` e
     `modifiedEndpoint` do contexto. **Sem contexto, lança erro** (melhor falhar do que
     gravar sem autor).
   - `delete`/`deleteMany`: lança erro orientando o soft delete.
   - Leituras de nível superior (`findMany`, `findFirst`, `findUnique`,
     `findFirstOrThrow`, `findUniqueOrThrow`, `count`, `aggregate`, `groupBy`) e
     `update`/`updateMany`: acrescentam `deletedAt: null` ao `where`, a menos que o
     código esteja dentro de `withDeleted(fn)` (flag no contexto). `withDeleted` existe
     para reativar registros e para consultas administrativas.
   - Helpers: `softDelete(model, where)` e `restore(model, where)`.
   - Modelos `*History`: qualquer escrita lança erro.
   - Expor o client estendido como provider injetável (o `$extends` retorna um tipo
     novo, então o `PrismaService extends PrismaClient` atual precisa ser adaptado).
     Conferir que `$transaction(async tx => ...)` também passa pela extensão.
5. **Filtro global de exceções:** mapear erros do Prisma e do banco para HTTP: único
   violado (`P2002`) → 409 com o campo; FK (`P2003`) → 409; não encontrado (`P2025`) →
   404; DELETE bloqueado pelo trigger (SQLSTATE `23001`) → 409. Conferir em teste como
   o `@prisma/adapter-pg` expõe esses erros, porque o formato pode ser diferente do
   driver nativo. Nunca vazar mensagem SQL crua.
6. **Segurança e infraestrutura HTTP:** `helmet`, CORS por `CORS_ORIGINS`, Swagger em
   `/api/docs` fora de produção, `GET /api/health` (ping no banco, público),
   `enableShutdownHooks`.
7. **Seed** (`prisma/seed.ts`, via `runAsSystem('seed', ...)`; já referenciado em
   `prisma.config.ts`):
   - Planos (⚠️ nomes, preços e limites: sugerir `Trial`, `Básico` e `Pro`, para o
     usuário confirmar no relatório).
   - 1 Organization (`TRIAL`), 1 Company, 2 Stores.
   - 3 Users (senha `123456` com bcrypt): um OWNER nas duas lojas, um MANAGER só na
     Store A, um EMPLOYEE só na Store B.
   - 1 SUPERADMIN da plataforma.
   - Produtos/StoreProducts (pelo menos um com vasilhame), 1 BottleType com estoque nas
     duas lojas (via `BottleMovement` `MANUAL_ADJUSTMENT`).
   - 1 Customer com dívida nas duas lojas, criada via vendas fiado de verdade, não
     escrevendo `balance` direto.
8. **Infraestrutura de testes:**
   - Banco separado `distribuidora_test` no mesmo container (criar se não existir,
     aplicar `prisma migrate deploy`).
   - Limpar entre suítes com `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as `tb_*`
     e `th_*` (TRUNCATE não dispara o bloqueio de DELETE).
   - Criar o `test/jest-e2e.json`, referenciado no `package.json` mas inexistente.
   - **Teste de cobertura da auditoria**, rodado ao fim da suíte e2e: nenhuma linha em
     nenhuma `th_*` com `modifierId` nulo. É ele que pega nested writes e escritas fora
     da extensão.

**Critério de conclusão:** `npm run build` e `npm run lint` passam; o seed roda; teste
prova que (a) um `create` sem contexto falha, (b) dentro de request o histórico recebe
autor e rota, (c) `delete` é recusado com 409, (d) `findMany` não retorna excluídos e
`withDeleted` retorna.

---

## Fase 1 — Autenticação e conta

🛑 Antes de começar: **P2** (rate limiting), **P4** (e-mail), **P5** (sessão).

1. **Senhas:** `bcryptjs`, custo 12. Mínimo 8 caracteres. Comparação sempre via
   `bcrypt.compare`, inclusive quando o usuário não existe (comparar com um hash fixo)
   para não revelar por tempo de resposta quais e-mails existem.
2. **JWT** (`@nestjs/jwt`): payload `{ sub: userId, platformRole }`. **Papéis de loja
   não vão no token**: mudam com frequência e são lidos do banco no guard (Fase 2).
3. **`AuthGuard` global** (`APP_GUARD`) com decorator `@Public()` para as exceções.
   Valida o token e carrega o usuário (`isActive = true`, `deletedAt = null`); senão,
   401. Grava `userId` no contexto da Fase 0.
4. **Endpoints:**
   - `POST /auth/signup` (público): cria numa única transação `User`, `Organization`
     (`TRIAL`, `trialEndsAt = agora + TRIAL_DAYS`, plano de trial, `ownerUserId` = novo
     usuário), `Company`, primeira
     `Store`, `Membership` e `MembershipStore` (`OWNER`). Payload: nome, e-mail, senha,
     CNPJ, razão social, nome fantasia, nome da loja. Como o usuário ainda não existe
     no contexto, o `modifierId` dessas escritas é o id do usuário recém-criado
     (gerar o UUID antes e definir no contexto). Preenche `billingDocument` com o CNPJ
     da company e `billingEmail` com o e-mail do usuário (editáveis na Fase 10). **Não
     chama o Asaas aqui:** o cadastro não pode falhar por indisponibilidade do gateway.
     Retorna o mesmo que o login.
   - `POST /auth/login` (público): `{ access_token, user }`. Usuário inativo ou
     excluído: mesma mensagem de credencial inválida.
   - `POST /auth/forgot-password` (público): sempre 200. Se o e-mail existir, envia
     link `APP_URL/redefinir-senha?token=...`. **Token sem tabela nova:** JWT de 30 min
     assinado com `JWT_SECRET + passwordHash atual` e `{ sub, purpose: 'reset' }`. Ao
     trocar a senha, o hash muda e o token deixa de valer (uso único).
   - `POST /auth/reset-password` (público): `{ token, newPassword }`.
   - `POST /auth/change-password` (autenticado): exige a senha atual.
   - `GET /me`: dados do usuário (sem `passwordHash`) + `platformRole`.
   - `PATCH /me`: altera o próprio `name`. O e-mail não é alterado neste plano (⚠️).
   - `GET /me/memberships`: **contrato usado pelo frontend, não alterar o formato
     sem avisar**:
     ```json
     [
       { "companyId": "...", "companyName": "...", "isCompanyOwner": true,
         "stores": [{ "storeId": "...", "storeName": "...", "role": "MANAGER" }] }
     ]
     ```
     Considera só membership, loja e company não excluídos.
5. **`MailModule`** (`nodemailer`), conforme P4. Templates simples em texto/HTML para
   convite e redefinição de senha. Falha de envio é registrada no log e não derruba a
   operação principal (⚠️).

**Critério de conclusão:** signup → login → `GET /me/memberships` retorna a company e a
loja com `OWNER`; o fluxo de reset funciona e o token não pode ser reusado; o histórico
do signup tem `modifierId` = id do novo usuário; o rate limit (se aprovado) retorna 429.

---

## Fase 2 — Autorização (tenant, papel por loja, plataforma, assinatura)

🛑 Antes de começar: **P3** (cache do lookup de acesso).

1. **Definições:**
   - *Papel na loja:* `MembershipStore.role` (não excluído) do membership do usuário
     naquela loja.
   - *OWNER da company:* usuário com `OWNER` em pelo menos uma loja da company.
   - *Responsável pela cobrança:* `Organization.ownerUserId`.
2. **Decorators:** `@CurrentUser()`, `@StoreRole(Role.MANAGER)` (papel mínimo na loja da
   rota), `@CompanyRole(Role.MANAGER)` (papel mínimo em *alguma* loja da company),
   `@CompanyOwner()`, `@PlatformRole('SUPERADMIN' | 'SUPPORT')`.
3. **`TenantGuard`:**
   - Resolve `storeId`/`companyId` **somente pelos params da rota**.
   - Rota de loja: carrega a loja (não excluída) e a `companyId` dela.
   - Confere o acesso pela tabela de acesso (com cache, se P3 aprovado).
   - Sem acesso → **404**. Papel insuficiente → **403**.
   - Anexa `req.tenant = { companyId, storeId?, role?, membershipId }`.
   - Recursos aninhados (ex.: `/stores/:storeId/sales/:saleId`): o service **sempre**
     filtra por `storeId` + id, nunca só pelo id. Assim uma venda de outra loja dá 404
     sem lookup extra.
4. **Plataforma:** `platformRole` **não** dá acesso aos dados das distribuidoras pelas
   rotas de tenant. SUPERADMIN e SUPPORT só usam `/platform/*` (Fase 9) (⚠️).
5. **Acesso pela assinatura** (`SubscriptionGuard`, depois do `TenantGuard`). **Regra
   decidida pelo usuário:** inadimplência **nunca bloqueia o sistema inteiro**, só coloca
   em **modo somente leitura**.

   | Situação da organização | Acesso |
   |---|---|
   | `TRIAL` e `trialEndsAt` no futuro | Completo |
   | `ACTIVE` | Completo |
   | `PAST_DUE` há até `SUBSCRIPTION_GRACE_DAYS` (5) dias (`pastDueSince + 5 dias` no futuro) | Completo + aviso em destaque (carência) |
   | `PAST_DUE` depois da carência | **Somente leitura** |
   | `TRIAL` com `trialEndsAt` vencido | **Somente leitura** |
   | `CANCELED` | **Somente leitura** |

   **Somente leitura** significa:
   - **Liberado:** login e tudo que é leitura (`GET`): vendas, estoque, clientes,
     fiado, relatórios, dashboard e histórico. Também:
     - **fechar o caixa que já estava aberto**
       (`POST /stores/:storeId/cash-register/close`);
     - **pagar e gerenciar a assinatura** (`/organizations/:organizationId/billing/*`),
       para conseguir sair do bloqueio;
     - rotas da conta do próprio usuário (`/auth/*`, `/me`, troca de senha), que não
       são da organização.
   - **Bloqueado:** qualquer outra escrita (vender, abrir caixa, movimentar caixa,
     comandas, estoque, cadastros, **receber pagamento de fiado**, membros). Resposta
     **402** com corpo `{ code: "SUBSCRIPTION_READ_ONLY", reason: "TRIAL_EXPIRED" |
     "PAST_DUE" | "CANCELED" }`, para o frontend mostrar a mensagem certa.
   - Implementação: o guard bloqueia métodos de escrita por padrão; as exceções são
     marcadas com o decorator `@AllowWhenReadOnly()` (lista fechada: as três acima). O
     webhook do Asaas é `@Public()` e não passa pelo guard.
   - `GET /me/memberships` traz, por company, `subscription: { status, accessMode:
     "FULL" | "GRACE" | "READ_ONLY", trialEndsAt, pastDueSince, graceEndsAt }`. A regra
     fica numa função pura testada (`resolveAccessMode(org, now)`), usada pelo guard e
     pela resposta.
   - O usuário que não é o responsável pela cobrança vê o aviso, mas a mensagem orienta
     a falar com o responsável.
6. **Matriz de permissões padrão** (⚠️ o agente implementa assim e pede confirmação
   no relatório):

   | Ação | Mínimo |
   |---|---|
   | Dados da company, criar/editar/excluir lojas, membros e papéis | OWNER da company |
   | Cobrança (Fase 10) | Responsável pela cobrança |
   | Catálogo (`Product`, `BottleType`): criar/editar/excluir | MANAGER em alguma loja |
   | `StoreProduct`: preço, custo, ativo, entrada e ajuste de estoque | MANAGER na loja |
   | Clientes: criar/editar | EMPLOYEE |
   | Clientes: excluir | MANAGER em alguma loja |
   | Receber pagamento de fiado | EMPLOYEE na loja que recebe |
   | Vender, comandas, abrir/fechar caixa, entrada no caixa | EMPLOYEE na loja |
   | Saída de caixa (sangria) | MANAGER na loja |
   | Cancelar venda | MANAGER na loja |
   | Vasilhame: envio/recebimento de fornecedor | EMPLOYEE na loja |
   | Vasilhame: ajuste manual | MANAGER na loja |
   | Dashboard da loja, histórico de auditoria da loja | MANAGER na loja |
   | Dashboard consolidado da company | OWNER da company |

**Critério de conclusão:** testes cobrindo usuário sem acesso à loja (404), papel
insuficiente (403), papel suficiente (200), venda de outra loja via id (404), id de
cliente de outra company no body (404). `resolveAccessMode` coberto em todos os casos da
tabela do item 5 (inclusive o limite exato da carência). Em somente leitura: `GET`
funciona, venda e pagamento de fiado dão 402, fechar caixa e as rotas de billing
funcionam.

---

## Fase 3 — Cadastros da conta (Company, Store, membros)

1. **`OrganizationModule`:** `GET /organizations/mine` (organizations em que o usuário
   tem company). Edição de dados de cobrança fica na Fase 10.
2. **`CompanyModule`:**
   - `GET /companies/:companyId`, `PATCH` (OWNER): razão social, nome fantasia (CNPJ não
     muda (⚠️)).
   - `POST /organizations/:organizationId/companies` (responsável pela cobrança):
     respeitar `Plan.maxCompanies`.
3. **`StoreModule`** (OWNER da company):
   - CRUD em `/companies/:companyId/stores`. Criar respeita `Plan.maxStoresPerCompany`
     e dá `OWNER` na loja nova a todos os OWNERs da company (⚠️).
   - Excluir (soft delete) é bloqueado se houver caixa aberto ou comanda aberta.
4. **`MembershipModule`** (OWNER da company):
   - `GET /companies/:companyId/members`: membros com papel por loja.
   - `POST /companies/:companyId/members`: `{ email, name, stores: [{ storeId, role }] }`.
     - Usuário inexistente: cria `User` com senha aleatória inutilizável e envia e-mail
       de convite com link de definição de senha (mesmo mecanismo do reset, validade de
       7 dias).
     - Usuário existente: só cria o vínculo (ou reativa, se estava excluído).
     - Todas as lojas precisam ser da company.
   - `PUT /companies/:companyId/members/:membershipId/stores/:storeId`: `{ role }`;
     cria, altera ou reativa o `MembershipStore`.
   - `DELETE /companies/:companyId/members/:membershipId/stores/:storeId`: soft delete
     do acesso àquela loja. Se era a última loja, faz soft delete também do
     `Membership`.
   - `DELETE /companies/:companyId/members/:membershipId`: remove de todas as lojas.
   - Proteções: não remover o próprio acesso de OWNER se for o último OWNER da company;
     não alterar o próprio papel.
   - Invalidar o cache de acesso (se P3).
   - `User.isActive` é global (o usuário pode estar em outras companies): o dono da
     company **revoga acesso**, não desativa o usuário. Desativar é ação da plataforma
     (Fase 9).

**Critério de conclusão:** convidar um usuário novo, atribuir MANAGER na loja A e
EMPLOYEE na loja B, revogar só a B; o usuário continua com acesso à A; o histórico de
`th_membership_store_history` mostra as três alterações com autor.

---

## Fase 4 — Catálogo e estoque de produtos

1. **`ProductModule`** (`/companies/:companyId/products`):
   - `POST`: cria o `Product`. `code` é opcional: se não vier, gerar um EAN-13 aleatório
     com dígito verificador, único na company (o código antigo gerava sem dígito
     verificador). Se o payload trouxer `stores: [{ storeId, price, costPrice? }]`
     (tela de "produto compartilhado"), criar os `StoreProduct` na mesma transação. O
     `costPrice` informado no topo é o padrão de todas as lojas, sobrescrevível por loja.
   - `code` duplicado na company → 409 com mensagem clara. Se o duplicado estiver
     excluído → 409 informando que dá para reativá-lo.
   - `GET` (busca por `code`/`name`, paginado), `GET /:id`, `PATCH`, `DELETE` (soft).
   - `POST /:id/restore` (reativar).
   - Excluir um `Product` também faz soft delete dos `StoreProduct` dele, na mesma
     transação.
2. **`StoreProductModule`** (`/stores/:storeId/store-products`):
   - `GET`: listagem para PDV e estoque, com join em `Product` (code, name,
     packQuantity, bottleType), busca por `code`/`name`, filtro `isActive`, paginado.
     Busca exata por código de barras: `GET /by-code/:code`.
   - `POST`: adiciona à loja um `Product` já existente da company (ou reativa).
   - `PATCH /:id`: `price`, `costPrice`, `isActive`. **Não aceita `stock`.**
   - `POST /:id/stock-entries`: `{ quantity > 0 }`, entrada de mercadoria (incremento
     atômico).
   - `POST /:id/stock-adjustments`: `{ newStock >= 0, reason }`, ajuste de inventário.
   - Endpoints separados para que o `modifiedEndpoint` no histórico diga se a mudança
     de estoque foi entrada, ajuste ou venda. O `reason` do ajuste não tem coluna no
     schema: registrar só em log (⚠️ guardar o motivo exigiria P9).
   - `GET /low-stock?threshold=` (padrão `LOW_STOCK_THRESHOLD`, env, 20).
3. O histórico (`th_store_product_history`) é gerado pelo trigger. **O service não grava
   snapshot.**

**Critério de conclusão:** criar um produto em 2 lojas gera 2 `StoreProduct` com custo
igual e preços diferentes; mudar o preço em uma não afeta a outra; uma entrada de
estoque aparece no histórico com `modifiedEndpoint` de `stock-entries`.

---

## Fase 5 — Vasilhames, clientes e fiado

🛑 Antes da devolução de vasilhame: **P7**.

1. **Vasilhames — catálogo** (`/companies/:companyId/bottle-types`): CRUD + restore.
   Excluir é bloqueado se algum cliente deve aquele tipo (`balance > 0`).
2. **Vasilhames — movimentações** (`/stores/:storeId/bottle-movements`):
   - `POST` manual: `SUPPLIER_SEND`, `SUPPLIER_RECEIVE`, `MANUAL_ADJUSTMENT`. Cria o
     `BottleMovement` e ajusta `StoreBottleType.stock` (criando a linha se não existir)
     na mesma transação.
   - **`quantity` com sinal**, como diz o schema: positivo = entra na loja, negativo =
     sai. (O código antigo gravava valor absoluto; não copiar.)
   - Estoque de vasilhame pode ficar negativo? ⚠️ Sugestão: não, retornar 409.
   - `GET`: listagem com filtros (tipo, cliente, período), paginada.
   - `GET /stores/:storeId/bottle-stock`: estoque por tipo.
3. **`CustomerModule`** (`/companies/:companyId/customers`): CRUD + restore + busca por
   nome/telefone. Excluir é bloqueado se houver saldo devedor (dinheiro ou vasilhame)
   em qualquer loja.
4. **`GET /companies/:companyId/customers/:id/balances`:**
   ```json
   { "total": 150.0,
     "perStore": [{ "storeId": "...", "storeName": "...", "balance": 100.0 }],
     "bottles": [{ "storeId": "...", "bottleTypeId": "...", "bottleTypeName": "...", "balance": 3 }] }
   ```
   `total` calculado na hora (`aggregate`), nunca armazenado. EMPLOYEE só vê as lojas a
   que tem acesso e não vê `total`; MANAGER e OWNER veem tudo (⚠️, vem do comentário
   do schema).
5. **Pagamento de fiado** (`POST /stores/:storeId/customers/:customerId/payments`, onde
   `storeId` é a loja que recebe fisicamente):
   - Payload: `{ amount, paymentMethod (≠ CREDIT_STORE), allocations?: [{ storeId, amount }] }`.
   - Todas as lojas das alocações são da mesma company. Soma das alocações = `amount`
     (senão 400). Nenhuma alocação maior que a dívida da loja (sem saldo credor (⚠️)).
   - Sem `allocations`: alocação automática por função pura e testada
     `allocatePayment(balances, amount, receivingStoreId)`. Primeiro a dívida da loja que
     recebe, depois as demais, da mais antiga (`updatedAt`) para a mais nova (⚠️).
   - Transação: `CustomerPayment`, `CustomerPaymentAllocation[]` (`createMany`),
     decremento de cada `CustomerStoreBalance` e `CashMovement` `IN` no caixa aberto
     da loja que recebe (sem caixa aberto → 409).
   - `GET .../payments`: histórico de pagamentos do cliente.
6. **Devolução de vasilhame** (`POST /stores/:storeId/customers/:customerId/bottle-returns`,
   `{ bottleTypeId, quantity > 0 }`), conforme P7. Padrão: mesma loja, sem passar da
   dívida. Cria `BottleMovement` `CUSTOMER_RETURN` (+qtd), incrementa
   `StoreBottleType.stock` e decrementa `CustomerStoreBottleBalance`.
7. **Empréstimo avulso** (fora de venda): `POST .../bottle-loans`, mesmo padrão com
   `CUSTOMER_BORROW` (−qtd).

**Critério de conclusão:** pagar R$100 na loja B abatendo R$60 da dívida da A e R$40 da
B funciona numa chamada atômica e aparece em `balances`; o caixa de B recebe a entrada
de R$100; uma alocação inválida não altera nada (rollback).

---

## Fase 6 — Caixa, vendas e comandas

1. **`CashRegisterModule`** (`/stores/:storeId/cash-register`):
   - `POST /open` `{ initialBalance >= 0 }`: um caixa aberto por loja (advisory lock).
   - `GET /current`: caixa aberto com movimentações e saldo atual calculado.
   - `POST /close`: calcula `finalBalance` = inicial + `IN` + `SALE` − `OUT`. Responde
     também com um resumo por forma de pagamento (vindo das `Sale` do período), para
     conferência.
   - `POST /movements` `{ type: IN | OUT, amount > 0, description }`. `OUT` não pode
     deixar o saldo negativo. `SALE` não é aceito aqui.
   - `GET /history`: caixas fechados, paginado.
   - ⚠️ O código antigo registrava toda venda não fiado (inclusive PIX e cartão) como
     movimento `SALE` no caixa. Manter esse comportamento; `CashMovement` não tem
     forma de pagamento, então separar dinheiro de cartão no fechamento exigiria P9.
2. **`SaleModule`** (`/stores/:storeId/sales`):
   - `POST`: `{ paymentMethod, customerId?, discount?, items: [{ storeProductId, quantity }], bottleReturns?: [{ bottleTypeId, quantity }] }`.
     Uma transação:
     1. Exige caixa aberto na loja.
     2. Para cada item: `StoreProduct` da loja, ativo e não excluído; preço e custo
        **do banco**; baixa atômica de estoque (409 se insuficiente, com o nome do
        produto).
     3. Total, custo total, desconto (`0 <= desconto <= total`; limite de desconto por
        papel (⚠️ sugestão: sem limite agora)). Tudo com `roundMoney`.
     4. `Sale` com `userId` = usuário atual, depois `SaleItem[]` com `createMany`.
     5. `CREDIT_STORE`: exige cliente; incrementa (ou cria/reativa)
        `CustomerStoreBalance` da loja. Senão, `CashMovement` `SALE`.
     6. Vasilhame (regra do código antigo): para cada produto com `bottleTypeId`, o
        cliente leva `quantity` vasilhames (⚠️ `quantity × packQuantity`? Sugestão:
        `quantity`, como no código antigo) e pode devolver na hora (`bottleReturns`).
        Se levou mais do que devolveu, exige cliente. Cria `BottleMovement`
        `CUSTOMER_BORROW` (−) e `CUSTOMER_RETURN` (+) com `saleId`, ajustando
        `StoreBottleType.stock` e `CustomerStoreBottleBalance`.
   - `GET`: paginado, com filtros `search` (id), `paymentMethod`, `status`, período
     (no fuso `APP_TIMEZONE`), `customerId`, `userId`; `meta` com receita e lucro
     somados (só `COMPLETED`).
   - `GET /:id`: com itens (nome do produto via `StoreProduct` → `Product`), vendedor,
     cliente e vasilhames.
   - `POST /:id/cancel` (MANAGER): uma transação com caixa aberto obrigatório.
     - `status = CANCELED`.
     - Estoque devolvido (incremento).
     - **Movimentos de vasilhame compensatórios** (não excluir os originais, ao
       contrário do código antigo) e reversão dos saldos de vasilhame.
     - Fiado: decrementa `CustomerStoreBalance` (⚠️ se o cliente já pagou parte, o
       saldo pode ficar negativo; sugestão: bloquear o cancelamento com 409 e pedir
       estorno manual).
     - Não fiado: `CashMovement` `OUT` "Cancelamento da venda #id".
3. **`CommandTabModule`** (`/stores/:storeId/command-tabs`):
   - `POST` `{ name, customerId? }`; `GET` (abertas, ou com filtro de status);
     `GET /:id` com itens e total parcial.
   - `POST /:id/items` `{ storeProductId, quantity }`: baixa o estoque **ao adicionar**
     (o produto já saiu fisicamente), com preço e custo do banco.
   - `DELETE /:id/items/:itemId`: soft delete do item e devolução do estoque.
   - `POST /:id/close` `{ paymentMethod, discount?, customerId?, bottleReturns? }`:
     gera a `Sale` pela mesma função interna da venda, **sem baixar estoque de novo**,
     com `commandTabId`, e marca a comanda como `CLOSED`. Comanda vazia → 400.
   - `POST /:id/cancel`: devolve o estoque de todos os itens e marca `CLOSED` com soft
     delete (⚠️).
   - A lógica de venda fica num service interno compartilhado (`createSaleInTx(tx, ...)`)
     e não é duplicada.

**Critério de conclusão:** uma venda com produto comum + produto com vasilhame gera
`Sale`, `SaleItem[]`, baixa de `StoreProduct.stock`, `BottleMovement` e ajuste de
`StoreBottleType.stock` e `CustomerStoreBottleBalance`, numa transação; com estoque
insuficiente em um item, nada é gravado; duas vendas concorrentes do último item: uma
passa e a outra recebe 409; o cancelamento restaura tudo e gera movimentos
compensatórios.

---

## Fase 7 — Dashboard e relatórios

🛑 Antes de cachear as métricas: **P3**.

1. `GET /stores/:storeId/dashboard` (MANAGER) e `GET /companies/:companyId/dashboard`
   (OWNER, soma das lojas + quebra por loja):
   - Receita, lucro e número de vendas de hoje, 7 dias e mês (`APP_TIMEZONE`, só
     `COMPLETED`).
   - Top 5 produtos em 7 dias.
   - Gráfico dos últimos 7 dias (receita e lucro por dia).
   - Alertas de estoque baixo.
   - Total de fiado em aberto.
   Usar agregações no banco (`groupBy`/`aggregate` ou `$queryRaw` tipado), sem trazer
   todas as vendas para a memória como o código antigo fazia.
2. ⚠️ Relatórios extras (vendas por vendedor, por forma de pagamento) ficam de fora
   até o usuário pedir.

---

## Fase 8 — Consulta de auditoria

1. `GET /stores/:storeId/audit/:entity/:id` (MANAGER), para as entidades de loja:
   `store-products`, `sales`, `command-tabs`, `cash-registers`, `bottle-movements`.
   `GET /companies/:companyId/audit/:entity/:id` (OWNER): `products`, `customers`,
   `bottle-types`, `stores`, `memberships`, `membership-stores`.
   - Lista as versões em ordem (`historyStart`), com o nome do autor (lookup em
     `User`; `system` vira "Sistema") e o **diff** de cada versão em relação à anterior
     (só os campos que mudaram).
   - Antes de ler o histórico, conferir que o registro original (mesmo excluído)
     pertence ao tenant da rota.
2. Parâmetro `?at=<ISO>`: estado do registro naquele momento.
3. Mapa `entity → modelo History` fechado (whitelist); nada de nome de tabela vindo da
   requisição direto em SQL.

**Critério de conclusão:** alterar o preço de um produto duas vezes e consultar mostra 3
versões, com autor, endpoint e diff; um usuário de outra company recebe 404.

---

## Fase 9 — Plataforma (SUPERADMIN / SUPPORT) e notificações

1. Rotas `/platform/*`, protegidas por `@PlatformRole`. SUPPORT só lê; SUPERADMIN lê e
   escreve.
   - Planos: CRUD (excluir = soft delete; bloqueado se houver organization ativa no
     plano). `GET /plans` público (vitrine do cadastro).
   - Organizations: listagem com filtros (status, plano), detalhe com companies, lojas
     e contagem de usuários; `PATCH` de `subscriptionStatus` e `planId` (manual: para
     cortesia e suporte, e até a Fase 10 existir; depois dela o status normalmente vem
     dos webhooks do Asaas). Também `PATCH` de `trialEndsAt` (estender o trial) e limpar
     `pastDueSince` (cortesia). Ao mudar o status manualmente, manter `pastDueSince`
     coerente: preencher ao virar `PAST_DUE` e limpar ao sair dele.
   - Eventos de cobrança (depois da Fase 10): listagem de `tb_billing_events` com
     filtros (organização, tipo, com erro) e `POST .../reprocess` (SUPERADMIN).
   - Usuários: busca por e-mail; ativar/desativar (`isActive`).
2. **Notificações:**
   - `/platform/notifications`: CRUD (SUPERADMIN). `publishedAt` futuro = agendada;
     `expiresAt` opcional.
   - `GET /me/notifications`: publicadas (`publishedAt <= agora`), não expiradas, com
     flag `read`; `?unread=true`.
   - `POST /me/notifications/:id/read`: cria `NotificationRead` (idempotente).
3. Job agendado (`@nestjs/schedule`, via `runAsSystem`): rotina diária que lista trials
   que vencem em 3 dias e 1 dia, e carências que acabam amanhã, e cria lembretes por
   e-mail para o responsável pela cobrança (conforme P4). **Não muda status:** o modo
   somente leitura é calculado na hora por `resolveAccessMode` (Fase 2), a partir de
   `trialEndsAt` e `pastDueSince`.

---

## Fase 10 — Cobrança recorrente com Asaas

🛑 **Não começar sem P6.**

**Objetivo:** a organização assina um plano pagando de duas formas, ambas
automáticas a cada ciclo:
- **Cartão de crédito:** assinatura no cartão, cobrada automaticamente.
- **Pix Automático:** o cliente autoriza uma vez no app do banco e o débito é recorrente.

O status da assinatura (`Organization.subscriptionStatus`) passa a ser atualizado pelos
webhooks do Asaas.

**Banco (já pronto, não alterar sem P9):**
- `Organization`: `billingProvider` (`ASAAS`), `billingMethod` (`CREDIT_CARD` |
  `PIX_AUTOMATIC`), `billingDocument` (CPF/CNPJ), `billingEmail`, `billingCustomerId`,
  `billingSubscriptionId` (cartão), `billingPixAuthorizationId` (Pix Automático).
- `BillingEvent` (`tb_billing_events`): cada webhook recebido, único por
  (`provider`, `externalEventId`). É a garantia de idempotência.

**Fontes:** documentação oficial em `https://docs.asaas.com`. Os nomes exatos de
endpoints, campos e eventos citados aqui devem ser **conferidos na documentação e no
sandbox** antes de usar. Em especial, o Pix Automático é recente: o FAQ diz que a
aplicação cria cada cobrança, mas o changelog de maio de 2026 diz que
`paymentCreationMode: SUBSCRIPTION` faz o Asaas gerar sozinho. Se divergir, pare e
reporte.

1. **`AsaasClient`** (`src/billing/asaas/`): wrapper fino com `fetch` nativo.
   - Header `access_token: ASAAS_API_KEY`.
   - Timeout de 10 s; retry só em erro de rede e 5xx, apenas para operações idempotentes
     (GET).
   - Erros do Asaas mapeados para exceções próprias (gateway indisponível → 503 para o
     cliente, com mensagem amigável).
   - Nenhuma chamada ao Asaas dentro de `$transaction` do Prisma: chamar o gateway
     antes ou depois e gravar o resultado numa transação curta.
   - Interface (`BillingGateway`) separada da implementação, para os testes usarem um
     fake.
2. **Cliente no Asaas:** criado sob demanda na primeira assinatura (não no signup):
   `name` = nome da organização, `cpfCnpj` = `billingDocument`, `email` =
   `billingEmail`, **`externalReference` = `organizationId`** (é assim que os webhooks
   chegam à organização). Grava `billingCustomerId`.
3. **Endpoints** (`/organizations/:organizationId/billing`, só o responsável pela
   cobrança, exceto o `GET`, que o OWNER da company também vê):
   - `GET`: plano, `subscriptionStatus`, forma de pagamento, dias restantes de trial,
     próximo vencimento e últimas faturas (lidas do Asaas, com `invoiceUrl`; não há
     tabela local de faturas).
   - `PUT /billing-info` `{ document, email }`: valida CPF/CNPJ (dígitos
     verificadores) e atualiza o cliente no Asaas, se já existir.
   - `POST /subscribe` `{ planId, method }`:
     - **`CREDIT_CARD`:** cria a assinatura no Asaas (`billingType: CREDIT_CARD`, valor
       do plano, ciclo mensal (⚠️), `externalReference` = `organizationId`), **sem dados
       de cartão**, e retorna a `invoiceUrl` da primeira cobrança. O cliente digita o
       cartão **na página do Asaas** e os ciclos seguintes são cobrados no cartão
       automaticamente (confirmar esse comportamento no sandbox). **O número do cartão
       nunca passa pela nossa API nem pelo nosso frontend.** Um formulário de cartão
       próprio (tokenização) traz exigências de PCI e é P10/P9: perguntar antes.
     - **`PIX_AUTOMATIC`:** cria a autorização de Pix Automático com QR Code imediato
       ("Jornada 3": o pagamento da primeira cobrança já é o consentimento da
       recorrência), com `paymentCreationMode: SUBSCRIPTION` se confirmado, e retorna o
       payload/QR Code para o frontend. A autorização fica `ACTIVE` após o primeiro
       pagamento (chega por webhook).
     - Grava `billingProvider`, `billingMethod` e o id correspondente. **Não** muda
       `subscriptionStatus` aqui: isso só acontece quando o pagamento é confirmado pelo
       webhook.
   - `POST /change-plan` `{ planId }`: cartão: atualiza o valor da assinatura (vale a
     partir do próximo ciclo (⚠️ sem pró-rata)). Pix Automático: ⚠️ a autorização pode
     ter valor fixo ou máximo; se a troca exigir nova autorização, retornar o novo QR
     Code. Confirmar no sandbox.
     Antes de reduzir o plano, validar `maxCompanies`/`maxStoresPerCompany` contra o
     uso atual (409 se exceder).
   - `POST /change-method` `{ method }`: cria a nova forma; a antiga só é cancelada
     **depois** que a nova estiver ativa (webhook), para não deixar a organização sem
     forma de pagamento.
   - `POST /cancel`: cancela a assinatura/autorização no Asaas. O acesso continua até o
     fim do período pago (⚠️) e depois vira `CANCELED`.
4. **Trial** (14 dias, até `Organization.trialEndsAt`):
   - Cartão: a assinatura é criada com o primeiro vencimento (`nextDueDate`) em
     `trialEndsAt`, então nada é cobrado antes.
   - Pix Automático: a Jornada 3 cobra na hora. ⚠️ Sugestão: oferecer o Pix Automático
     só no fim do trial (ou quando o cliente assina antes, aceitando encerrar o trial).
     Confirmar com o usuário em P6.
5. **Webhook** `POST /api/webhooks/asaas` (`@Public()`, sem rate limit):
   1. Validar o header de autenticação (`asaas-access-token`, conferir o nome na
      documentação) contra `ASAAS_WEBHOOK_TOKEN` com comparação em tempo constante
      (`crypto.timingSafeEqual`). Inválido → 401.
   2. Inserir o `BillingEvent` (`externalEventId` = id do evento,
      `organizationId` pelo `externalReference`, `payload` bruto) dentro de
      `runAsSystem('webhook:asaas', ...)`. **Duplicado** (único violado) → responder
      200 sem reprocessar.
   3. Processar, gravar `processedAt` e responder **200 rápido**. Se o processamento
      falhar, gravar `error` e **ainda assim responder 200**: o Asaas pausa a fila de
      webhooks após falhas seguidas (conferir a regra na documentação), e o reprocesso
      é nosso (item 6).
   4. Mapeamento padrão (⚠️ confirmar nomes e lista com o usuário em P6):

      | Evento do Asaas | Efeito |
      |---|---|
      | Pagamento confirmado/recebido (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`) | `subscriptionStatus = ACTIVE`, `pastDueSince = null` (sai da carência ou do modo leitura na hora) |
      | Pagamento vencido (`PAYMENT_OVERDUE`) | `PAST_DUE`; `pastDueSince` = data de vencimento da cobrança (do payload), **só se ainda estiver nulo** (um segundo aviso de atraso não reinicia a carência) |
      | Assinatura removida/inativada (`SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`) | `CANCELED` (ou fim do período pago, ver `/cancel`) |
      | Estorno/chargeback (`PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_*`) | ⚠️ sugestão: `PAST_DUE` + aviso para o SUPERADMIN |
      | Autorização de Pix Automático ativada/cancelada/expirada | grava ou limpa `billingPixAuthorizationId`; cancelada sem outra forma ativa → `PAST_DUE` |
      | Qualquer outro | só registra |

   5. Ignorar eventos fora de ordem: o pagamento confirmado de um ciclo antigo não
      reativa uma organização `CANCELED` posteriormente (comparar datas do payload).
6. **Reprocessamento:** job agendado (`@nestjs/schedule`, `runAsSystem`) a cada 10 min
   reprocessa `BillingEvent` com `processedAt` nulo, com até 5 tentativas (contar pelo
   histórico ou pela mensagem de `error`). Também existe o reprocesso manual na
   plataforma (Fase 9).
7. **Ambiente local:** sandbox do Asaas + túnel (P6) apontando para
   `http://localhost:3001/api/webhooks/asaas`. Documentar no README como configurar o
   webhook no painel do sandbox.
8. **Testes:**
   - unitários do mapeamento de eventos, com payloads de exemplo da documentação
     salvos em `test/fixtures/asaas/`;
   - e2e do webhook: token inválido (401), evento duplicado (processado uma vez só),
     falha no processamento (200 + `error` gravado + reprocessado pelo job);
   - fluxo completo com o `BillingGateway` fake: assinar → webhook confirmado →
     `ACTIVE` → vencido → `PAST_DUE` com acesso completo (carência) → 5 dias depois,
     somente leitura (402 em escrita, fechar caixa e billing funcionando) → pagamento
     confirmado → `ACTIVE` com acesso completo na hora.

**Critério de conclusão:** no sandbox, uma organização assina com cartão e outra com Pix
Automático; as duas ficam `ACTIVE` só depois do webhook de pagamento; reenviar o mesmo
webhook não duplica nada; o histórico (`th_organization_history`) mostra cada mudança de
status com `modifiedEndpoint = webhook:asaas`.

---

## Fase 11 — Testes finais e endurecimento

1. **Unitários:** `allocatePayment`, cálculo de venda (total, desconto, vasilhames),
   fechamento de caixa, diff de auditoria, geração de EAN-13, guards.
2. **E2E**, no banco de teste:
   - isolamento entre companies em todos os módulos;
   - venda completa com fiado e vasilhame;
   - pagamento cruzado;
   - cancelamento de venda;
   - comanda;
   - convite e papéis;
   - bloqueio por assinatura;
   - concorrência de estoque e de abertura de caixa.
3. **Auditoria ponta a ponta:** o teste da Fase 0 (nenhum `th_*` com `modifierId`
   nulo) passa no fim da suíte completa, e nenhum teste usa `deleteMany`.
4. Revisão final: nenhum `any` em body, nenhum `delete` físico, nenhuma consulta sem
   escopo de tenant, nenhuma resposta com `passwordHash`, Swagger desligado em produção.
5. **Atualizar a documentação:**
   - `README.md`: como rodar, variáveis e seed;
   - `docs/BANCO_DE_DADOS.md`, se algo mudou por P9;
   - lista final de rotas, para alinhar o plano de frontend.

---

## Contratos usados pelo frontend

O `plano_implementacao_frontend.md` já usa estes contratos. **Mudou algum formato ou
rota daqui? Avise o usuário**, porque o plano de frontend precisa acompanhar.

| Contrato | Rota |
|---|---|
| Acessos do usuário | `GET /api/me/memberships`: companies → lojas com `role`, `isCompanyOwner` e `subscription` (`status`, `accessMode`, `trialEndsAt`, `pastDueSince`, `graceEndsAt`) |
| Saldos do cliente | `GET /api/companies/:companyId/customers/:id/balances` |
| Pagamento de fiado | `POST /api/stores/:storeId/customers/:customerId/payments` |
| Criação de produto em várias lojas | `POST /api/companies/:companyId/products` com `stores: [{ storeId, price, costPrice? }]` |
| Dashboards | `GET /api/stores/:storeId/dashboard`, `GET /api/companies/:companyId/dashboard` |
| Somente leitura | Erro 402 `{ code: "SUBSCRIPTION_READ_ONLY", reason }` |
| Assinatura | `/api/organizations/:organizationId/billing/*` |
| Contexto | Ids de company/loja **na rota**, nunca em headers |

---

## Relatório final esperado

- Decisões ⚠️ tomadas (lista com o arquivo de cada `TODO(decisão-produto)`).
- Respostas recebidas nas paradas P1–P10.
- Ambiguidades encontradas que este plano não cobria.
- Rotas implementadas (ou o link do Swagger).
