# Plano de Implementação — Frontend (Next.js + React + TypeScript + Tailwind CSS)

## Contexto

O frontend será **refeito do zero** sobre o backend SaaS, que já está pronto. O código
atual de `frontend/` é o legado (React + Vite + JavaScript, uma distribuidora só): as telas
antigas (`PDV`, `Caixa`, `Comandas`, `Estoque`, `Clientes`, `Vasilhames`, `Dashboard`,
`Historico`, `Usuarios`) servem só de referência visual e de fluxo. As regras de negócio
antigas ficam no git (`git show a4ff703:frontend/src/<arquivo>`).

**Fonte da verdade dos contratos (consulte antes de montar qualquer tela):**
- [docs/API.md](docs/API.md): todas as rotas, o papel mínimo de cada uma e o que acontece
  em somente leitura. É gerado do código do backend (`npm run docs:api`).
- Swagger em `http://localhost:3001/api/docs` (fora de produção): corpos e respostas.
- [plano_implementacao_backend.md](plano_implementacao_backend.md) (regras de negócio e o
  "Relatório da implementação" no fim) e [CLAUDE.md](CLAUDE.md) (regras gerais).

Se uma tela precisar de algo que a API não oferece, **pare e avise o usuário**: não invente
contrato e não contorne no frontend.

Para desenvolver com dados reais: subir o backend (`npm run dev` em `backend/`) e rodar
`npm run db:seed` uma vez. Usuários do seed (senha `123456`): `dono@exemplo.com` (dono das
duas lojas), `gerente@exemplo.com` (gerente da Loja Centro), `funcionario@exemplo.com`
(funcionário da Loja Norte) e `admin@plataforma.com` (plataforma).

---

## Stack (decidida pelo usuário)

| | Escolha |
|---|---|
| Framework | **Next.js** (versão estável atual), com **App Router** |
| UI | **React** (19) |
| Linguagem | **TypeScript** em modo `strict` (nada de `any` em props, respostas da API ou estado) |
| Estilo | **Tailwind CSS** (v4) |

Regras:
- **Projeto novo** em `frontend/`, criado com `create-next-app` (TypeScript, Tailwind, App
  Router, ESLint, pasta `src/`). O legado é removido do diretório no mesmo passo (continua
  no git). Não misturar com o código Vite.
- **Sem backend no Next:** a API é o backend NestJS. Não criar regras de negócio, acesso a
  banco ou rotas `app/api/*` que dupliquem a API (exceção possível: a parada F1).
- A área logada roda como **Client Components** (dados por usuário, com token). Páginas
  públicas (login, cadastro, redefinir senha) podem ser simples.
- **Tipos da API em um lugar só** (`src/lib/api/types.ts` ou gerados do Swagger, ver F2).
  Nenhuma tela declara o formato de resposta por conta própria.
- Variável de ambiente: `NEXT_PUBLIC_API_URL` (padrão `http://localhost:3001/api`).
- **Portas em desenvolvimento (decidido pelo usuário):** o Next roda na porta padrão
  **3000** e a API na **3001**. O backend já usa `http://localhost:3000` como padrão de
  `CORS_ORIGINS` e `APP_URL`, então não é preciso mexer no `backend/.env`. Se mudar a porta
  do Next, essas duas variáveis precisam mudar junto.
- Interface em **português do Brasil**, valores em R$ (`Intl.NumberFormat('pt-BR')`) e
  datas no fuso `America/Sao_Paulo`.

### Paradas obrigatórias do frontend (perguntar ao usuário antes)

| ID | Assunto | Recomendação a apresentar |
|---|---|---|
| **F1** | **Onde guardar os tokens** | Recomendado: um BFF fino no Next (route handlers) que guarda o refresh token em **cookie httpOnly** e repassa as chamadas; o JavaScript da página nunca vê o refresh token (proteção contra XSS). Alternativa mais simples: access token em memória e refresh token no `localStorage` (mais exposto). A escolha muda a Fase 0 |
| **F2** | **Bibliotecas além da stack** | Recomendado: TanStack Query (cache e recarga após alterações), React Hook Form + Zod (formulários), um gráfico (Recharts) e um gerador de tipos do Swagger (`openapi-typescript`). Pedir aprovação da lista; não instalar outras sem perguntar |
| **F3** | **Componentes visuais** | Tailwind puro com componentes próprios, ou uma base pronta sobre Tailwind (ex.: shadcn/ui). Perguntar |

---

## Regras gerais (valem para todas as fases)

- **Contexto na URL:** os ids de empresa e loja vão **na URL da API**
  (`/api/companies/:companyId/...`, `/api/stores/:storeId/...`), nunca em headers.
  ⚠️ Sugestão para as rotas do Next: espelhar isso (`/empresa/[companyId]/...` e
  `/loja/[storeId]/...`), o que permite abas em lojas diferentes e links diretos.
- **Papéis:** `OWNER > MANAGER > EMPLOYEE`, **por loja**. Não existe `ADMIN`. "Dono da
  empresa" = `isCompanyOwner` em `GET /api/me/memberships`; "responsável pela cobrança" =
  `isBillingOwner`.
- **Esconder botão é UX, não segurança:** o backend sempre valida. Tratar 403 mesmo quando a
  tela já esconde a ação.
- **Formato de respostas e erros do backend:**
  - Listas paginadas: `?page=&limit=` (máx. 100) →
    `{ data, meta: { page, limit, totalItems, totalPages } }`.
  - Erro: `{ statusCode, message }`. Em erro de validação (400), `message` é uma **lista**
    de textos; nos demais, um texto. Mostrar a mensagem do backend (já vem em português).
  - **404** = não existe ou é de outro tenant. **403** = papel insuficiente. **409** = regra
    de negócio (estoque insuficiente, caixa fechado, dívida menor que o valor...). **402**
    = somente leitura (ver Fase 8). **429** = muitas tentativas.
- **Nunca enviar campos que a API não espera:** ela recusa campos extras (400). Em
  especial, **preço e custo nunca vão na venda nem na comanda**: o backend lê do banco.
- **Excluir = soft delete:** o registro some das listas, mas pode ser **reativado**
  (`POST .../:id/restore` para produtos, tipos de vasilhame e clientes). Códigos e nomes
  continuam reservados: ao cadastrar um repetido, a mensagem do 409 orienta a reativar.
- **Dinheiro:** mostrar sempre com 2 casas; nunca somar totais no frontend (o backend
  devolve os totais).
- **Toda tela nasce com a sua ajuda** (regra do usuário): uma funcionalidade só está pronta
  quando o artigo dela na **Central de Dúvidas** foi criado ou atualizado, com o caminho
  certo no menu. Ver a seção abaixo.

---

## Central de Dúvidas (regra do usuário)

O sistema tem uma seção **"Dúvidas"** que ensina donos de distribuidora, gerentes e
atendentes a usar o sistema e **onde encontrar cada funcionalidade**. Ela é parte do
produto, não um extra: é construída junto com as telas, fase a fase.

### Onde fica
- Item **"Dúvidas"** sempre visível no menu da área logada.
- Botão **"?"** em cada tela, que abre direto o artigo daquela tela.
- Nas telas públicas (login, cadastro, redefinir senha), um link para as dúvidas de acesso
  (esqueci a senha, recebi um convite, o link expirou).

### Para quem
Artigos separados por perfil, com linguagem de balcão, sem termos técnicos (nada de "API",
"402", "token", "endpoint"):
- **Dono** (OWNER): empresa, lojas, equipe, produtos e preços, painéis, histórico de
  alterações, assinatura.
- **Gerente** (MANAGER): estoque, preços da loja, sangria, cancelar venda, ajuste de
  vasilhame, painel da loja.
- **Atendente** (EMPLOYEE): abrir e fechar caixa, vender, comandas, clientes, receber
  fiado, empréstimo e devolução de vasilhame.

Por padrão a central abre nos artigos do papel do usuário na loja ativa, mas ele pode ver
todos. Artigos de algo que o papel dele não pode fazer mostram o aviso "peça ao gerente"
ou "peça ao dono", em vez de sumir.

### O que cada artigo tem
1. **Para que serve**, em uma frase.
2. **Onde encontrar**: o caminho exato no menu (ex.: "Menu › Caixa › Fechar caixa").
3. **Passo a passo** curto.
4. **Quem pode fazer** (dono, gerente ou atendente).
5. **Problemas comuns**: a mensagem que a pessoa vê na tela e o que fazer (ex.: "Não há
   caixa aberto" → abra o caixa em Menu › Caixa).

### Artigos obrigatórios (mínimo)
- **Acesso:** entrar, esqueci a senha, recebi um convite (definir a primeira senha),
  trocar de empresa ou loja, minha conta, trocar a senha, sair de todos os aparelhos.
- **Caixa:** abrir, ver o saldo, entrada, sangria, fechar e conferir o resumo por forma de
  pagamento, ver caixas anteriores.
- **Vendas:** vender (busca, leitor de código de barras, desconto), vender fiado, venda
  com vasilhame (quando precisa escolher o cliente), histórico de vendas, cancelar venda.
- **Comandas:** abrir, adicionar e remover itens, fechar, cancelar.
- **Produtos e estoque:** cadastrar produto (inclusive em várias lojas), preço diferente
  por loja, colocar ou tirar um produto da loja, entrada de mercadoria, ajuste de
  inventário, estoque baixo, excluir e reativar.
- **Vasilhames:** tipos, estoque da loja, envio e recebimento do fornecedor, empréstimo e
  devolução do cliente (incluindo a regra: **a devolução só abate a dívida da loja onde o
  cliente levou**).
- **Clientes e fiado:** cadastrar, ver a dívida por loja, receber pagamento (automático ou
  distribuindo entre lojas), pagar a dívida de uma loja estando em outra.
- **Gestão:** painel da loja e da empresa, histórico de alterações, equipe (convidar, papel
  por loja, revogar acesso), lojas, dados da empresa, notificações.
- **Assinatura:** período de teste, mensalidade em atraso, o que continua funcionando em
  somente leitura (consultar tudo e fechar o caixa) e como regularizar.

### Perguntas frequentes (mínimo)
- "Por que não consigo vender?" (caixa fechado, sistema em somente leitura ou estoque
  insuficiente).
- "Por que este botão está apagado?" (papel na loja ou somente leitura).
- "O cliente quer devolver o vasilhame em outra loja."
- "Cancelei uma venda fiado que já tinha sido paga em parte e deu erro."
- "Excluí um produto/cliente por engano." (reativar)
- "O código de barras já existe."
- "Não recebi o e-mail de redefinição de senha."

### Como implementar
- **Conteúdo estático no próprio frontend** (ex.: arquivos MDX ou TypeScript em
  `src/content/duvidas/`), versionado junto com o código. Não precisa de backend.
- Busca por título e conteúdo dentro da central.
- Cada artigo tem um identificador usado pelo botão "?" da tela correspondente.
- ⚠️ Capturas de tela são opcionais; se usadas, atualizar quando a tela mudar.

### Regra de manutenção
Em **toda fase**, ao criar ou mudar uma tela, criar ou atualizar o artigo correspondente e
o caminho "onde encontrar". Se um item do menu mudar de lugar ou de nome, os artigos que o
citam mudam junto. O critério de conclusão de cada fase inclui os artigos daquela fase.

---

## Fase 0 — Fundamentos

🛑 Antes: **F1**, **F2** e **F3**.

1. Criar o projeto Next (ver Stack), configurar Tailwind, ESLint e `tsconfig` estrito,
   `NEXT_PUBLIC_API_URL` e um `.env.example` do frontend.
2. **Cliente da API** tipado, que injeta o access token e oferece helpers com o contexto
   ativo, por exemplo `storeApi(storeId).get('/sales')` → `/api/stores/<id>/sales`. As
   telas não montam ids nem headers à mão.
3. **Sessão com access token + refresh token com rotação** (conforme F1):
   - Login, cadastro e refresh devolvem `{ access_token, refresh_token, token_type,
     expires_in }` (login e cadastro também `user`). Access token: 15 min. Refresh token:
     30 dias, **uso único**: cada `POST /api/auth/refresh` devolve um par novo e invalida
     o anterior. **Sempre substituir os dois.**
   - Ao receber 401 (ou perto de `expires_in`), renovar **uma vez por vez**: requisições
     que falharem juntas esperam a mesma renovação (fila). Reusar um refresh token já
     gasto derruba a sessão inteira (401): não repetir, ir para o login.
   - Logout: `POST /api/auth/logout` com o refresh token. "Sair de todos os dispositivos":
     `POST /api/auth/logout-all`.
4. **Tratamento central de erros** conforme as regras gerais (401 após falhar a renovação
   → login; 402 → aviso de somente leitura; 404/403/409 → mensagem do backend).
5. **Estado da sessão:** usuário (`GET /api/me`), `memberships` (`GET /api/me/memberships`)
   e company/loja ativas. Persistir a última seleção; se a loja salva não estiver mais
   em `memberships` (acesso revogado), voltar para a seleção.
6. **Estrutura da Central de Dúvidas:** página "Dúvidas" no menu, busca, filtro por perfil
   (dono, gerente, atendente) e o componente do botão "?" que abre o artigo da tela. O
   conteúdo vai sendo escrito fase a fase (ver a seção Central de Dúvidas).

**Critério de conclusão:** qualquer chamada autenticada sai com o token e a URL do
contexto ativo sem que a tela monte isso; a renovação de token é transparente e nunca
reusa um refresh token; a Central de Dúvidas existe e aceita artigos novos.

---

## Fase 1 — Autenticação e seleção de contexto

1. **Login** (`POST /api/auth/login`). Limite: 5 tentativas por minuto por e-mail (429).
2. **Esqueci a senha** (`POST /api/auth/forgot-password`): a resposta é sempre a mesma,
   exista o e-mail ou não. Mostrar "se o e-mail estiver cadastrado, enviaremos as
   instruções".
3. **`/redefinir-senha?token=...`** (`POST /api/auth/reset-password` com `{ token,
   newPassword }`). **Esta rota precisa existir com este caminho**: é o link que o backend
   manda por e-mail tanto para redefinir senha (vale 30 min) quanto para o **convite de
   membro novo** definir a primeira senha (vale 7 dias). O link só funciona uma vez.
   Membro convidado que já tem conta recebe um link para `/login`.
4. **Pós-login:** `GET /api/me/memberships`.
   - Uma empresa e uma loja: seleciona sozinho e vai para a tela inicial.
   - Várias empresas: seleção de empresa. Depois, se houver várias lojas, seleção de loja
     mostrando o papel em cada uma (pode ser diferente por loja).
   - Sem nenhuma empresa: tela explicando que o usuário ainda não tem acesso.
5. Troca de empresa/loja sempre visível (cabeçalho ou menu), sem sair da conta.
6. **Minha conta:** editar nome (`PATCH /api/me`), trocar senha
   (`POST /api/auth/change-password`, que encerra as outras sessões e devolve um par novo
   de tokens) e "sair de todos os dispositivos".

**Critério de conclusão:** um usuário com acesso a 2 lojas com papéis diferentes alterna
entre elas e a interface reflete o papel certo; o link de redefinição recebido por e-mail
funciona.

---

## Fase 2 — Autorização na interface

1. Hook `useCurrentRole()`: papel na loja ativa, lido dos `memberships` (sem request).
2. Componentes `<RequireRole min="MANAGER">` e `<RequireCompanyOwner>` para esconder ou
   desabilitar ações, seguindo o papel mínimo de cada rota em [docs/API.md](docs/API.md).
   Regras que dependem do conteúdo (também em `docs/API.md`): saída de caixa e ajuste
   manual de vasilhame exigem gerente.
3. Proteção de página inteira equivalente (ex.: área de administração só para o dono).

---

## Fase 3 — Administração (empresa, lojas, equipe)

1. **Empresa:** ver e editar razão social e nome fantasia (`/api/companies/:companyId`, dono).
   O CNPJ não muda.
2. **Lojas:** listar, criar, editar e excluir (`/api/companies/:companyId/stores`, dono).
   Criar respeita o limite do plano (409 com a mensagem do limite). Excluir é recusado com
   caixa ou comanda aberta. A loja nova já nasce com todos os donos como OWNER.
3. **Equipe** (`/api/companies/:companyId/members`, dono):
   - Convidar por e-mail com o papel em cada loja (`stores: [{ storeId, role }]`). Usuário
     novo recebe o link de definir senha (ver Fase 1).
   - Tabela por membro: loja × papel, alterando **por loja** (`PUT .../members/:membershipId/stores/:targetStoreId`).
   - Revogar uma loja (`DELETE .../stores/:targetStoreId`) ou o membro inteiro
     (`DELETE .../members/:membershipId`). O backend recusa (409) alterar o próprio papel
     e deixar a empresa sem nenhum dono: mostrar a mensagem.
4. **Nova empresa na organização** (`POST /api/organizations/:organizationId/companies`,
   só o responsável pela cobrança; `GET /api/organizations/mine` lista as organizações),
   respeitando o limite de empresas do plano.

---

## Fase 4 — Catálogo, estoque e vasilhames

1. **Produtos da loja ativa** (`GET /api/stores/:storeId/store-products`, com busca e
   filtro de ativos): o backend já junta nome e código do produto.
2. **Criar produto** (`POST /api/companies/:companyId/products`, gerente):
   - Pergunta "este produto também é vendido em outras lojas da empresa?". Se sim,
     checklist das lojas (`GET /api/companies/:companyId/stores`), com preço obrigatório
     por loja e custo comum pré-preenchido (editável por loja). Payload:
     `{ name, code?, packQuantity?, bottleTypeId?, costPrice?, stores: [{ storeId, price, costPrice? }] }`.
   - Código de barras opcional (o backend gera um EAN-13 se vazio).
3. **Colocar na loja** um produto que já existe no catálogo
   (`POST /api/stores/:storeId/store-products`) e **tirar da loja** (`DELETE`).
4. **Editar preço, custo e ativo** só desta loja (`PATCH .../store-products/:id`), deixando
   claro que não afeta outras lojas.
5. **Estoque nunca é editado no formulário.** Duas ações separadas:
   "Entrada de mercadoria" (`.../stock-entries`, soma) e "Ajuste de inventário"
   (`.../stock-adjustments`, estoque contado + motivo obrigatório). São separadas para o
   histórico registrar a origem.
6. **Estoque baixo** (`.../store-products/low-stock`, gerente).
7. **Vasilhames:**
   - Tipos (nível empresa, `/api/companies/:companyId/bottle-types`), com reativação.
   - Estoque por tipo na loja (`GET /api/stores/:storeId/bottle-stock`).
   - Movimentações (`/api/stores/:storeId/bottle-movements`): envio e recebimento de
     fornecedor (funcionário) e ajuste manual (gerente, quantidade com sinal). O estoque
     de vasilhame **só muda por movimentação** e nunca fica negativo nessas operações.
   - Histórico de movimentações com filtros (tipo, cliente, período).
8. **Excluir e reativar** produtos e tipos de vasilhame (soft delete).

**Critério de conclusão:** criar um produto marcando 2 lojas gera as duas ofertas;
editar o preço numa loja não altera a outra.

---

## Fase 5 — PDV, caixa e comandas

1. **Caixa** (`/api/stores/:storeId/cash-register`):
   - Abrir (`open`, saldo inicial), ver o atual (`current`, com saldo calculado), entrada
     (`movements` tipo `IN`, funcionário) e saída/sangria (`OUT`, **gerente**; o backend
     recusa deixar o saldo negativo).
   - Fechar (`close`): mostrar o saldo final e o **resumo por forma de pagamento** que o
     backend devolve. O movimento do caixa não separa dinheiro de PIX/cartão: a
     conferência usa esse resumo.
   - Histórico de caixas fechados e o detalhe de cada um (`history`, `/:id`).
2. **Venda** (`POST /api/stores/:storeId/sales`):
   - **Exige caixa aberto na loja, em qualquer forma de pagamento (inclusive fiado).**
     Sem caixa, o PDV fica bloqueado com o botão para abrir.
   - Busca por nome/código e **leitor de código de barras** (`.../store-products/by-code/:code`,
     só itens ativos).
   - Carrinho com quantidades e desconto (o desconto não pode passar do total). O total
     mostrado é uma prévia: o valor oficial é o que o backend devolve.
   - Payload: `{ paymentMethod, customerId?, discount?, items: [{ storeProductId, quantity }], bottleReturns?: [{ bottleTypeId, quantity }] }`.
     **Nunca enviar preço.**
   - **Fiado (`CREDIT_STORE`)** exige escolher ou cadastrar o cliente.
   - **Vasilhames:** cada produto com vasilhame faz o cliente levar 1 vasilhame por
     unidade. Se houver produtos com vasilhame no carrinho, mostrar quantos vasilhames
     saem e perguntar quantos o cliente devolve na hora (`bottleReturns`). **Se ele sair
     devendo ou com crédito de vasilhame, é obrigatório identificar o cliente** (senão o
     backend responde 400). Troca de 1 por 1 dispensa cliente.
   - Estoque insuficiente volta 409 com o nome do produto: mostrar e manter o carrinho.
3. **Histórico de vendas** (`GET /api/stores/:storeId/sales`): filtros por período
   (`startDate`/`endDate` no formato `AAAA-MM-DD`, no fuso de São Paulo), forma de
   pagamento, situação, cliente e vendedor. A resposta traz `meta.totalRevenue` e
   `meta.totalProfit` (só vendas concluídas). Detalhe da venda com itens, vendedor,
   cliente e vasilhames.
4. **Cancelar venda** (`POST .../sales/:id/cancel`, **gerente**, exige caixa aberto):
   devolve estoque, estorna caixa ou fiado e desfaz os vasilhames. Venda a prazo já paga
   em parte não pode ser cancelada (409): mostrar a mensagem.
5. **Comandas** (`/api/stores/:storeId/command-tabs`):
   - Abrir (nome e cliente opcional), listar as abertas, ver o total parcial.
   - **O estoque baixa ao adicionar o item** e o preço fica fixo no momento em que foi
     adicionado: atualizar a tela de estoque na hora. Remover item devolve o estoque.
   - Fechar gera a venda (forma de pagamento, desconto, cliente, devolução de vasilhames)
     sem baixar estoque de novo. Comanda vazia não fecha (400).
   - Cancelar devolve o estoque de todos os itens.

**Layout:** o PDV é a tela mais usada; deve funcionar bem em tablet e com leitor de código
de barras (foco no campo de busca, atalhos de teclado).

---

## Fase 6 — Clientes e fiado

1. **Clientes** (nível empresa, `/api/companies/:companyId/customers`): busca por nome ou
   telefone, cadastrar e editar (funcionário), excluir e reativar (gerente). O backend não
   exclui cliente com dívida.
2. **Detalhe do cliente:**
   - Saldos (`.../customers/:id/balances`): **total** consolidado (só gerente e dono; para
     funcionário o backend devolve `total: null` e só as lojas dele), dívida por loja e
     vasilhames devidos por loja.
   - Histórico de pagamentos (`.../customers/:id/payments`) e de vendas a prazo
     (`GET /api/stores/:storeId/sales?customerId=`).
3. **Receber pagamento** (`POST /api/stores/:storeId/customers/:customerId/payments`):
   - O dinheiro entra **na loja ativa** (a da URL) e exige **caixa aberto** nela. Não há
     campo "loja onde está pagando": é sempre a loja ativa.
   - Forma de pagamento: qualquer uma **menos** `CREDIT_STORE`.
   - **Automático:** só o valor; o backend abate primeiro a dívida da loja ativa e depois
     as demais (mais antigas primeiro).
   - **Manual:** lista as dívidas por loja e distribui o valor (`allocations`). Validar na
     tela que a soma bate com o valor e que nenhuma loja recebe mais do que deve.
   - Não existe saldo credor: valor maior que a dívida total é recusado.
4. **Vasilhames do cliente:** devolução (`.../bottle-returns`) e empréstimo avulso
   (`.../bottle-loans`) na loja ativa. **A devolução só abate a dívida da própria loja**
   (decisão do produto): se o cliente deve na loja A, a devolução é feita estando na loja
   A. Mostrar o saldo por loja e, ao tentar devolver em outra loja ou mais do que deve,
   exibir a mensagem do 409.

**Critério de conclusão:** pagar a dívida da Loja A estando na Loja B funciona nos modos
automático e manual, e os saldos se atualizam.

---

## Fase 7 — Painéis, histórico de alterações e notificações

1. **Painel da loja** (`GET /api/stores/:storeId/dashboard`, gerente) e **painel da
   empresa** (`GET /api/companies/:companyId/dashboard`, dono, com a quebra por loja em
   `byStore`): receita, lucro e vendas de hoje, 7 dias e mês; top 5 produtos; gráfico dos
   7 dias; estoque baixo; fiado em aberto. **Os períodos são fixos e calculados no
   backend**; o painel não aceita filtro de período. Para períodos livres, usar o
   histórico de vendas (Fase 5).
2. **Histórico de alterações:** botão "Histórico" nos detalhes (produto da loja, venda,
   comanda, caixa, movimentação de vasilhame, produto, cliente, tipo de vasilhame, loja,
   membro e papel por loja), para gerente/dono:
   - `GET /api/stores/:storeId/audit/:entity/:id` ou `/api/companies/:companyId/audit/:entity/:id`.
   - Mostra cada versão com autor, data, ação (criado, alterado, excluído, reativado) e
     **só os campos que mudaram**. `?at=<data ISO>` mostra o registro naquele momento.
   - O papel do membro numa loja usa o id `membershipId:storeId`. As entidades aceitas
     estão em [docs/API.md](docs/API.md).
3. **Notificações** do sistema: contador de não lidas
   (`GET /api/me/notifications/unread-count`), lista (`?unread=true`) e marcar como lida
   (`POST /api/me/notifications/:id/read`).

---

## Fase 8 — Cadastro, assinatura e modo somente leitura

### 8a. Já disponível no backend
1. **Cadastro público** (`POST /api/auth/signup`): nome, e-mail, senha (mín. 8), CNPJ,
   razão social, nome fantasia, nome da primeira loja e plano (de `GET /api/plans`,
   público). Começa em **trial de 14 dias**, sem forma de pagamento. Já devolve os tokens
   (entra logado). Limite: 3 cadastros por hora.
2. **Aviso de assinatura e modo somente leitura.** Regra do produto: inadimplência **nunca
   bloqueia o sistema inteiro**, só deixa em somente leitura. Usar `subscription` de
   `GET /api/me/memberships` (`status`, `accessMode`, `reason`, `trialEndsAt`,
   `pastDueSince`, `graceEndsAt`):
   - `FULL` em trial: "faltam X dias de teste" (destaque nos últimos 3 dias).
   - `GRACE` (mensalidade vencida há até 5 dias): faixa "pagamento pendente: o sistema
     ficará somente leitura em DD/MM".
   - `READ_ONLY` (`reason`: `TRIAL_EXPIRED`, `PAST_DUE` ou `CANCELED`): faixa fixa com o
     motivo. Tudo pode ser consultado; os botões de escrita (vender, abrir caixa,
     cadastrar, **receber fiado**...) ficam desabilitados com o motivo. **Fechar o caixa já
     aberto continua habilitado.**
   - Mesmo assim, tratar o 402 `{ code: "SUBSCRIPTION_READ_ONLY", reason }` (o status
     pode mudar com a tela aberta).
   - Quem não é o responsável pela cobrança (`isBillingOwner: false`) vê "fale com o
     responsável pela assinatura" em vez do botão de pagar.
   - Recarregar `GET /api/me/memberships` periodicamente e ao voltar para a aba, para o
     acesso completo voltar sozinho quando a assinatura for regularizada.

### 8b. Depende da cobrança com Asaas (Fase 10 do backend, AINDA NÃO FEITA)
🛑 **Não implementar** até o backend ter os endpoints `/api/organizations/:organizationId/billing/*`.
Enquanto isso, o botão "pagar/assinar" mostra que a assinatura é regularizada pelo
suporte. Quando a Fase 10 existir, a tela "Assinatura" terá: plano, status, forma de
pagamento, próximo vencimento e faturas (com `invoiceUrl`); dados de cobrança (CPF/CNPJ e
e-mail); assinar com **cartão** (abrir a `invoiceUrl` do Asaas: **nunca criar campo de
número de cartão no nosso frontend**) ou **Pix Automático** (QR Code e "copia e cola");
"aguardando confirmação" consultando o status por alguns minutos (a ativação chega por
webhook); trocar de plano e cancelar. Confirmar o formato real com o backend antes.

---

## Fase 9 — Painel da plataforma (opcional)

Só para usuários com `platformRole` (`SUPERADMIN` lê e escreve; `SUPPORT` só lê), em
`/api/platform/*`: planos, organizações (com ajuste manual de status, plano, fim do teste e
atraso: hoje é assim que a assinatura é regularizada), usuários (ativar/desativar) e
notificações (criar, agendar, expirar). ⚠️ Perguntar ao usuário se quer esta área no mesmo
app (rota separada, ex.: `/plataforma`) antes de começar.

---

## Fase 10 — Acabamento

1. Carregamento e erros consistentes, principalmente nos fluxos de dinheiro e estoque
   (venda com estoque insuficiente, alocação inválida, caixa fechado), sempre com a
   mensagem do backend.
2. PDV adaptado para tablet; layout responsivo no restante.
3. Revisão: nenhum `any`, nenhum preço enviado em venda/comanda, nenhum id de empresa/loja
   em header, tokens tratados conforme F1.
4. **Revisão da Central de Dúvidas:** todos os artigos obrigatórios existem, cada caminho
   "onde encontrar" bate com o menu real, toda tela tem o botão "?" apontando para um
   artigo, e as mensagens de erro citadas nos artigos são as que o sistema mostra.

**Reportar ao final:** endpoints que não bateram com o que a API realmente expõe,
respostas recebidas nas paradas F1–F3 e decisões de UX tomadas.
