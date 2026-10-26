import type { Article } from "./types";

export const clientes: Article[] = [
  {
    id: "clientes-cadastrar",
    category: "clientes",
    title: "Cadastrar e editar clientes",
    purpose: "Manter a lista de clientes da empresa. O cadastro vale para todas as lojas.",
    where: "Menu › Clientes e fiado › Novo cliente",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Abra Menu › Clientes e fiado e clique em Novo cliente.",
      "Digite o nome e, se quiser, o telefone. Gerentes e donos também podem definir o Limite de crédito no fiado.",
      "Se quiser, preencha o Endereço (opcional): digite o CEP e o sistema busca rua, bairro, cidade e UF sozinho; você completa o número e o complemento. O que você já digitou não é trocado. Se o CEP não for encontrado ou a consulta estiver fora do ar, preencha à mão. Salve.",
      "Para achar alguém, use a busca por nome ou telefone. A lista já mostra quanto cada cliente deve no fiado.",
      "Para mudar os dados, abra o cliente e clique em Editar.",
      "O endereço aparece embaixo do nome na tela do cliente. Para apagar, abra Editar e limpe os campos.",
      "Você também pode cadastrar um cliente na hora de uma venda, em Cadastrar novo cliente (cadastro rápido, só nome e telefone; o endereço você completa depois em Editar).",
    ],
    problems: [
      {
        message: "O cliente tem dívida (fiado) e não pode ser excluído.",
        fix: "Receba o pagamento da dívida primeiro (Menu › Clientes e fiado › o cliente › Receber pagamento).",
      },
      {
        message: "O cliente deve vasilhames e não pode ser excluído.",
        fix: "Registre as devoluções de vasilhame antes de excluir.",
      },
      {
        message: "CEP não encontrado. Preencha o endereço abaixo.",
        fix: "O CEP não existe na consulta pública. Confira os números ou preencha rua, bairro, cidade e UF à mão: o endereço é opcional.",
      },
      {
        message: "Não foi possível consultar o CEP agora.",
        fix: "A consulta está fora do ar ou sem internet. Preencha o endereço à mão ou tente de novo daqui a pouco.",
      },
      {
        message: "O estado deve ter 2 letras (UF).",
        fix: "Digite a sigla do estado com 2 letras, por exemplo PE, ou deixe o campo vazio.",
      },
    ],
    related: ["clientes-fiado", "clientes-limite", "faq-excluir-engano"],
    keywords: [
      "novo cliente",
      "cadastro",
      "telefone",
      "endereço",
      "cep",
      "rua",
      "bairro",
      "cidade",
    ],
  },
  {
    id: "clientes-fiado",
    category: "clientes",
    title: "Ver a dívida do cliente por loja",
    purpose:
      "Saber quanto o cliente deve e em qual loja, e quantos vasilhames ele tem emprestados.",
    where: "Menu › Clientes e fiado",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra Menu › Clientes e fiado. A lista já mostra a coluna Dívida nesta loja (e Outras lojas, se você trabalha em mais de uma). Gerentes e donos veem também a coluna Dívida total, com a soma de todas as lojas. Quem não deve aparece com um traço.",
      "Marque Só quem deve no fiado para ver apenas os clientes com dívida.",
      "Para ver os detalhes, clique em Abrir na linha do cliente.",
      "Em Fiado por loja você vê a dívida em cada loja. A dívida de uma loja não se mistura com a de outra.",
      "Gerentes e donos veem também a dívida total. O atendente vê só as lojas em que trabalha.",
      "Mais abaixo estão os pagamentos recebidos e as vendas no fiado desta loja.",
    ],
    related: ["clientes-receber", "clientes-pagar-outra-loja", "clientes-limite"],
    keywords: ["dívida", "saldo", "fiado", "deve", "quem deve", "devedores", "lista de dívidas"],
  },
  {
    id: "clientes-limite",
    category: "clientes",
    title: "Limite de crédito no fiado",
    purpose:
      "Definir até quanto cada cliente pode dever no fiado, somando todas as lojas da empresa.",
    where: "Menu › Clientes e fiado › o cliente › Editar › Limite de crédito no fiado",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER", "EMPLOYEE"],
    steps: [
      "Abra Menu › Clientes e fiado, clique em Abrir no cliente e depois em Editar (ou defina já em Novo cliente).",
      "Preencha Limite de crédito no fiado e salve. Deixe vazio para o cliente não ter limite.",
      "O limite vale para a dívida somada em todas as lojas. No detalhe do cliente aparece quanto ainda está disponível ou quanto passou.",
      "Na venda no fiado (PDV ou fechamento de comanda), se a dívida passar do limite, o atendente é barrado e precisa escolher outra forma de pagamento ou chamar o gerente.",
      "Gerente e dono veem o aviso com o limite e o valor que a dívida vai atingir, e podem confirmar em Sim, vender acima do limite.",
    ],
    problems: [
      {
        message: "Venda acima do limite de crédito",
        fix: "A venda faria a dívida do cliente passar do limite. Atendente: receba à vista ou chame o gerente. Gerente e dono podem confirmar a venda ou aumentar o limite em Editar.",
      },
      {
        message: "Só gerente ou dono pode definir o limite de crédito do cliente.",
        fix: "O atendente não altera o limite. Peça a um gerente ou ao dono.",
      },
    ],
    related: ["vendas-fiado", "clientes-fiado", "clientes-cadastrar"],
    keywords: ["limite", "limite de crédito", "crédito", "teto", "bloquear fiado", "máximo"],
  },
  {
    id: "clientes-receber",
    category: "clientes",
    title: "Receber pagamento de fiado",
    purpose: "Dar baixa na dívida quando o cliente paga.",
    where: "Menu › Clientes e fiado › o cliente › Receber pagamento",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE"],
    steps: [
      "Confira se o caixa está aberto: o dinheiro entra no caixa desta loja.",
      "Abra o cliente e clique em Receber pagamento.",
      "Digite o valor e escolha a forma de pagamento (dinheiro, PIX ou cartão).",
      "No modo Automático o sistema abate primeiro a dívida desta loja e depois as outras, da mais antiga para a mais nova.",
      "Se o cliente deve em mais de uma loja e você quer escolher, use Escolher por loja e divida o valor. A soma tem que fechar com o valor recebido.",
      "Clique em Receber pagamento.",
    ],
    problems: [
      {
        message: "Não há caixa aberto nesta loja para receber o pagamento.",
        fix: "Abra o caixa em Menu › Caixa e tente de novo.",
      },
      {
        message: "O valor é maior que a dívida total do cliente.",
        fix: "Não existe saldo a favor. Digite no máximo o valor que ele deve.",
      },
      {
        message: "A soma das alocações precisa ser igual ao valor do pagamento.",
        fix: "No modo Escolher por loja, distribua exatamente o valor recebido entre as lojas.",
      },
      {
        message: "O sistema está somente para consulta",
        fix: "Com a assinatura vencida não dá para receber pagamento de fiado até regularizar.",
      },
    ],
    related: ["clientes-pagar-outra-loja", "caixa-abrir", "assinatura-somente-leitura"],
    keywords: ["receber", "pagamento", "baixa", "quitar", "fiado"],
  },
  {
    id: "clientes-pagar-outra-loja",
    category: "clientes",
    title: "Pagar a dívida de uma loja estando em outra",
    purpose:
      "Receber, numa loja, o pagamento de uma dívida que o cliente tem em outra loja da mesma empresa.",
    where: "Menu › Clientes e fiado › o cliente › Receber pagamento › Escolher por loja",
    minRole: "EMPLOYEE",
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Entre na loja onde o cliente está pagando agora (nome da loja no topo).",
      "Abra o cliente e clique em Receber pagamento.",
      "Digite o valor e escolha Escolher por loja.",
      "Digite quanto abate da dívida de cada loja. Pode usar Tudo para quitar uma loja inteira.",
      "O dinheiro entra no caixa da loja em que você está; a dívida que diminui é a das lojas que você escolheu.",
    ],
    problems: [
      {
        message: "Uma das alocações é maior que a dívida do cliente na loja.",
        fix: "Não dá para abater mais do que o cliente deve em cada loja. Diminua o valor daquela loja.",
      },
    ],
    related: ["clientes-receber"],
    keywords: ["outra loja", "abatimento cruzado", "pagar em outra loja"],
  },
];
