import type { Article } from "./types";

export const caixa: Article[] = [
  {
    id: "caixa-abrir",
    category: "caixa",
    title: "Abrir o caixa",
    purpose:
      "Começar o dia com o caixa aberto. Não é obrigatório: a primeira venda abre o caixa sozinha.",
    where: "Menu › Caixa › Caixa atual › Abrir caixa",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Você não precisa abrir o caixa à mão: a primeira venda (ou recebimento de fiado, entrada ou sangria) abre o caixa sozinha, com o saldo inicial igual ao saldo do último fechamento.",
      "Para começar com outro valor (o dinheiro contado na gaveta), abra Menu › Caixa, digite o valor em Saldo inicial e clique em Abrir caixa.",
      "Só existe um caixa aberto por loja de cada vez.",
    ],
    problems: [
      {
        message: "Já existe um caixa aberto nesta loja. Feche-o antes de abrir outro.",
        fix: "Outra pessoa já abriu o caixa. Use esse mesmo caixa ou feche-o em Menu › Caixa › Fechar caixa.",
      },
      {
        message: "O caixa está fechado",
        fix: "Não precisa fazer nada: a primeira venda abre o caixa sozinha, com o saldo do último fechamento.",
      },
    ],
    related: ["caixa-entrada", "caixa-fechar"],
    keywords: ["abrir caixa", "saldo inicial", "gaveta", "troco inicial"],
  },
  {
    id: "caixa-entrada",
    category: "caixa",
    title: "Ver o saldo e registrar entrada de dinheiro",
    purpose:
      "Conferir quanto há no caixa agora e lançar dinheiro que entrou fora de uma venda (reforço de troco).",
    where: "Menu › Caixa › Caixa atual › Entrada de dinheiro",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Abra Menu › Caixa. O Saldo atual aparece no topo e as movimentações, logo abaixo.",
      "Para lançar uma entrada, clique em Entrada de dinheiro.",
      "Digite o valor e, se quiser, uma descrição (ex.: reforço de troco). Clique em Registrar entrada.",
      "As vendas e os pagamentos de fiado já entram sozinhos, não precisa lançar.",
    ],
    related: ["caixa-sangria", "caixa-fechar"],
    keywords: ["saldo", "entrada", "reforço", "troco"],
  },
  {
    id: "caixa-sangria",
    category: "caixa",
    title: "Sangria: tirar dinheiro do caixa",
    purpose: "Registrar dinheiro que sai do caixa (sangria ou pagamento de uma despesa).",
    where: "Menu › Caixa › Caixa atual › Saída (sangria)",
    minRole: "MANAGER",
    audience: ["MANAGER"],
    steps: [
      "Abra Menu › Caixa e clique em Saída (sangria).",
      "Digite o valor e a descrição (ex.: sangria, pagamento de frete).",
      "Clique em Registrar saída. O saldo diminui na hora.",
    ],
    problems: [
      {
        message: "Saldo insuficiente em caixa.",
        fix: "A saída não pode deixar o caixa negativo. Confira o saldo atual e use um valor menor.",
      },
      {
        message: "Não vejo o botão Saída (sangria)",
        fix: "Só o gerente e o dono podem tirar dinheiro. Peça ao gerente.",
      },
    ],
    related: ["caixa-entrada"],
    keywords: ["sangria", "saída", "retirada", "despesa"],
  },
  {
    id: "caixa-fechar",
    category: "caixa",
    title: "Fechar o caixa e conferir",
    purpose: "Encerrar o dia, ver o saldo final e conferir as vendas por forma de pagamento.",
    where: "Menu › Caixa › Caixa atual › Fechar caixa",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Abra Menu › Caixa e clique em Fechar caixa.",
      "Confirme. O sistema mostra o saldo final e a tabela de vendas por forma de pagamento (dinheiro, PIX, cartões e fiado).",
      "Para conferir o dinheiro da gaveta, olhe o total em Dinheiro dessa tabela. O saldo do caixa soma todas as formas, sem separar.",
      "Depois de fechado, a próxima venda abre um caixa novo sozinha, com o saldo final deste.",
      "Esqueceu de fechar? O caixa fecha sozinho todo dia no horário da loja (padrão meia-noite; o dono muda em Painel da empresa › Lojas › Editar › Fechamento automático do caixa). Em Caixas anteriores ele aparece com a marca automático.",
    ],
    problems: [
      {
        message: "Não há caixa aberto para fechar nesta loja.",
        fix: "O caixa já foi fechado. Veja em Menu › Caixa › Caixas anteriores.",
      },
      {
        message: "O sistema está somente para consulta",
        fix: "Mesmo assim o caixa já aberto pode ser fechado normalmente. Só não dá para abrir outro até regularizar a assinatura.",
      },
    ],
    related: ["caixa-anteriores", "assinatura-somente-leitura"],
    keywords: ["fechar caixa", "conferir", "fechamento", "resumo"],
  },
  {
    id: "caixa-anteriores",
    category: "caixa",
    title: "Ver caixas anteriores",
    purpose: "Consultar o fechamento de dias passados.",
    where: "Menu › Caixa › Caixas anteriores",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra Menu › Caixa e clique na aba Caixas anteriores.",
      "Clique em Ver detalhes na linha do dia que você quer.",
      "O detalhe mostra os saldos, as movimentações e as vendas por forma de pagamento.",
      "Gerentes e donos têm o botão Histórico para ver quem alterou o caixa.",
    ],
    related: ["caixa-fechar", "gestao-historico"],
    keywords: ["histórico de caixa", "fechamentos", "dias anteriores"],
  },
];
