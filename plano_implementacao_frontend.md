# Plano de Implementação — Frontend

## Contexto
Este plano assume que o backend expõe os endpoints e contratos descritos no arquivo
`plano-implementacao-backend.md` (em especial: `GET /me/memberships`,
`GET /customers/:id/balances`, `POST /customers/:id/payments`). Se algum endpoint não
existir ainda ou tiver formato diferente do descrito, sinalizar antes de prosseguir —
não inventar contrato.

Premissa central de UX: **tudo no app é relativo a uma Company + Store ativa.** Quase
nenhuma tela deve fazer request sem esse contexto resolvido.

---

## Fase 0 — Fundamentos
1. Client de API com interceptor que injeta o JWT e o `x-company-id`/`storeId` ativo em
   toda request (conforme exigido pelos guards do backend).
2. Estado global de sessão: usuário logado, lista de `memberships` (retorno de
   `GET /me/memberships`), `companyId`/`storeId` ativos.
3. Persistência da seleção de company/store ativa (localStorage), restaurada no boot do
   app — evitar forçar o usuário a reescolher a cada refresh.

**Critério de conclusão:** qualquer request autenticada sai com os headers corretos sem
que a tela precise saber disso manualmente.

---

## Fase 1 — Autenticação e seleção de contexto
1. Tela de login.
2. Pós-login: buscar `GET /me/memberships`.
   - Se o usuário tem 1 company e 1 store só → seleciona automaticamente, pula direto
     pro dashboard.
   - Se tem mais de uma company → tela de seleção de empresa.
   - Depois de escolher a company, se tem mais de uma loja nela → seletor de loja
     (mostrando o `role` de cada uma, já que pode ser diferente por loja).
3. Componente de troca de contexto (header/sidebar) sempre visível para trocar de
   loja/empresa sem precisar deslogar.

**Critério de conclusão:** um usuário com acesso a 2 lojas com roles diferentes consegue
alternar entre elas e a UI reflete o role correto em cada uma.

---

## Fase 2 — Autorização na UI
1. Hook `useCurrentRole()` — lê o role da store ativa a partir do estado de memberships
   (Fase 0), sem request adicional.
2. Componente `<RequireRole roles={[...]}>` — esconde ou desabilita ações/botões fora do
   escopo do role atual (ex: só `OWNER`/`ADMIN` vê "Configurações da Empresa").
3. Guard de rota equivalente para páginas inteiras (ex: `/admin/*` só acessível a
   `OWNER`/`ADMIN`).

**Nota:** isso é proteção de UX, não de segurança — a validação real continua sendo
feita pelo backend (Fase 2 do plano de backend). Não remover chamadas de erro 403 do
tratamento de request só porque a UI já esconde o botão.

---

## Fase 3 — Área administrativa (Company / Stores / Membros)
1. Configurações da empresa (dados da `Company`).
2. CRUD de lojas (`Store`).
3. Tela de membros/equipe:
   - Convidar por e-mail.
   - Tabela por membro: loja x role (permitir atribuir/alterar role por loja
     individualmente, não um role único pro membro inteiro).
   - Revogar acesso a uma loja específica sem remover o membro da empresa.

---

## Fase 4 — Catálogo de Produtos
1. Listagem de produtos da **loja ativa** (dados vêm de `StoreProduct`, já com nome/code
   do `Product` via join do backend).
2. Fluxo de criação/edição de produto:
   - Campo/toggle: **"Este produto também é vendido em outras lojas da empresa?"**
     - Se **sim**: mostrar checklist das outras lojas da company (via memberships/lista
       de stores). Pré-preencher `costPrice` igual ao informado na loja atual em todas
       as marcadas (editável antes de salvar). `price` é obrigatório e independente por
       loja selecionada.
     - Se **não**: cria só na loja atual, sem tocar em outras.
   - Enviar `storeIds` no payload de criação do produto, conforme contrato do backend
     (Fase 4 do plano de backend).
3. Edição de `StoreProduct` isolada (preço/custo/estoque/ativo) a partir da loja ativa —
   deixar claro na UI que essa edição **não** afeta outras lojas que vendem o mesmo
   produto.
4. Telas equivalentes para `BottleType`/`StoreBottleType` (mesmo padrão, mais simples).

**Critério de conclusão:** criar um produto marcando 2 lojas gera as duas ofertas sem
recadastro manual; editar preço numa loja não altera visualmente a outra ao navegar até
lá.

---

## Fase 5 — PDV (Ponto de Venda)
1. Busca de produto (por código/nome) restrita à loja ativa.
2. Carrinho com cálculo de total/desconto.
3. Seleção de forma de pagamento, incluindo `CREDIT_STORE` (fiado) — nesse caso exige
   selecionar ou cadastrar um `Customer` antes de concluir a venda.
4. Fluxo de caixa: abrir caixa antes de vender (bloquear PDV se não houver
   `CashRegister` `OPEN` na loja ativa), fechar caixa com conferência de saldo.
5. Comandas: abrir, adicionar itens, fechar/converter em venda — seguir a decisão do
   backend sobre timing de decremento de estoque (Fase 6 do plano de backend) para
   feedback visual correto (ex: se decrementa ao adicionar item, mostrar estoque já
   atualizado na tela de catálogo imediatamente).

---

## Fase 6 — Clientes e Fiado
1. Listagem/busca de clientes (nível empresa).
2. Página de detalhe do cliente:
   - Card com saldo **total** consolidado.
   - Tabela com saldo **por loja** (`GET /customers/:id/balances`).
   - Histórico de pagamentos e vendas fiado.
3. Fluxo de pagamento com **abatimento cruzado**:
   - Formulário: valor pago, loja onde está sendo pago, e um modo "automático" (deixa o
     backend decidir a alocação, conforme regra padrão do plano de backend) vs. modo
     "manual" (mostra a lista de dívidas por loja e permite distribuir o valor entre
     elas, validando em tempo real que a soma bate com o total antes de habilitar o
     botão de confirmar).
4. Saldo de vasilhame por cliente, mesmo padrão (por loja + ação de devolução).

**Critério de conclusão:** dá pra pagar a dívida da Loja A estando com a Loja B ativa,
tanto no modo automático quanto no manual, e o card de saldo total atualiza
corretamente após o pagamento.

---

## Fase 7 — Dashboards
1. Dashboard do dono/gerente: vendas por loja, resumo de caixa, fiado total consolidado
   (usar o mesmo endpoint de saldo, mas agregando todos os clientes — confirmar se o
   backend expõe um endpoint agregado ou se o dashboard soma no frontend a partir de uma
   listagem paginada; se for a segunda opção, sinalizar como possível gargalo de
   performance em bases grandes).
2. Filtros por loja e por período.

---

## Fase 8 — Polish
1. Estados de loading/erro consistentes, especialmente em fluxos transacionais (venda
   com estoque insuficiente, alocação de pagamento inválida) — mensagens claras vindas
   do erro do backend, não genéricas.
2. Layout adaptado pra uso em tablet no PDV (tela de venda é a mais usada no dia a dia).

**Reportar ao final:** qualquer endpoint assumido neste plano que não bateu com o que o
backend realmente expõe, e decisões de UX tomadas nos pontos em aberto.