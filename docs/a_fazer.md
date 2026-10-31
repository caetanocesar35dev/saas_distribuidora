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
26. [ ] **Tela inicial de apresentação do sistema (landing page)** (pedido do usuário, 2026-10-30).
    Hoje `/` só redireciona (sem sessão vai para o login), então quem chega pelo anúncio, pela
    indicação ou pelo Google não vê o que o sistema faz. A ideia é uma página pública em `/`, com
    "Entrar" e "Teste grátis" no topo (quem já está logado continua indo direto para a loja):
    - **Para quem é e o que resolve** em uma frase (distribuidoras e depósitos de bebidas).
    - **Diferenciais** contra os PDVs baratos (ver a pesquisa de concorrentes de 2026-10-30):
      vasilhame por cliente, fiado por loja com limite de crédito, várias lojas e empresas com
      gerente geral e painel único, histórico de quem mudou o quê (contra desvio), caixa que abre
      e fecha sozinho, venda em fardo.
    - **Planos e preços** (lidos de `GET /plans`, sem o Trial) e "14 dias grátis, sem cartão".
    - **Como funciona** em 3 passos, imagens ou um vídeo curto do PDV, e perguntas frequentes.
    - **Indicação:** o link `/cadastro?ref=` continua indo direto para o cadastro; a página pode
      citar o "Indique e ganhe".
    - Botão do **WhatsApp do suporte** e os links de Termos e Privacidade no rodapé.
    - Boa no celular, rápida e pensada para o Google (título, descrição, "sistema para
      distribuidora de bebidas", "controle de vasilhame"). Decidir antes com o usuário: nome e
      marca do produto, textos, imagens e se usa domínio próprio separado do sistema.
27. [ ] **Assinatura mensal, semestral ou anual** (pedido do usuário, 2026-10-30). O dono escolhe o
    ciclo de pagamento, e quanto mais longo, **maior o desconto em relação à mensal**; a tela mostra
    a economia (ex.: "Anual: R$ 990, economize R$ 198, equivale a 2 meses grátis"). Bom para o
    caixa do negócio e reduz cancelamento. Depende do **Asaas (Fase 10)**, que cobra cada ciclo. A
    decidir com o usuário:
    - **Descontos** de cada ciclo (sugestão: semestral 10%, anual ~17%, equivalente a 2 meses
      grátis) e se valem para todos os planos.
    - **Forma de pagamento** do semestral e do anual: à vista (Pix ou cartão) ou parcelado no
      cartão.
    - **Trocar de plano no meio do ciclo:** upgrade cobra a diferença proporcional na hora?
      Downgrade vale só na renovação? E **cancelar** no meio: devolve a parte não usada ou só não
      renova (o mais comum)?
    - **Como somar com o desconto de indicação** (item 23): os meses de desconto viram desconto
      no valor do ciclo ou só valem para quem paga mensal?
    - **Banco:** o ciclo escolhido e a data da próxima renovação na organização (e talvez o preço
      de cada ciclo no plano): mudança de schema, exige aprovação.
    - **Telas:** Assinatura › Planos com a escolha do ciclo, a vitrine do cadastro, a página de
      apresentação (item 26) e a plataforma (Plataforma › Planos com o desconto de cada ciclo).

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

25. [ ] **Vender além de bebidas** (pedido do usuário, 2026-10-30: distribuidoras também vendem
    cigarro, salgadinho, gelo, carvão, descartáveis etc.). Hoje o cadastro já aceita esses produtos
    (vasilhame é opcional e o "fardo" serve para qualquer embalagem com várias unidades), mas tudo
    foi pensado para bebida. A decidir com o usuário antes de implementar:
    - **Categorias de produto** (Bebidas, Cigarros, Salgadinhos, Mercearia, Gelo/Carvão...): filtro
      no PDV, no Estoque e em Produtos, e faturamento e lucro por categoria no painel. Precisa de
      tabela ou coluna nova (aprovação do schema).
    - **Nome da embalagem por produto**: hoje a tela diz sempre "fardo"; cigarro vende em **maço** e
      **pacote** (10 maços), salgadinho em **caixa** ou **display**. Um campo "nome da embalagem"
      (fardo, caixa, pacote, display, engradado) muda só o texto, sem mexer na conta.
    - **Venda por peso ou fração** (gelo em kg, carvão, produtos a granel): hoje a quantidade é
      inteira. Exige aceitar quantidade decimal em estoque e venda: mudança grande, só se pedirem.
    - **Validade e lote** (salgadinho e alimentos vencem): alerta de produtos perto do vencimento.
      Mudança média; avaliar com os primeiros clientes.
    - **Venda proibida para menores** (bebida alcoólica e cigarro): um aviso opcional no PDV
      ("confirme a idade do cliente") nos produtos marcados como restritos. Simples.
    - **Nota fiscal** (item 12) fica mais importante: cigarro e alimentos têm tributação própria
      (NCM, substituição tributária), então o cadastro fiscal do produto entra junto com a NFC-e.
    - Revisar os textos que dizem "bebidas" (cadastro, Termos, Central de Dúvidas, e-mails) para
      falar em "distribuidora" de forma geral.

### Operação da plataforma

22. [x] **Mais planos e troca de plano pelo dono** (pedido do usuário, 2026-10-30: "não faria
    sentido só o superadmin poder mudar o plano"). **Decidido pelo usuário:**
    - Planos: **Trial** R$ 0 (só para o período de teste: não dá para voltar a ele), **Essencial**
      R$ 99 (1 loja), **Básico** R$ 179 (até 3 lojas), **Profissional** R$ 349 (até 10 lojas por
      empresa, até 3 empresas) e **Rede** R$ 599 (até 50 lojas por empresa, até 5 empresas).
      **Nenhum plano ilimitado** (decidido pelo usuário: arriscado demais); acima disso, ajuste
      manual na plataforma.
    - **Contra dividir a conta entre comerciantes** (decidido pelo usuário): o Rede caiu de 10 para
      5 empresas (preço ÷ empresas ≥ R$ 99, o preço do Essencial) e os Termos de Uso (versão
      2026-10-30) proíbem dividir a assinatura entre titulares sem relação societária.
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

23. [x] **Descontos e indicação (marketing)** (pedido do usuário, 2026-10-30). **Decidido pelo
    usuário:**
    - Dois jeitos de indicar: **dono de distribuidora** indica outro (os dois ganham desconto) e
      **representante** (não usa o sistema) indica um potencial cliente e recebe dinheiro por Pix,
      pago à mão pela plataforma.
    - Desconto **percentual** (20% por 2 meses depois do trial), **acumula** (até 12 meses); quem
      é indicado por representante também ganha. A comissão do representante é **proporcional ao
      plano** que o indicado assinar (para incentivar planos maiores).
    - **Desconto de quem indicou e comissão só valem quando o indicado paga a 1ª mensalidade.**
    - Código único por pessoa, informado só no cadastro (o link `/cadastro?ref=` já preenche).
    **Feito (2026-10-30):** tela "Indique e ganhe" (menu do usuário), selo de desconto ao lado do
    sino, Plataforma › Indicações (painel e lista) e › Representantes, tabelas novas (migration
    `20261030000000_referrals`). Enquanto o Asaas não existe, "pagou" = a plataforma pôr a
    assinatura em Ativa. **Falta (com a Fase 10, Asaas):** o webhook do pagamento confirmar a
    indicação e a cobrança aplicar o desconto no valor (avançando os meses usados). Cupons avulsos
    de campanha não foram pedidos.

24. [x] **Gerente geral** (pedido do usuário, 2026-10-30: dar gerente loja por loja não mostra o
    painel da empresa). **Decidido pelo usuário:** papel da empresa, só o dono nomeia; gerente em
    todas as lojas (também as novas), com painel da empresa, equipe (convida, muda papéis e remove
    atendentes e gerentes, sem mexer em donos nem dar o papel de dono) e edição de lojas; sem dados
    da empresa, assinatura, criar/excluir loja nem removidos. **Feito (2026-10-30):** migration
    `20261030010000_general_manager` (`Membership.isGeneralManager`), botão "Tornar gerente geral"
    na Equipe e as telas da empresa liberadas para ele.

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

21. [x] adicionar mais emails. **Feito (2026-10-30):** além de redefinir senha, convite e lembrete
    do teste/carência, o sistema manda **boas-vindas** no cadastro (fim do teste e primeiros
    passos), **senha alterada** (troca, redefinição e primeira senha do convite: aviso de
    segurança), **teste terminou** e **carência terminou** (no dia seguinte, avisando o modo
    somente leitura) e **indicação confirmada** (para quem indicou, com os meses de desconto).
    `npm run mail:test -- seu@email.com` envia todos de exemplo.
    **Falta, com o Asaas (Fase 10):**
    - **Pagamento confirmado / recibo** (valor, plano, período, link da fatura).
    - **Pagamento falhou ou venceu** (cartão recusado, Pix não pago), com o link para pagar.
    - **Plano alterado** (plano novo, valor e a partir de quando vale).
    - **Assinatura cancelada** (o que continua liberado e como voltar).
    - O "teste terminou" e o "carência terminou" passam a levar o botão direto para pagar.
    **Talvez depois:** resumo semanal para o dono (faturamento, fiado em aberto, estoque baixo),
    só se os primeiros clientes quiserem.
21. [ ] revisar termos de uso
21. [ ] adicionar whatsapp e instagram
