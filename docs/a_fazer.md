# A fazer

Lista de pendências do sistema (sem contar o gateway de pagamento com o Asaas, que tem plano
próprio). Criada em 2026-10-21. O roteiro de testes manuais fica em [testes.md](testes.md).

## O que falta no sistema

### Antes de ter clientes de verdade

1. [x] **Esconder o custo do atendente na API.** `GET /stores/:storeId/sales` devolve custo e
   lucro para qualquer papel. A tela esconde, mas quem abrir o navegador vê. Correção pequena,
   só no backend. **Feito (2026-10-21):** o vazamento era maior (produtos, estoque, comandas e o
   retorno da venda também). Um interceptor global (`HideCostInterceptor`) tira custo e lucro de
   toda resposta para o atendente.
2. [ ] **Deploy:** imagem Docker do frontend, pipeline com `prisma migrate deploy` e HTTPS.
3. [x] **E-mail de verdade.** **Feito (2026-10-30):** conta Gmail do sistema com senha de app no
   `backend/.env`; templates novos com a cara do sistema (`src/mail/templates.ts`) e o script
   `npm run mail:test` (os três e-mails chegaram). Para produção, trocar por domínio próprio com
   serviço transacional (o Gmail gratuito limita ~500 envios por dia e cai mais no spam).
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

16. [x] **Caixa sem depender de abrir e fechar à mão** (pedido do usuário, 2026-10-26: ele abriu
    um caixa em 16/10 e só fechou em 26/10, por esquecimento). **Decidido pelo usuário:**
    1. **Abertura automática:** a primeira operação com dinheiro (venda, fechamento de comanda,
       recebimento de fiado, entrada/sangria, cancelamento) abre o caixa sozinha, com o troco
       inicial igual ao saldo do último fechamento. O PDV não bloqueia mais por "caixa fechado".
    2. **Fechamento automático diário:** o caixa esquecido aberto fecha sozinho no horário da
       loja, **padrão meia-noite**, que o **dono pode mudar** (coluna nova
       `tb_stores.cashAutoCloseTime`). O caixa fica marcado "fechado automaticamente" (coluna nova
       `tb_cash_registers.autoClosed`).
    3. Conferência depois (valor contado e diferença): **fica para depois**.
    4. Opção de loja sem controle de caixa: o usuário acha que **não será necessária** com 1 e 2.
    **Feito (2026-10-26): 1 e 2.** `ensureOpenCash` antes de cada operação com dinheiro, job
    `cash-auto-close` a cada 5 minutos, horário em Lojas › Editar e marca "automático" em Caixas
    anteriores. O item 3 (conferência) continua pendente.

17. [x] **Ajustes pedidos em 2026-10-26.** **Feito:**
    - **Preço de venda padrão** no Novo produto (como o custo padrão): vale para as lojas marcadas
      que ficarem sem preço próprio.
    - **Reativar produto** pela tela: Produtos › "Mostrar só os excluídos" › Reativar. Volta com as
      ofertas das lojas (preço e estoque de antes).
    - **Fiado no painel.** **Decidido pelo usuário:** separar sem esconder. Faturamento e lucro
      continuam contando o vendido no fiado, mas cada cartão mostra quanto foi no fiado, e há o
      cartão "Fiado recebido" (pagamentos do período). Cancelar a venda já a tira das contas.
    - **Campos de dinheiro com formatação automática** (todos, inclusive receber fiado): o ponto de
      milhar aparece sozinho, "." do teclado numérico vira vírgula, no máximo 2 casas.
    - **Autorização do gerente no balcão.** **Decidido pelo usuário:** venda fiada acima do limite
      feita pelo atendente passa com o e-mail e a senha de um gerente ou dono da loja digitados na
      própria tela, sem salvar as credenciais. **Aprovado pelo usuário:** coluna nova
      `tb_sales.creditApprovedById` registra quem autorizou; o detalhe da venda mostra "Acima do
      limite, autorizado por ...".

### Operação da plataforma

22. [x] **Mais planos e troca de plano pelo dono** (pedido do usuário, 2026-10-30: "não faria
    sentido só o superadmin poder mudar o plano"). **Decidido pelo usuário:**
    - Planos: **Trial** R$ 0 (só para o período de teste: não dá para voltar a ele), **Essencial**
      R$ 99 (1 loja), **Básico** R$ 179 (até 3 lojas), **Profissional** R$ 349 (até 10 lojas por
      empresa, até 3 empresas) e **Rede** R$ 599 (até 50 lojas por empresa, até 10 empresas).
      **Nenhum plano ilimitado** (decidido pelo usuário: arriscado demais); acima disso, ajuste
      manual na plataforma.
    - O dono (responsável pela assinatura) faz upgrade e downgrade sozinho e a mudança **vale na
      hora**; o valor novo vale na próxima cobrança (quando o Asaas existir). Downgrade que não cabe
      é recusado.
    **Feito (2026-10-30):** Assinatura › Planos (cartões com preço e limites; o que não cabe fica
    apagado com o motivo), rota `PATCH /organizations/:id/plan` (liberada em somente leitura) e o
    seed com os cinco planos (`npm run db:seed` atualiza um banco que já tem o seed; o antigo "Pro"
    virou "Rede"). Sem mudança no banco.

18. [ ] **Pensar como seria a role de suporte**, para as pessoas que trabalham no suporte da
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

19. [x] **Ver e reativar excluídos pela tela.** "Cliente" aqui era o **cliente da distribuidora**
    (`tb_customers`, quem compra no fiado): excluído sumia da lista e só voltava pela API. Os dados
    nunca se perdem (soft delete). **Pedido do usuário (2026-10-30):** tela para ver os dados
    excluídos **nos dois casos**: o cliente da distribuidora e o cliente do SaaS (o dono, na área
    `/plataforma`). **Feito (2026-10-30), sem mudar o banco:**
    1. **Clientes** (gerente e dono): "Mostrar só os excluídos" em Clientes e fiado, com telefone,
       endereço, data da exclusão, histórico e Reativar (`GET /customers?deleted=true`).
    2. **Lojas** (dono): "Mostrar as lojas excluídas" em Lojas, com Reativar
       (`GET /stores/deleted`, `POST /stores/:id/restore`); vale o limite de lojas do plano, e os
       donos atuais ganham acesso à loja reativada. **Equipe** (dono): "Mostrar quem foi removido"
       em Equipe, com as lojas e papéis que a pessoa tinha ao sair; Reativar devolve exatamente
       esses acessos (`GET /members/removed`, `POST /members/:membershipId/restore`).
    3. **Plataforma:** o detalhe da organização mostra as lojas excluídas (com a data) e a lista
       Pessoas (quem tem acesso, quem foi removido e contas desativadas); em Planos, "Mostrar os
       planos excluídos" com Reativar (`GET /platform/plans/deleted`,
       `POST /platform/plans/:id/restore`). Organização, empresa e usuário continuam **sem
       exclusão** (não há o que reativar); o usuário só é desativado/ativado em Usuários.
    Tipo de vasilhame continua voltando só pelo aviso ao recriar com o mesmo nome.
20. [ ] O motivo do ajuste de inventário vai só para o log do servidor; não fica gravado.

21. [ ] adicionar mais emails
21. [ ] revisar termos de uso
