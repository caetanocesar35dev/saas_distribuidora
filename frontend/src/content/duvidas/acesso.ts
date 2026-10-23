import type { Article } from "./types";

export const acesso: Article[] = [
  {
    id: "acesso-entrar",
    category: "acesso",
    title: "Entrar no sistema",
    purpose: "Acessar sua conta com o e-mail e a senha.",
    where: "Tela inicial › Entrar",
    minRole: null,
    audience: ["EMPLOYEE", "MANAGER", "OWNER"],
    steps: [
      "Abra o endereço do sistema no navegador.",
      "Digite o e-mail e a senha da sua conta.",
      "Clique em Entrar.",
      "Se você trabalha em mais de uma loja, escolha a loja. Se tiver só uma, o sistema já abre nela.",
    ],
    problems: [
      {
        message: "E-mail ou senha incorretos.",
        fix: 'Confira se não há espaço sobrando e se o Caps Lock está desligado. Se não lembrar a senha, use "Esqueci a senha".',
      },
      {
        message: "Muitas tentativas em pouco tempo.",
        fix: "Aguarde um minuto e tente de novo. É uma proteção contra tentativas de invadir contas.",
      },
      {
        message: "Você ainda não tem acesso a nenhuma loja.",
        fix: "Peça ao dono da distribuidora para convidar você pelo seu e-mail.",
      },
    ],
    related: ["acesso-esqueci-senha", "acesso-trocar-loja", "acesso-criar-conta"],
    keywords: ["login", "senha", "acessar", "logar"],
  },
  {
    id: "acesso-criar-conta",
    category: "acesso",
    title: "Criar uma conta para a sua distribuidora",
    purpose:
      "Começar a usar o sistema: cria sua conta, a distribuidora e a primeira loja, com 14 dias de teste grátis.",
    where: "Tela inicial › Criar conta",
    minRole: null,
    audience: ["OWNER"],
    steps: [
      "Na tela de entrada, clique em Criar conta.",
      "Preencha seu nome, e-mail e uma senha de pelo menos 8 caracteres.",
      "Digite o CNPJ da distribuidora. Ele pode ter letras e números (CNPJ alfanumérico); a pontuação entra sozinha.",
      "Ao completar o CNPJ, o sistema busca os dados públicos da empresa e preenche a razão social e o nome fantasia. Confira e corrija se precisar. O que você já tiver digitado não é trocado.",
      "Se a busca não encontrar a empresa ou estiver fora do ar, preencha a razão social e o nome fantasia você mesmo.",
      "Informe o nome da primeira loja e escolha o plano.",
      "Leia os Termos de uso e a Política de privacidade (os links abrem em outra aba) e marque Li e aceito. Sem esse aceite a conta não é criada.",
      "Clique em Criar conta e começar.",
    ],
    problems: [
      {
        message: "CNPJ inválido.",
        fix: "Algum caractere foi digitado errado: os dois últimos são sempre números (dígitos verificadores). Confira no cartão CNPJ da empresa.",
      },
      {
        message: "Para criar a conta, aceite os termos de uso e a política de privacidade.",
        fix: "Marque a caixa Li e aceito, logo acima do botão Criar conta e começar.",
      },
      {
        message: "CNPJ não encontrado na consulta pública.",
        fix: "Empresas abertas há pouco tempo podem ainda não aparecer na consulta. Preencha a razão social e o nome fantasia à mão; o cadastro funciona normalmente.",
      },
      {
        message: "Não foi possível consultar o CNPJ agora.",
        fix: "A consulta pública aceita poucas buscas por minuto. Preencha os dados à mão ou espere um minuto e digite o CNPJ de novo.",
      },
      {
        message: "Este CNPJ já está cadastrado.",
        fix: "A distribuidora já tem conta no sistema. Peça ao dono dela para convidar você pelo seu e-mail.",
      },
    ],
    related: ["acesso-entrar", "gestao-nova-empresa"],
    keywords: [
      "cadastro",
      "criar conta",
      "cnpj",
      "cnpj alfanumérico",
      "razão social",
      "nome fantasia",
      "teste grátis",
      "termos de uso",
      "privacidade",
      "lgpd",
    ],
  },
  {
    id: "acesso-esqueci-senha",
    category: "acesso",
    title: "Esqueci a senha",
    purpose: "Criar uma senha nova quando você não lembra a atual.",
    where: "Tela inicial › Entrar › Esqueci a senha",
    minRole: null,
    audience: ["EMPLOYEE", "MANAGER", "OWNER"],
    steps: [
      'Na tela de entrar, clique em "Esqueci a senha".',
      "Digite o e-mail da sua conta e clique em Enviar link.",
      "Abra o e-mail que chegou (veja também a caixa de spam) e clique no link.",
      "Digite a senha nova duas vezes e salve. Depois é só entrar.",
    ],
    problems: [
      {
        message: "O link não funciona ou expirou.",
        fix: 'O link vale por 30 minutos e só funciona uma vez. Peça um novo em "Esqueci a senha".',
      },
    ],
    related: ["acesso-email-nao-chegou", "acesso-entrar"],
    keywords: ["redefinir", "recuperar", "trocar senha", "perdi a senha"],
  },
  {
    id: "acesso-email-nao-chegou",
    category: "acesso",
    title: "Não recebi o e-mail de redefinição de senha",
    purpose: "O que fazer quando o e-mail com o link não chega.",
    where: "Tela inicial › Entrar › Esqueci a senha",
    minRole: null,
    audience: ["EMPLOYEE", "MANAGER", "OWNER"],
    steps: [
      "Espere alguns minutos e olhe também a caixa de spam ou lixo eletrônico.",
      "Confira se digitou o e-mail exatamente como foi cadastrado.",
      'Peça o link de novo em "Esqueci a senha". Cada pedido gera um link novo e o anterior deixa de valer.',
      "Se continuar sem chegar, peça ao dono para conferir o seu e-mail em Menu › Empresa › Equipe.",
    ],
    problems: [
      {
        message: "Se o e-mail estiver cadastrado, enviaremos as instruções.",
        fix: "É a resposta padrão, igual para qualquer e-mail, por segurança. Ela não confirma se o e-mail existe.",
      },
    ],
    related: ["acesso-esqueci-senha"],
    keywords: ["email", "spam", "link"],
  },
  {
    id: "acesso-convite",
    category: "acesso",
    title: "Recebi um convite para a equipe",
    purpose: "Criar sua primeira senha e entrar na distribuidora que convidou você.",
    where: "Link no e-mail do convite",
    minRole: null,
    audience: ["EMPLOYEE", "MANAGER"],
    steps: [
      "Abra o e-mail do convite e clique no link.",
      "Escolha uma senha com pelo menos 8 caracteres e repita.",
      "Salve e vá para Entrar, usando o mesmo e-mail que recebeu o convite.",
      "Se você já tinha conta, o convite só libera o acesso à nova empresa: entre normalmente.",
    ],
    problems: [
      {
        message: "O link do convite expirou.",
        fix: 'O convite vale por 7 dias. Use "Esqueci a senha" com o mesmo e-mail para receber um link novo.',
      },
    ],
    related: ["acesso-entrar", "gestao-equipe"],
    keywords: ["convidar", "primeira senha", "equipe", "funcionário"],
  },
  {
    id: "acesso-trocar-loja",
    category: "acesso",
    title: "Trocar de empresa ou de loja",
    purpose: "Passar para outra loja sem sair da conta.",
    where: "Topo da tela › nome da loja",
    minRole: null,
    audience: ["EMPLOYEE", "MANAGER", "OWNER"],
    steps: [
      "Clique no nome da loja, no topo da tela.",
      "Escolha a empresa e a loja na lista. O seu papel em cada loja aparece ao lado.",
      'Para ver tudo de uma vez, escolha "Ver todas as empresas e lojas".',
    ],
    problems: [
      {
        message: "Você não tem acesso a esta loja.",
        fix: "O seu acesso a essa loja foi retirado ou o endereço está errado. Escolha outra loja ou peça ao dono para liberar.",
      },
    ],
    related: ["acesso-entrar"],
    keywords: ["loja", "empresa", "mudar", "trocar"],
  },
  {
    id: "acesso-minha-conta",
    category: "acesso",
    title: "Minha conta: nome, senha e aparelhos",
    purpose: "Alterar seu nome, trocar a senha e sair de todos os aparelhos.",
    where: "Topo da tela › seu perfil (círculo com as iniciais) › Minha conta",
    minRole: null,
    audience: ["EMPLOYEE", "MANAGER", "OWNER"],
    steps: [
      "Clique no círculo com as suas iniciais, no canto do topo, e escolha Minha conta.",
      "Para mudar o nome, edite o campo e clique em Salvar nome.",
      "Para trocar a senha, digite a atual e a nova duas vezes. Você continua conectado neste aparelho e é desconectado dos outros.",
      "Para sair de todos os aparelhos (por exemplo, se perdeu o celular), clique em Sair de todos os aparelhos.",
    ],
    problems: [
      {
        message: "Senha atual incorreta.",
        fix: 'Digite a senha que você usa hoje. Se não lembra, saia e use "Esqueci a senha".',
      },
    ],
    related: ["acesso-esqueci-senha"],
    keywords: ["perfil", "senha", "sair", "logout", "aparelhos"],
  },
];
