import type { Article } from "./types";

export const vendas: Article[] = [
  {
    id: "vendas-vender",
    category: "vendas",
    title: "Fazer uma venda no PDV",
    purpose: "Registrar uma venda: escolher os produtos, dar desconto e receber o pagamento.",
    where: "Menu › Vender (PDV)",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Confira se o caixa está aberto (Menu › Caixa). Sem caixa aberto o PDV não vende.",
      "Abra Menu › Vender (PDV). O cursor já fica na busca (tecla F2 volta para ela).",
      "Passe o leitor de código de barras ou digite o nome. Tocar no produto também adiciona. Cada toque soma 1 unidade; ajuste a quantidade no carrinho.",
      "Clique em Finalizar venda (ou tecla F9).",
      "Escolha a forma de pagamento. Se quiser, digite um desconto. No dinheiro, digite o valor recebido para ver o troco.",
      "Clique em Concluir. A venda aparece em Menu › Vendas.",
    ],
    problems: [
      {
        message: "O caixa está fechado",
        fix: "Abra o caixa em Menu › Caixa.",
      },
      {
        message: "Estoque insuficiente para o produto ...",
        fix: "A quantidade pedida é maior que o estoque. O carrinho é mantido: diminua a quantidade ou peça ao gerente para dar entrada da mercadoria.",
      },
      {
        message: "O desconto não pode passar do total da venda.",
        fix: "Digite um desconto menor ou igual ao subtotal.",
      },
      {
        message: "O produto não aparece na busca",
        fix: "Ele pode estar pausado, sem estoque ou não ser vendido nesta loja. Veja em Menu › Estoque.",
      },
    ],
    related: ["vendas-fiado", "vendas-vasilhame", "vendas-historico"],
    keywords: ["pdv", "vender", "leitor", "código de barras", "desconto", "troco", "carrinho"],
  },
  {
    id: "vendas-fiado",
    category: "vendas",
    title: "Vender no fiado",
    purpose: "Vender agora e deixar o cliente pagar depois. O valor vira dívida dele na loja.",
    where: "Menu › Vender (PDV) › Finalizar venda › Fiado",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Monte o carrinho normalmente e clique em Finalizar venda.",
      "Escolha a forma de pagamento Fiado.",
      "Escolha o cliente na busca. Se ele ainda não existe, use Cadastrar novo cliente.",
      "Clique em Concluir. O valor entra na dívida do cliente nesta loja.",
      "Se o cliente já deve no fiado, o sistema avisa antes de concluir: quanto ele já deve, em quantas vendas, a data da mais antiga e quanto a dívida fica com esta venda. Clique em Sim, vender no fiado para concluir ou em Não, voltar para trocar a forma de pagamento.",
      "Se o cliente tem limite de crédito e a venda faz a dívida (somando todas as lojas) passar dele, o atendente é barrado; gerente e dono veem o aviso e podem confirmar em Sim, vender acima do limite.",
      "Para receber depois, use Menu › Clientes e fiado › o cliente › Receber pagamento.",
    ],
    problems: [
      {
        message: "Escolha o cliente para vender no fiado.",
        fix: "O fiado precisa de um cliente. Escolha ou cadastre um.",
      },
      {
        message: "Cliente com fiado em aberto",
        fix: "Não é um erro: o cliente já deve em vendas anteriores. Confira o valor com ele e decida se vende no fiado de novo. As vendas contadas são as que ainda não foram pagas (cada pagamento quita primeiro as mais antigas). O atendente só vê a dívida das lojas em que trabalha.",
      },
      {
        message: "Venda acima do limite de crédito",
        fix: "A dívida do cliente passaria do limite definido pelo gerente ou dono. Atendente: receba em outra forma de pagamento ou chame o gerente. Gerente e dono podem confirmar a venda.",
      },
      {
        message: "Esta venda passa do limite de crédito do cliente.",
        fix: "Mesmo caso do aviso acima, quando a dívida em outras lojas (que o atendente não vê) faz passar do limite. Chame o gerente.",
      },
      {
        message: "Não foi possível conferir o fiado",
        fix: "O sistema não conseguiu consultar a dívida do cliente (por exemplo, internet instável). Você pode vender mesmo assim ou voltar e tentar de novo.",
      },
      {
        message: "O sistema está somente para consulta",
        fix: "Com a assinatura vencida não dá para vender, nem no fiado, nem receber pagamento de fiado, até regularizar.",
      },
    ],
    related: ["clientes-receber", "clientes-limite", "assinatura-somente-leitura"],
    keywords: ["fiado", "a prazo", "dívida", "pendura", "caderneta", "aviso de fiado", "já deve"],
  },
  {
    id: "vendas-vasilhame",
    category: "vendas",
    title: "Venda com vasilhame",
    purpose:
      "Vender produto que sai com vasilhame e controlar o que o cliente leva e o que devolve na hora.",
    where: "Menu › Vender (PDV) › Finalizar venda › Vasilhames",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Adicione ao carrinho os produtos normalmente. Os que usam vasilhame mostram o nome do vasilhame.",
      "Ao finalizar, aparece a caixa Vasilhames: cada unidade vendida leva um vasilhame do cliente.",
      "Em Devolve, digite quantos vasilhames o cliente entrega agora.",
      "Se a troca for de um por um (levou 6, devolveu 6), não precisa escolher cliente.",
      "Se ele sair devendo vasilhame (ou com crédito), o sistema pede o cliente: escolha ou cadastre.",
    ],
    problems: [
      {
        message: "Escolha o cliente: ele sai devendo (ou com crédito) de vasilhames.",
        fix: "A quantidade devolvida é diferente da levada. Escolha o cliente para o sistema anotar a diferença.",
      },
    ],
    related: ["vasilhames-cliente", "vendas-vender"],
    keywords: ["vasilhame", "casco", "garrafa", "devolver", "troca", "devendo"],
  },
  {
    id: "vendas-historico",
    category: "vendas",
    title: "Ver o histórico de vendas",
    purpose: "Consultar vendas passadas, com filtros e o total do período.",
    where: "Menu › Vendas",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra Menu › Vendas. Por padrão aparecem as vendas de hoje.",
      "Mude o período em De e até, ou filtre por forma de pagamento, situação (concluída ou cancelada) ou número da venda.",
      "No topo aparecem o faturamento do filtro (só vendas concluídas) e, para gerente e dono, o lucro.",
      "Clique no número da venda (#...) para ver os itens, o vendedor, o cliente e os vasilhames.",
    ],
    related: ["vendas-cancelar", "gestao-historico"],
    keywords: ["histórico", "relatório", "período", "faturamento"],
  },
  {
    id: "vendas-cancelar",
    category: "vendas",
    title: "Cancelar uma venda",
    purpose:
      "Desfazer uma venda feita por engano: devolve estoque, estorna o valor e desfaz vasilhames.",
    where: "Menu › Vendas › a venda › Cancelar venda",
    minRole: "MANAGER",
    audience: ["MANAGER"],
    steps: [
      "Confira se o caixa está aberto: o estorno é lançado nele.",
      "Abra Menu › Vendas, clique no número da venda e depois em Cancelar venda.",
      "Confirme. O estoque volta, o dinheiro é estornado no caixa (ou na dívida, se foi fiado) e os vasilhames são desfeitos.",
    ],
    problems: [
      {
        message: "Para cancelar uma venda, o caixa precisa estar aberto para registrar o estorno.",
        fix: "Abra o caixa em Menu › Caixa e tente de novo.",
      },
      {
        message: "Não é possível cancelar: o cliente já pagou parte desta venda a prazo.",
        fix: "Venda no fiado já paga em parte não pode ser cancelada. Faça o acerto manualmente com o cliente.",
      },
      {
        message: "Esta venda já está cancelada.",
        fix: "Nada a fazer: a venda já foi cancelada.",
      },
    ],
    related: ["vendas-historico", "faq-cancelei-fiado"],
    keywords: ["cancelar", "estornar", "desfazer venda", "engano"],
  },
];
