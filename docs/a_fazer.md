# A fazer

Lista de pendências do sistema (sem contar o gateway de pagamento com o Asaas, que tem plano
próprio) e roteiro de testes manuais. Criada em 2026-10-21.

## O que falta no sistema

### Antes de ter clientes de verdade

1. [x] **Esconder o custo do atendente na API.** `GET /stores/:storeId/sales` devolve custo e
   lucro para qualquer papel. A tela esconde, mas quem abrir o navegador vê. Correção pequena,
   só no backend. **Feito (2026-10-21):** o vazamento era maior (produtos, estoque, comandas e o
   retorno da venda também). Um interceptor global (`HideCostInterceptor`) tira custo e lucro de
   toda resposta para o atendente.
2. [ ] **Deploy:** imagem Docker do frontend, pipeline com `prisma migrate deploy` e HTTPS.
3. [ ] **E-mail de verdade.** Sem `EMAIL_USER` e `EMAIL_PASS` no `backend/.env`, os e-mails de
   "esqueci a senha" e de convite não são enviados; o link só aparece no log do backend.
4. [ ] **Registro de erros em produção** (ex.: Sentry), para saber quando algo quebra na loja do
   cliente.
5. [x] **LGPD:** termos de uso e política de privacidade no cadastro, porque o sistema guarda
   nome e telefone de clientes. **Decidido pelo usuário (2026-10-21):** caixa obrigatória no
   cadastro, e o backend grava data e versão do aceite em `tb_users` (`termsAcceptedAt`,
   `termsVersion`). **Feito (2026-10-21):** páginas públicas `/termos` e `/privacidade`.
   - [ ] **Falta você:** preencher os dados do operador no `frontend/.env.local` (e no ambiente de
     produção): `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_CNPJ`, `LEGAL_CONTACT_EMAIL` e
     `LEGAL_FORUM` (modelo em `frontend/.env.example`), e pedir a revisão de um advogado. Os
     textos (`frontend/src/content/legal.ts`) são um modelo.

### Para o dia a dia das distribuidoras

7. [x] **Limite de crédito por cliente no fiado:** aviso ou bloqueio acima de um valor. É o
   próximo passo do aviso de fiado em aberto. Precisa de coluna nova no banco (exige aprovação).
   **Decidido pelo usuário (2026-10-21):** só gerente e dono definem o limite; é um limite por
   cliente (`tb_customers.creditLimit`, vazio = sem limite), comparado com a **dívida total na
   empresa** (soma de todas as lojas); acima dele, o **atendente é bloqueado** e gerente/dono
   veem o aviso e podem confirmar a venda. O backend confere. **Feito (2026-10-21):** campo no
   cadastro do cliente, cartão "Limite de crédito" no detalhe e aviso no PDV e na comanda.
8. [ ] **Comprovante imprimível ou por WhatsApp** da venda, do pagamento de fiado e do fechamento
   de caixa (não fiscal).
9. [ ] **Relatórios com exportação** (CSV/Excel): vendas por período e por produto, produtos mais
   vendidos e lista de devedores.
10. [ ] **Transferência de estoque entre lojas.** Hoje só dá para fazer como saída numa loja e
    entrada na outra.
11. [ ] **Cobrança de fiado:** botão para mandar mensagem no WhatsApp com o valor devido, a partir
    da lista de devedores.
12. [ ] **Nota fiscal (NFC-e/NF-e).** Decisão de produto grande: muitas distribuidoras são
    obrigadas a emitir, e isso exige integrar com um emissor.
13. [x] **vendas antigas** tela para lancar vendar antigas, caso a conexao da internet da loja tenha caido anteriormente ou algo do tipo.
    **Decidido pelo usuário (2026-10-23):** só **gerente e dono** lançam; a venda à vista entra
    no **caixa aberto agora** (fiado só mexe na dívida); coluna nova `tb_sales.registeredAt`
    (quando foi lançada; a data da venda continua em `createdAt`); **sem limite** de dias para
    trás (só não pode data futura). **Feito (2026-10-23):** item "Lançar venda antiga" do menu, abaixo de Histórico de vendas (o PDV com
    o campo de data e hora); a venda fica marcada "lançada depois" na lista e no detalhe.
14. [x] **Vender em lote (fardo, caixa, engradado)** (pedido do usuário, 2026-10-23). Hoje o PDV
    (e a comanda e a venda antiga) só vende por **unidade**: para vender dois fardos de cerveja,
    o operador precisa fazer a conta e digitar 24 unidades. Ponto de partida: o produto já tem
    `packQuantity` (unidades por fardo, ex.: 12), mas ele não é usado na venda. A pensar:
    - Na tela: botão ou seletor "unidade / fardo" no item do carrinho, convertendo para unidades
      (2 fardos × 12 = 24), mostrando "2 fardos (24 un.)".
    - Preço do fardo: o mesmo da unidade × quantidade ou um **preço próprio do fardo** (desconto
      no atacado)? Preço próprio exige coluna nova por loja (aprovação de schema).
    - Vasilhame: hoje sai 1 vasilhame por unidade vendida com vasilhame; conferir se no fardo a
      regra continua (ex.: fardo de long neck não tem vasilhame, engradado de litrão tem 12).
    - Estoque continua em unidades; o comprovante e o histórico mostram fardos e unidades.
    **Decidido pelo usuário (2026-10-23):** preço do fardo = **preço da unidade × unidades do
    fardo** (sem preço próprio; desconto de atacado pelo campo Desconto); a venda **guarda os
    fardos** no item (colunas novas em `tb_sale_items` e `tb_command_items`), para o detalhe e
    o histórico mostrarem "2 fardos (24 un.)". Estoque continua em unidades. **Feito (2026-10-23):**
    botão "+ fardo" na busca de produtos (PDV, comanda e venda antiga), contadores Fardos e
    Unidades no carrinho, e o detalhe da venda e a comanda mostram "1 fardo de 12 + 3 un.". O
    botão só aparece em produto com "Unidades por fardo" maior que 1.

15. [x] **Cadastro mais completo sem formulário maior** (pedido do usuário, 2026-10-26).
    **Decidido pelo usuário:** (1) pedir o **celular (WhatsApp) do dono** no cadastro,
    obrigatório, com coluna nova `tb_users.phone` (aprovada); (2) **não** perguntar endereço da
    loja: preencher a primeira loja com o endereço e o telefone que a consulta pública do CNPJ já
    devolve; (3) **sem** caixa "usar o mesmo CNPJ" (loja sem CNPJ já usa o da empresa); (4)
    "Primeiros passos" no Início para o dono: confirmar o endereço da loja, cadastrar produtos,
    abrir o caixa e convidar a equipe. **Feito (2026-10-26):** celular no cadastro e em Minha
    conta; primeira loja com o endereço da consulta do CNPJ (mostrado no cadastro); quadro
    "Primeiros passos" no Início do dono (rota `GET /stores/:storeId/onboarding`), com Esconder.

### Operação da plataforma

16. [ ] **Pensar como seria a role de suporte**, para as pessoas que trabalham no suporte da
    empresa (pedido do usuário, 2026-10-21). Ponto de partida: já existe `platformRole =
    SUPPORT`, mas hoje ele só **consulta** a área `/plataforma` (organizações, planos, usuários e
    notificações); quem altera é o `SUPERADMIN`. Perguntas a responder:
    - O suporte precisa ver os dados de dentro de uma distribuidora (vendas, caixa, clientes)
      para ajudar? Hoje não vê: o acesso a lojas é só por vínculo de dono/gerente/atendente.
    - Se vir, é somente leitura? Precisa de autorização do dono antes (LGPD: os clientes da
      distribuidora são dados dela)? Fica registrado quem do suporte acessou o quê e quando?
    - O suporte pode fazer ações pelo cliente (reenviar convite, destravar conta, ajustar a
      assinatura) ou isso continua só com o `SUPERADMIN`?
    - Mudar isso mexe em permissões (`TenantGuard`) e talvez no banco: exige aprovação.

### Lacunas menores já conhecidas

13. [ ] Cliente excluído não pode ser reativado pela tela; só pela API.
14. [ ] O motivo do ajuste de inventário vai só para o log do servidor; não fica gravado.


## Testes manuais

Logins do seed (`npm run db:seed` em `backend/`), todos com a senha `123456`:
`dono@exemplo.com`, `gerente@exemplo.com`, `funcionario@exemplo.com` e `admin@plataforma.com`.
Em desenvolvimento, os links de e-mail (redefinir senha, convite) aparecem no log do backend.

### 1. Cadastro e acesso

- [x] Criar conta em `/cadastro` com o CNPJ `05.648.257/0001-78`: razão social e nome fantasia
  devem ser preenchidos sozinhos.
- [x] Digitar um CNPJ com letras (ex.: `12.ABC.345/01DE-35`): é aceito, e aparece o aviso de que
  não foi encontrado.
- [x] Digitar um CNPJ inválido: aparece "CNPJ inválido.".
- [x] O celular é obrigatório no cadastro (com máscara e DDD). Depois de cadastrar com um CNPJ real,
  conferir em Lojas que a primeira loja veio com endereço e telefone, e no Início o quadro
  "Primeiros passos" (cada item marca sozinho; Esconder some com ele).
- [x] Digitar números ou símbolos no campo "Seu nome" (cadastro, Minha conta e convite de equipe):
  eles não entram no campo; colar "Maria 123" deixa só "Maria". Acentos, apóstrofo e hífen
  (ex.: João D'Ávila-Neto) passam.
- [x] Tentar criar a conta sem marcar "Li e aceito": deve ser recusado. Abrir os links dos
  termos e da política (abrem sem login, em `/termos` e `/privacidade`).
- [x] Entrar, sair, e usar "Sair de todos os aparelhos" em Minha conta.
- [x] Nos campos de senha (login, cadastro, redefinição e Minha conta), o olho mostra e esconde o
  que foi digitado.
- [ ] Deixar a aba parada por mais de 15 minutos e continuar usando: não pode pedir login de novo.
- [ ] "Esqueci a senha": pegar o link no log do backend e redefinir a senha.
- [ ] Errar a senha 6 vezes seguidas: aparece a mensagem de muitas tentativas.

### 2. Dono (`dono@exemplo.com`)

- [x] Trocar de loja e de empresa pelo topo da tela.
- [x] Criar uma loja informando um CNPJ real: endereço e telefone devem ser preenchidos.
- [x] Em Nova loja, tentar salvar sem endereço: CEP, rua, número, bairro, cidade e UF são
  obrigatórios (complemento, telefone e CNPJ não).
- [x] Em Nova loja, conferir as máscaras (telefone, CEP, UF) e os limites: telefone sem DDD ou CEP
  com menos de 8 números é recusado; números na UF não entram.
- [ ] Convidar um funcionário (o link aparece no log do backend), mudar o papel dele por loja e
  revogar o acesso.
- [x] Editar os dados da empresa; o CNPJ deve estar bloqueado.
- [x] Ver o painel da empresa e o gráfico de 7 dias.

### 3. PDV

- [x] Vender buscando o produto pelo nome e pelo leitor de código de barras, se houver um.
- [x] Usar os atalhos F2 (buscar) e F9 (finalizar).
- [x] Vender em lote: tocar em "+ fardo" no rodapé do cartão de um produto com fardo cadastrado, juntar
  unidades avulsas no carrinho (ex.: 2 fardos + 3 un.) e conferir o subtotal e, no detalhe da
  venda, "2 fardos de 12 + 3 un.". O estoque baixa em unidades. Na comanda, "+ fardo" lança o
  fardo inteiro.
- [x] Pagar em dinheiro e conferir o troco; dar desconto e tentar um desconto maior que o total.
- [ ] Vender produto com vasilhame: na troca 1 por 1 não pede cliente; se o cliente sai devendo,
  exige cliente.
- [x] Fiado para um cliente sem dívida: vende direto, sem aviso.
- [x] Fiado para um cliente que já deve: aparece o aviso com valor, número de vendas e data da
  mais antiga. "Não, voltar" não vende; "Sim, vender no fiado" vende.
- [x] Tentar vender com estoque insuficiente e com o caixa fechado.

### 4. Caixa

- [ ] Abrir o caixa, lançar entrada e sangria, e fechar conferindo o resumo por forma de
  pagamento.
- [ ] Ver o histórico de caixas.

### 5. Comandas

- [ ] Abrir, lançar itens (o estoque baixa na hora), remover item e fechar no fiado (o aviso deve
  aparecer).
- [ ] Cancelar uma comanda: o estoque volta.

### 6. Vendas

- [ ] Filtrar por período e forma de pagamento e abrir o detalhe.
- [ ] Cancelar uma venda em dinheiro (sai do caixa) e uma fiada (sai da dívida).
- [ ] Ver o histórico de alterações da venda.
- [ ] Como gerente ou dono, no menu "Lançar venda antiga" (abaixo de Histórico de vendas), lançar uma venda de ontem: ela
  aparece no filtro de ontem com a marca "lançada depois", o estoque baixa e o dinheiro entra no
  caixa aberto agora (veja o resumo do caixa). Uma data no futuro é recusada.
- [ ] Como atendente: o botão "Lançar venda antiga" não aparece e a URL mostra "sem permissão".

### 7. Clientes e fiado

- [ ] Ver a lista com as colunas "Dívida nesta loja", "Outras lojas" e "Dívida total".
- [ ] Marcar o filtro "Só quem deve no fiado".
- [ ] Cadastrar um cliente com endereço: digitar um CEP real (ex.: 50030-230) e ver rua, bairro,
  cidade e UF preencherem sozinhos; completar número e complemento; conferir o endereço no
  detalhe do cliente. Cadastrar outro sem endereço (é opcional) e testar um CEP inexistente.
- [ ] Receber um pagamento automático e um manual (escolhendo por loja).
- [ ] Pagar na Loja B a dívida da Loja A.
- [ ] Tentar receber mais do que o cliente deve.
- [ ] Emprestar vasilhame; devolver na mesma loja (funciona) e em outra loja (recusado).
- [ ] Tentar excluir um cliente que deve: deve ser recusado.
- [ ] Como gerente ou dono, definir um limite de crédito no cliente (Editar) e ver o cartão
  "Limite de crédito" com o valor disponível.
- [ ] Vender no fiado passando do limite: o atendente é barrado ("Entendi"); gerente e dono veem
  o aviso e conseguem vender em "Sim, vender acima do limite".
- [ ] Como atendente, abrir Editar do cliente: o campo de limite não aparece.

### 8. Estoque, produtos e vasilhames (gerente ou dono)

- [ ] Dar entrada e ajuste de estoque e alterar preço.
- [ ] Criar produto em várias lojas e tentar criar com um código repetido.
- [ ] Excluir um produto e reativar.
- [ ] Criar tipos de vasilhame e lançar movimentações com o fornecedor.

### 9. Permissões (entrar com cada papel)

- [ ] Atendente (`funcionario@exemplo.com`): não vê Produtos, custo, lucro, sangria, painel da
  empresa nem "Dívida total".
- [ ] Logado como atendente, abrir no navegador `/api/stores/<id da loja>/sales`: a resposta
  não pode ter `costPrice`, `totalCost` nem `totalProfit`.
- [ ] Gerente (`gerente@exemplo.com`): vê produtos e sangria, mas não a empresa.
- [ ] Digitar na URL uma página proibida para o papel: deve aparecer "sem permissão".

### 10. Assinatura e plataforma (`admin@plataforma.com`)

- [ ] Em `/plataforma`, deixar a organização como "vencida" e entrar como dono: aparece a faixa de
  somente leitura, os botões ficam apagados e fechar o caixa continua liberado.
- [ ] Voltar a organização para "ativa": o acesso completo volta sozinho, sem recarregar a página.
- [ ] Criar uma notificação e ver se ela aparece no sino.

### 11. Geral

- [ ] Usar no celular e no tablet, principalmente o PDV.
- [ ] Botão "?" de várias telas: cada um abre o artigo certo da Central de Dúvidas.
- [ ] Modo escuro, se você usa.
