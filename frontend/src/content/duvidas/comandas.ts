import type { Article } from "./types";

export const comandas: Article[] = [
  {
    id: "comandas-abrir",
    category: "comandas",
    title: "Abrir e acompanhar comandas",
    purpose: "Manter contas abertas (mesas ou clientes) e fechar depois.",
    where: "Menu › Comandas › Nova comanda",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Abra Menu › Comandas e clique em Nova comanda.",
      "Dê um nome (ex.: Mesa 4) e, se quiser, escolha o cliente.",
      "Depois de aberta, clique na comanda para lançar os itens.",
      "As comandas abertas ficam na aba Abertas, com o total parcial. As já fechadas ficam na aba Fechadas.",
    ],
    related: ["comandas-itens", "comandas-fechar"],
    keywords: ["comanda", "mesa", "conta aberta"],
  },
  {
    id: "comandas-itens",
    category: "comandas",
    title: "Adicionar e remover itens da comanda",
    purpose: "Lançar o que o cliente consumiu. O estoque baixa na hora e o preço fica fixo.",
    where: "Menu › Comandas › a comanda",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Abra a comanda em Menu › Comandas.",
      "Passe o leitor ou busque o produto e toque nele: cada toque lança 1 unidade. Para lançar um fardo inteiro (ex.: 12 unidades), toque em + fardo, no rodapé do cartão do produto (ao lado de + 1 un.).",
      "O estoque baixa assim que o item é lançado, e o preço fica o que valia naquele momento, mesmo que mude depois.",
      "Para tirar um item, clique na lixeira ao lado dele. O estoque volta.",
    ],
    problems: [
      {
        message: "Estoque insuficiente",
        fix: "Não há quantidade suficiente. Peça ao gerente para dar entrada da mercadoria.",
      },
      {
        message: "Esta comanda já está fechada.",
        fix: "Não dá para mexer numa comanda fechada. Abra uma nova.",
      },
    ],
    related: ["comandas-fechar", "comandas-cancelar"],
    keywords: ["lançar item", "adicionar", "remover item"],
  },
  {
    id: "comandas-fechar",
    category: "comandas",
    title: "Fechar a comanda",
    purpose: "Receber o pagamento e transformar a comanda em venda.",
    where: "Menu › Comandas › a comanda › Fechar comanda",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Confira se o caixa está aberto.",
      "Abra a comanda e clique em Fechar comanda.",
      "Escolha a forma de pagamento, o desconto (opcional) e o cliente, se precisar (fiado ou vasilhames). No fiado, se o cliente já deve, o sistema mostra quanto e em quantas vendas e pergunta se quer mesmo vender.",
      "Se houver produtos com vasilhame, informe quantos o cliente devolve agora.",
      "Clique em Concluir. A venda é registrada sem baixar o estoque de novo, porque ele já baixou ao lançar os itens.",
    ],
    problems: [
      {
        message: "Não é possível fechar uma comanda vazia.",
        fix: "Lance pelo menos um item, ou cancele a comanda.",
      },
      {
        message: "Não há caixa aberto. Abra o caixa antes de realizar vendas.",
        fix: "Abra o caixa em Menu › Caixa e feche a comanda de novo.",
      },
    ],
    related: ["vendas-fiado", "vendas-vasilhame"],
    keywords: ["fechar comanda", "pagar comanda", "conta"],
  },
  {
    id: "comandas-cancelar",
    category: "comandas",
    title: "Cancelar uma comanda",
    purpose: "Desistir da comanda: todos os itens voltam para o estoque e nenhuma venda é feita.",
    where: "Menu › Comandas › a comanda › Cancelar comanda",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Abra a comanda em Menu › Comandas.",
      "Clique em Cancelar comanda e confirme.",
      "O estoque de todos os itens é devolvido e a comanda sai da lista.",
    ],
    related: ["comandas-itens"],
    keywords: ["cancelar comanda", "desistir"],
  },
];
