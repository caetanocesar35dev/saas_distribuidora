import type { Article } from "./types";

export const gestao: Article[] = [
  {
    id: "gestao-painel",
    category: "gestao",
    title: "Painel da loja e da empresa",
    purpose:
      "Acompanhar faturamento, lucro, produtos mais vendidos, estoque baixo e fiado em aberto.",
    where: "Menu › Início (loja) · Menu › Painel da empresa (dono)",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Para a loja: abra Menu › Início. Gerentes e donos veem o painel logo abaixo dos atalhos.",
      "Para a empresa toda: o dono abre Menu › Painel da empresa. Ele soma todas as lojas e tem uma tabela com cada loja.",
      "Os períodos são fixos: hoje, últimos 7 dias e este mês. Para outro período, use Menu › Histórico de vendas.",
      "Faturamento e lucro contam tudo o que foi vendido, inclusive no fiado (vendas canceladas ficam de fora). Quando há fiado, o cartão mostra embaixo quanto disso foi vendido no fiado, que ainda pode não ter sido pago.",
      "O cartão Fiado recebido mostra quanto os clientes pagaram de fiado nesta loja no período, de vendas de qualquer data.",
      "O gráfico mostra faturamento e lucro de cada um dos últimos 7 dias.",
      "Para o dono, enquanto a loja não estiver pronta, o Início mostra os Primeiros passos: confirmar o endereço da loja, cadastrar os produtos, abrir o caixa e convidar a equipe. Cada item leva para a tela certa e marca sozinho quando você conclui. O botão Esconder tira o quadro só deste navegador.",
    ],
    problems: [
      {
        message: "Não vejo o painel",
        fix: "O painel da loja é do gerente e do dono; o da empresa é só do dono. O atendente vê apenas os atalhos.",
      },
    ],
    related: ["vendas-historico", "gestao-historico"],
    keywords: ["dashboard", "relatório", "lucro", "faturamento", "gráfico", "fiado recebido"],
  },
  {
    id: "gestao-historico",
    category: "gestao",
    title: "Histórico de alterações",
    purpose:
      "Descobrir quem mudou algo, quando e o que mudou (preço, estoque, papel de alguém...).",
    where: "Botão Histórico na tela do item (produto, venda, caixa, cliente, loja, equipe)",
    minRole: "MANAGER",
    audience: ["MANAGER", "OWNER"],
    steps: [
      "Procure o botão Histórico na tela do item: no Estoque (ícone de relógio ao lado do produto), em uma venda, em um caixa, em uma comanda, no cliente, nas Lojas e na Equipe.",
      "Clique nele. A lista mostra cada alteração, da mais recente para a mais antiga.",
      "Cada linha traz o autor, a data e, nas alterações, o valor antigo riscado e o novo ao lado.",
    ],
    problems: [
      {
        message: "O botão Histórico não aparece",
        fix: "O histórico de uma loja é do gerente e do dono. O histórico de cliente, produto, tipo de vasilhame, loja e equipe é só do dono.",
      },
    ],
    keywords: ["auditoria", "quem alterou", "log", "mudanças"],
  },
  {
    id: "gestao-equipe",
    category: "gestao",
    title: "Equipe: convidar e definir papéis",
    purpose: "Dar acesso às pessoas e dizer o que cada uma pode fazer em cada loja.",
    where: "Menu › Painel da empresa › Equipe",
    minRole: "OWNER",
    audience: ["OWNER"],
    steps: [
      "Abra Menu › Painel da empresa › Equipe.",
      "Para convidar, clique em Convidar pessoa, digite o nome da pessoa (só letras) e o e-mail, marque as lojas e escolha o papel em cada uma (atendente, gerente ou dono).",
      "A pessoa recebe um e-mail para criar a senha (vale 7 dias). Se já tem conta no sistema, só ganha o acesso.",
      "Para mudar o papel, use a lista ao lado da loja, na linha da pessoa. O papel pode ser diferente em cada loja.",
      "Para dar acesso a outra loja, clique no nome da loja em Dar acesso também a.",
      "Para retirar o acesso de uma loja, use a lixeira da linha. Para tirar da empresa toda, use Remover da empresa.",
      "Para ver quem saiu, marque Mostrar quem foi removido, no fim da página: aparece a data e as lojas e papéis que a pessoa tinha. Reativar devolve exatamente esses acessos.",
    ],
    problems: [
      {
        message: "Você não pode alterar o seu próprio papel.",
        fix: "Peça a outro dono da empresa para mudar o seu papel.",
      },
      {
        message: "A empresa precisa ter pelo menos um dono (OWNER).",
        fix: "Antes de tirar ou rebaixar este dono, deixe outra pessoa como dono.",
      },
      {
        message: "As lojas que esta pessoa acessava foram excluídas.",
        fix: "Não há acesso para devolver. Convide a pessoa de novo, escolhendo as lojas e os papéis.",
      },
    ],
    related: ["acesso-convite", "gestao-historico", "faq-excluir-engano"],
    keywords: ["convidar", "equipe", "funcionário", "papel", "permissão", "acesso"],
  },
  {
    id: "gestao-lojas",
    category: "gestao",
    title: "Cadastrar e editar lojas",
    purpose: "Criar novas lojas da empresa e manter os dados delas.",
    where: "Menu › Painel da empresa › Lojas",
    minRole: "OWNER",
    audience: ["OWNER"],
    steps: [
      "Abra Menu › Painel da empresa › Lojas.",
      "Para criar, clique em Nova loja, preencha o nome e o endereço (CEP, rua, número, bairro, cidade e UF são obrigatórios; complemento, telefone e CNPJ são opcionais) e salve. Todos os donos da empresa já viram donos da loja nova.",
      "Se o CNPJ da loja for o mesmo da empresa, deixe o campo em branco: a loja usa o CNPJ da empresa. Se ela tiver CNPJ próprio (filial), digite-o primeiro: ao completar, o sistema busca os dados públicos e preenche endereço, telefone e, se estiver vazio, o nome da loja com o nome fantasia. O que você já digitou não é trocado; confira antes de salvar.",
      "Se a busca não encontrar o CNPJ ou estiver fora do ar, preencha o endereço você mesmo.",
      "Para mudar endereço ou telefone, clique em Editar.",
      "Em Fechamento automático do caixa, escolha o horário em que o caixa esquecido aberto fecha sozinho todo dia (padrão: meia-noite). Use um horário depois do fim do expediente, por exemplo 02:00 para quem fecha de madrugada.",
      "Para excluir, clique em Excluir e confirme. As vendas, o estoque e o histórico da loja ficam guardados.",
      "Para ver as lojas excluídas, marque Mostrar as lojas excluídas, no fim da página: aparecem o endereço e a data da exclusão. Reativar traz a loja de volta com as vendas, o estoque e a equipe de antes.",
    ],
    problems: [
      {
        message: "O plano permite no máximo ... loja(s) por empresa.",
        fix: "Você atingiu o limite do plano (vale também para reativar uma loja excluída). Exclua outra loja ou fale com o suporte para mudar de plano.",
      },
      {
        message: "CNPJ inválido.",
        fix: "Confira o CNPJ da loja (pode ter letras; os dois últimos são sempre números) ou deixe o campo vazio, porque ele é opcional.",
      },
      {
        message: "Não foi possível consultar o CNPJ agora.",
        fix: "A consulta pública aceita poucas buscas por minuto. Preencha o endereço à mão ou espere um minuto.",
      },
      {
        message: "Feche o caixa da loja antes de excluí-la.",
        fix: "Entre na loja, feche o caixa em Menu › Caixa e tente de novo.",
      },
      {
        message: "Existem comandas abertas nesta loja.",
        fix: "Feche ou cancele as comandas abertas em Menu › Comandas.",
      },
    ],
    related: ["gestao-equipe", "faq-excluir-engano"],
    keywords: [
      "nova loja",
      "filial",
      "endereço",
      "cnpj da loja",
      "cnpj alfanumérico",
      "reativar loja",
      "loja excluída",
    ],
  },
  {
    id: "gestao-empresa",
    category: "gestao",
    title: "Dados da empresa",
    purpose: "Corrigir a razão social e o nome fantasia.",
    where: "Menu › Painel da empresa › Dados da empresa",
    minRole: "OWNER",
    audience: ["OWNER"],
    steps: [
      "Abra Menu › Painel da empresa › Dados da empresa.",
      "Edite a razão social ou o nome fantasia e clique em Salvar.",
      "O CNPJ não pode ser alterado depois do cadastro.",
    ],
    keywords: ["razão social", "nome fantasia", "cnpj"],
  },
  {
    id: "gestao-nova-empresa",
    category: "gestao",
    title: "Cadastrar outra empresa na mesma conta",
    purpose: "Ter mais de uma distribuidora (CNPJ) sob a mesma assinatura.",
    where: "Menu › Painel da empresa › Nova empresa",
    minRole: "OWNER",
    audience: ["OWNER"],
    steps: [
      "Abra Menu › Painel da empresa › Nova empresa. O item só aparece para o responsável pela assinatura.",
      "Digite o CNPJ (pode ter letras e números). Ao completar, o sistema busca os dados públicos e preenche a razão social e o nome fantasia; confira antes de continuar.",
      "Se a busca não encontrar a empresa, preencha a razão social e o nome fantasia você mesmo.",
      "Informe o nome da primeira loja e clique em Criar empresa. Você já entra na loja nova.",
    ],
    problems: [
      {
        message: "CNPJ inválido.",
        fix: "Algum caractere foi digitado errado: os dois últimos são sempre números. Confira no cartão CNPJ da empresa.",
      },
      {
        message: "Não foi possível consultar o CNPJ agora.",
        fix: "A consulta pública aceita poucas buscas por minuto. Preencha os dados à mão ou espere um minuto.",
      },
      {
        message: "O plano permite no máximo ... empresa(s).",
        fix: "Você chegou ao limite de empresas do plano. Fale com o suporte para mudar de plano.",
      },
      {
        message: "Este CNPJ já está cadastrado.",
        fix: "Esse CNPJ já existe no sistema. Confira se digitou certo.",
      },
    ],
    related: ["acesso-criar-conta"],
    keywords: ["segunda empresa", "novo cnpj", "cnpj alfanumérico"],
  },
  {
    id: "gestao-notificacoes",
    category: "gestao",
    title: "Notificações do sistema",
    purpose: "Ler os avisos e novidades que a equipe do sistema envia.",
    where: "Topo da tela › sino",
    minRole: null,
    audience: ["EMPLOYEE", "MANAGER", "OWNER"],
    steps: [
      "O sino no topo mostra quantos avisos você ainda não leu.",
      "Clique no sino para ver os mais recentes e em Marcar como lida para tirar o aviso do contador.",
      "Para ver todos, clique em Ver todas. Lá também dá para mostrar só as não lidas.",
    ],
    keywords: ["avisos", "novidades", "sino"],
  },
];
