import type { Article } from "./types";

export const vasilhames: Article[] = [
  {
    id: "vasilhames-estoque",
    category: "vasilhames",
    title: "Ver o estoque de vasilhames",
    purpose: "Saber quantos vasilhames de cada tipo existem na loja agora.",
    where: "Menu › Vasilhames › aba Estoque",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra Menu › Vasilhames.",
      "Na aba Estoque, cada linha mostra um tipo de vasilhame e quantos estão na loja.",
      "Na aba Movimentações você vê tudo o que entrou e saiu, com filtros por tipo, vasilhame e data.",
    ],
    problems: [
      {
        message: "O estoque de um vasilhame está negativo",
        fix: "Numa venda o sistema não impede o estoque de vasilhame de ficar negativo. Registre o recebimento do fornecedor ou peça ao gerente um ajuste manual.",
      },
    ],
    related: ["vasilhames-fornecedor", "vasilhames-tipos"],
    keywords: ["vasilhame", "garrafa", "caixa", "casco", "estoque de vasilhames"],
  },
  {
    id: "vasilhames-tipos",
    category: "vasilhames",
    title: "Cadastrar os tipos de vasilhame",
    purpose: "Criar a lista de vasilhames da empresa (ex.: garrafa 600 ml, caixa de cerveja).",
    where: "Menu › Vasilhames › aba Tipos de vasilhame",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Abra Menu › Vasilhames e clique na aba Tipos de vasilhame.",
      "Clique em Novo tipo, digite o nome e salve.",
      "Para ligar um tipo a um produto, edite o produto em Menu › Produtos e escolha o vasilhame dele.",
      "Para mudar o nome, use Renomear. Para tirar da lista, use a lixeira.",
    ],
    problems: [
      {
        message: "Existem clientes com saldo deste vasilhame.",
        fix: "O tipo não pode ser excluído enquanto algum cliente deve vasilhames dele. Registre as devoluções primeiro.",
      },
      {
        message: "Existem produtos usando este tipo de vasilhame.",
        fix: "Edite os produtos que usam este tipo (Menu › Produtos) e tire o vasilhame deles antes de excluir.",
      },
      {
        message: "O tipo ... existe, mas está excluído",
        fix: "Clique em \"Reativar o tipo excluído\" em vez de criar outro com o mesmo nome.",
      },
    ],
    related: ["vasilhames-estoque", "produtos-cadastrar"],
    keywords: ["tipo", "cadastrar vasilhame", "garrafeira", "casco"],
  },
  {
    id: "vasilhames-fornecedor",
    category: "vasilhames",
    title: "Enviar e receber vasilhames do fornecedor",
    purpose: "Registrar os vasilhames que a loja devolveu ao fornecedor e os que ele entregou.",
    where: "Menu › Vasilhames › Enviar ao fornecedor / Receber do fornecedor",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra Menu › Vasilhames.",
      "Para vasilhames que saíram da loja de volta ao fornecedor, clique em Enviar ao fornecedor.",
      "Para vasilhames que o fornecedor deixou na loja, clique em Receber do fornecedor.",
      "Escolha o tipo, digite a quantidade (sempre número positivo) e confirme.",
    ],
    problems: [
      {
        message: "O estoque não pode ficar negativo",
        fix: "Você está enviando mais do que a loja tem. Confira a contagem; se o sistema está errado, peça ao gerente um ajuste manual.",
      },
    ],
    related: ["vasilhames-estoque", "vasilhames-ajuste"],
    keywords: ["fornecedor", "enviar", "receber", "troca de vasilhame"],
  },
  {
    id: "vasilhames-cliente",
    category: "vasilhames",
    title: "Empréstimo e devolução de vasilhame do cliente",
    purpose:
      "Registrar vasilhames que o cliente levou emprestado fora de uma venda e as devoluções dele.",
    where: "Menu › Clientes e fiado › o cliente › Emprestar vasilhame / Devolução de vasilhame",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Abra Menu › Clientes e fiado e clique em Abrir no cliente.",
      "Para um empréstimo avulso, clique em Emprestar vasilhame, escolha o tipo e a quantidade. O vasilhame sai do estoque da loja e vira dívida do cliente nesta loja.",
      "Para uma devolução, clique em Devolução de vasilhame, escolha o tipo e a quantidade devolvida.",
      "Em Vasilhames que o cliente deve, conferimos quanto resta em cada loja.",
      "Importante: a devolução só abate a dívida da loja onde o cliente levou. Quem levou na Loja A devolve na Loja A.",
    ],
    problems: [
      {
        message: "O cliente deve vasilhames em outra loja",
        fix: "Aquela dívida só pode ser abatida na loja em que foi feita. Peça ao cliente para devolver lá, ou entre na outra loja (topo da tela) e registre a devolução.",
      },
      {
        message: "O cliente deve só ... desse vasilhame aqui.",
        fix: "A quantidade devolvida é maior do que ele deve nesta loja. Digite no máximo o valor que aparece.",
      },
    ],
    related: ["vendas-vasilhame", "faq-vasilhame-outra-loja"],
    keywords: ["devolução", "empréstimo", "casco", "dívida de vasilhame"],
  },
  {
    id: "vasilhames-ajuste",
    category: "vasilhames",
    title: "Ajuste manual de vasilhames",
    purpose: "Corrigir o estoque de vasilhames quando a contagem real é diferente.",
    where: "Menu › Vasilhames › Ajuste manual",
    minRole: "MANAGER",
    audience: ["MANAGER"],
    steps: [
      "Conte os vasilhames na loja.",
      "Abra Menu › Vasilhames e clique em Ajuste manual.",
      "Escolha o tipo, diga se o ajuste soma ou tira do estoque e digite a diferença.",
      "Escreva uma observação (ex.: \"quebra\") e registre.",
    ],
    problems: [
      {
        message: "Não vejo o botão Ajuste manual",
        fix: "Só gerente e dono fazem ajuste manual. Peça ao gerente.",
      },
    ],
    related: ["vasilhames-fornecedor"],
    keywords: ["corrigir vasilhame", "quebra", "diferença"],
  },
];
