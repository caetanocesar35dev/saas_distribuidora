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
      "Não precisa abrir o caixa antes: se ele estiver fechado, a primeira venda abre o caixa sozinha, com o saldo do último fechamento.",
      "Abra Menu › Vender (PDV). O cursor já fica na busca (tecla F2 volta para ela).",
      "Passe o leitor de código de barras ou digite o nome. Tocar no produto também adiciona. Cada toque soma 1 unidade; ajuste a quantidade no carrinho. Ao tocar, a busca continua filtrada, para você adicionar mais do mesmo produto; pelo leitor, ela limpa sozinha para o próximo código.",
      "Para vender em lote (fardo, caixa, engradado), toque em + fardo, no rodapé do cartão do produto (ao lado de + 1 un.): entra 1 fardo de uma vez (ex.: 12 unidades). No carrinho, ajuste Fardos e Unidades separados (ex.: 2 fardos + 3 unidades). O preço do fardo é o da unidade vezes as unidades do fardo; para dar desconto de atacado, use o campo Desconto no pagamento.",
      "Clique em Finalizar venda (ou tecla F9).",
      "Escolha a forma de pagamento. Se quiser, digite um desconto. No dinheiro, digite o valor recebido para ver o troco.",
      "Clique em Concluir. A venda aparece em Menu › Histórico de vendas.",
    ],
    problems: [
      {
        message: "O caixa está fechado",
        fix: "Não precisa fazer nada: a primeira venda abre o caixa sozinha, com o saldo do último fechamento.",
      },
      {
        message: "Estoque insuficiente",
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
      {
        message: "O botão + fardo não aparece",
        fix: "O produto não tem a quantidade por fardo cadastrada. Peça ao gerente para preencher Unidades por fardo (maior que 1) em Menu › Produtos › o produto › Editar.",
      },
    ],
    related: ["vendas-fiado", "vendas-vasilhame", "vendas-historico"],
    keywords: [
      "pdv",
      "vender",
      "leitor",
      "código de barras",
      "desconto",
      "troco",
      "carrinho",
      "fardo",
      "lote",
      "caixa fechada",
      "engradado",
      "atacado",
    ],
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
    where: "Menu › Histórico de vendas",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra Menu › Histórico de vendas. Por padrão aparecem as vendas de hoje.",
      "Mude o período em De e até, ou filtre por forma de pagamento, situação (concluída ou cancelada) ou número da venda.",
      "No topo aparecem o faturamento do filtro (só vendas concluídas) e, para gerente e dono, o lucro.",
      "Clique no número da venda (#...) para ver os itens, o vendedor, o cliente e os vasilhames.",
      "Vendas com a marca lançada depois são vendas antigas, lançadas depois que aconteceram; elas aparecem no dia em que aconteceram.",
    ],
    related: ["vendas-cancelar", "vendas-lancar-antiga", "gestao-historico"],
    keywords: ["histórico", "relatório", "período", "faturamento"],
  },
  {
    id: "vendas-lancar-antiga",
    category: "vendas",
    title: "Lançar uma venda antiga",
    purpose:
      "Registrar vendas que aconteceram sem o sistema, por exemplo quando a internet caiu e a venda foi anotada no papel.",
    where: "Menu › Lançar venda antiga (logo abaixo de Histórico de vendas)",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER", "EMPLOYEE"],
    steps: [
      "O dinheiro da venda antiga entra no caixa aberto agora (se estiver fechado, ele abre sozinho).",
      "No menu, clique em Lançar venda antiga, logo abaixo de Histórico de vendas. O item só aparece para gerente e dono.",
      "Informe a data e a hora em que a venda aconteceu. Pode ser qualquer data passada, mas não no futuro.",
      "Monte o carrinho como no PDV, clique em Lançar venda e escolha a forma de pagamento, o desconto e o cliente (fiado ou vasilhames), como numa venda normal.",
      "A venda aparece nos relatórios e painéis no dia em que aconteceu, com a marca lançada depois. O estoque baixa agora.",
      "No caixa, a venda entra como Venda #... lançada depois e conta no resumo do caixa atual. No fiado, o valor vai para a dívida do cliente e não mexe no caixa.",
      "Para lançar várias vendas do mesmo dia, clique em Lançar outra: a data fica preenchida.",
    ],
    problems: [
      {
        message: "A data da venda não pode ser no futuro.",
        fix: "Confira a data e a hora. Para uma venda de agora, use o PDV normal (Menu › Vender).",
      },
      {
        message: "Você não tem permissão para ver esta página",
        fix: "Só gerente e dono lançam vendas antigas. O atendente anota a venda no papel e entrega ao gerente.",
      },
      {
        message: "Estoque insuficiente",
        fix: "O estoque do sistema está menor do que o vendido. Confira a contagem e faça uma entrada ou um ajuste de estoque antes de lançar.",
      },
    ],
    related: ["vendas-vender", "vendas-historico", "caixa-fechar"],
    keywords: [
      "venda antiga",
      "venda atrasada",
      "lançar depois",
      "internet caiu",
      "sem internet",
      "papel",
      "retroativa",
    ],
  },
  {
    id: "vendas-cancelar",
    category: "vendas",
    title: "Cancelar uma venda",
    purpose:
      "Desfazer uma venda feita por engano: devolve estoque, estorna o valor e desfaz vasilhames.",
    where: "Menu › Histórico de vendas › a venda › Cancelar venda",
    minRole: "MANAGER",
    audience: ["MANAGER"],
    steps: [
      "O estorno é lançado no caixa aberto (se estiver fechado, ele abre sozinho).",
      "Abra Menu › Histórico de vendas, clique no número da venda e depois em Cancelar venda.",
      "Confirme. O estoque volta, o dinheiro é estornado no caixa (ou na dívida, se foi fiado) e os vasilhames são desfeitos.",
    ],
    problems: [
      {
        message: "Para cancelar uma venda, o caixa precisa estar aberto para registrar o estorno.",
        fix: "Raro: o caixa fechou sozinho (horário de fechamento automático) bem no meio da operação. Tente de novo: o caixa abre sozinho.",
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
