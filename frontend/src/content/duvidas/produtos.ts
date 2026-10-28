import type { Article } from "./types";

export const produtos: Article[] = [
  {
    id: "produtos-estoque",
    category: "produtos",
    title: "Ver o estoque da loja",
    purpose: "Conferir quanto tem de cada produto, o preço e se o produto está à venda.",
    where: "Menu › Estoque",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra Menu › Estoque.",
      "Use a busca para achar o produto pelo nome ou pelo código de barras (pode passar o leitor).",
      "Use o filtro ao lado da busca para ver só os produtos à venda ou só os pausados.",
      'A coluna Estoque mostra quantas unidades existem nesta loja. "Sem estoque" quer dizer zero.',
      "Gerentes e donos também veem o custo e os botões para dar entrada, ajustar e mudar preço.",
    ],
    problems: [
      {
        message: "Nenhum produto encontrado",
        fix: "Confira a busca. Se a loja é nova, peça ao gerente para colocar produtos na loja (Estoque › Colocar produto na loja).",
      },
    ],
    related: ["produtos-entrada", "produtos-estoque-baixo"],
    keywords: ["quantidade", "saldo", "produtos", "preço", "código de barras"],
  },
  {
    id: "produtos-cadastrar",
    category: "produtos",
    title: "Cadastrar um produto novo",
    purpose:
      "Criar um produto no catálogo da empresa e já definir em quais lojas ele é vendido e por quanto.",
    where: "Menu › Produtos › Novo produto",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Abra Menu › Produtos e clique em Novo produto.",
      "Digite o nome. O código de barras é opcional: deixe vazio e o sistema cria um sozinho, ou passe o leitor no campo.",
      "Informe quantas unidades vêm no fardo e, se o produto sai com vasilhame, escolha o tipo.",
      'Em "Em quais lojas este produto é vendido?", marque as lojas. Se o preço é o mesmo em todas, preencha só o Preço de venda padrão (e o Custo padrão, que é opcional); a loja que tiver preço ou custo próprio é só digitar no campo dela.',
      "Clique em Cadastrar produto. O estoque começa em zero: registre a chegada da mercadoria em Menu › Estoque › Entrada.",
    ],
    problems: [
      {
        message: "Já existe um produto com o código ...",
        fix: "Esse código de barras já está em outro produto. Procure-o em Menu › Produtos.",
      },
      {
        message: "O código ... pertence a um produto excluído",
        fix: 'Em vez de cadastrar de novo, use o botão "Reativar o produto excluído" que aparece abaixo da mensagem.',
      },
    ],
    related: ["produtos-preco-loja", "produtos-colocar-tirar", "produtos-excluir-reativar"],
    keywords: ["novo produto", "criar produto", "cadastro", "código de barras"],
  },
  {
    id: "produtos-preco-loja",
    category: "produtos",
    title: "Mudar o preço de um produto em uma loja",
    purpose: "Alterar preço e custo só em uma loja, sem mexer nas outras.",
    where: "Menu › Estoque › ⋮ ao lado do produto › Preço e custo",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Entre na loja que você quer alterar (nome da loja no topo da tela).",
      "Abra Menu › Estoque e ache o produto.",
      "Clique nos três pontinhos (⋮) ao lado dele e escolha Preço e custo.",
      "Digite o novo preço e o novo custo e salve. Só esta loja muda.",
    ],
    problems: [
      {
        message: "Mudei o preço e a outra loja continua com o preço antigo",
        fix: "É assim mesmo: cada loja tem o seu preço. Entre na outra loja e repita o passo a passo.",
      },
    ],
    related: ["produtos-cadastrar"],
    keywords: ["preço", "custo", "valor", "reajuste"],
  },
  {
    id: "produtos-colocar-tirar",
    category: "produtos",
    title: "Colocar ou tirar um produto de uma loja",
    purpose:
      "Escolher quais produtos do catálogo são vendidos em cada loja, ou pausar a venda por um tempo.",
    where: "Menu › Estoque › Colocar produto na loja",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Para colocar: abra Menu › Estoque e clique em Colocar produto na loja.",
      "Busque o produto do catálogo, clique em Escolher e informe preço, custo e o estoque que já existe na loja.",
      "Para tirar de vez: no ⋮ do produto, escolha Tirar da loja. Nas outras lojas nada muda.",
      "Para só parar de vender por um tempo: no ⋮ do produto, escolha Pausar a venda. Depois, Voltar a vender.",
    ],
    problems: [
      {
        message: "Este produto já está cadastrado nesta loja.",
        fix: "Procure o produto na lista de Estoque. Se ele estiver pausado, use Voltar a vender.",
      },
      {
        message: "O produto não aparece na busca do PDV",
        fix: "Ele pode estar pausado ou não estar nesta loja. Confira em Menu › Estoque.",
      },
    ],
    related: ["produtos-cadastrar", "produtos-estoque"],
    keywords: ["pausar", "tirar", "colocar", "oferta"],
  },
  {
    id: "produtos-entrada",
    category: "produtos",
    title: "Dar entrada de mercadoria",
    purpose: "Somar ao estoque os produtos que chegaram do fornecedor.",
    where: "Menu › Estoque › Entrada",
    minRole: "MANAGER",
    audience: ["MANAGER"],
    steps: [
      "Abra Menu › Estoque e ache o produto.",
      "Clique em Entrada na linha do produto.",
      "Digite a quantidade que chegou (não o total) e clique em Registrar entrada.",
      "O estoque aumenta na hora.",
    ],
    problems: [
      {
        message: "Errei a quantidade da entrada",
        fix: "Use Ajuste de inventário no ⋮ do produto e informe a quantidade certa que existe agora, com o motivo.",
      },
    ],
    related: ["produtos-ajuste"],
    keywords: ["chegada", "compra", "receber mercadoria", "somar estoque"],
  },
  {
    id: "produtos-ajuste",
    category: "produtos",
    title: "Ajuste de inventário",
    purpose: "Corrigir o estoque quando a contagem física não bate com o sistema.",
    where: "Menu › Estoque › ⋮ ao lado do produto › Ajuste de inventário",
    minRole: "MANAGER",
    audience: ["MANAGER"],
    steps: [
      "Conte o produto na prateleira.",
      "Abra Menu › Estoque, clique no ⋮ do produto e escolha Ajuste de inventário.",
      'Digite a quantidade contada (o total que existe de verdade) e o motivo, por exemplo "quebra" ou "contagem do inventário".',
      "Salve. O estoque passa a ser exatamente o número que você digitou.",
    ],
    problems: [
      {
        message: "Qual a diferença entre Entrada e Ajuste?",
        fix: "Entrada soma o que chegou. Ajuste substitui o estoque pelo valor contado. Os dois ficam separados para o histórico saber a origem.",
      },
    ],
    related: ["produtos-entrada"],
    keywords: ["inventário", "contagem", "corrigir estoque", "quebra", "perda"],
  },
  {
    id: "produtos-estoque-baixo",
    category: "produtos",
    title: "Ver produtos com estoque baixo",
    purpose: "Saber o que está acabando para repor a tempo.",
    where: "Menu › Estoque › aba Estoque baixo",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Abra Menu › Estoque.",
      "Clique na aba Estoque baixo.",
      "A lista mostra os produtos à venda que estão com pouca quantidade, do menor para o maior.",
      "O painel da loja (Menu › Início) também mostra os que estão acabando.",
    ],
    related: ["produtos-entrada"],
    keywords: ["acabando", "reposição", "pouco estoque"],
  },
  {
    id: "produtos-excluir-reativar",
    category: "produtos",
    title: "Excluir e reativar um produto",
    purpose: "Tirar um produto do catálogo e trazer de volta se foi engano.",
    where: "Menu › Produtos",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Para excluir: abra Menu › Produtos e clique na lixeira ao lado do produto. Ele some do catálogo e de todas as lojas.",
      "Para reativar: em Menu › Produtos, marque Mostrar só os excluídos, ache o produto e clique em Reativar.",
      "Ele volta para o catálogo e para as lojas onde era vendido, com o preço e o estoque de antes. Confira em Menu › Estoque.",
      'Outro caminho: ao cadastrar um produto novo com o código de barras de um excluído, o sistema mostra o botão "Reativar o produto excluído".',
    ],
    problems: [
      {
        message: "O código ... pertence a um produto excluído",
        fix: 'Clique em "Reativar o produto excluído" em vez de tentar cadastrar outro.',
      },
    ],
    related: ["produtos-cadastrar"],
    keywords: ["excluir", "apagar", "reativar", "restaurar", "engano", "excluídos"],
  },
];
