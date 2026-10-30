import type { Article } from "./types";

/** Artigos da área da plataforma (equipe do sistema). Aparecem em "Todos" e na busca. */
export const plataforma: Article[] = [
  {
    id: "plataforma-organizacoes",
    category: "plataforma",
    title: "Organizações e ajuste da assinatura",
    purpose:
      "Consultar os clientes do sistema e regularizar a assinatura deles à mão (cortesia, suporte).",
    where: "Menu do usuário › Área da plataforma › Organizações",
    minRole: null,
    who: "Equipe da plataforma: o administrador consulta e altera; o suporte só consulta",
    audience: [],
    steps: [
      "Abra Área da plataforma › Organizações. Use a busca (nome ou e-mail do responsável) e os filtros de situação e plano.",
      "Clique em Abrir para ver o responsável, o plano, as datas, quantos usuários têm acesso e as empresas e lojas. As lojas excluídas aparecem com a data da exclusão.",
      "Em Pessoas, veja todos que já tiveram acesso a cada empresa: quem ainda tem acesso, quem foi removido (com a data) e as contas desativadas.",
      "Em Ajustar a assinatura, mude a situação, o plano, o fim do teste ou a data de atraso e clique em Salvar ajuste.",
      'A mudança vale na hora, em todas as lojas da organização. Ao marcar "Pagamento em atraso", a data de atraso é preenchida com hoje (a carência de 5 dias conta a partir dela).',
      "Pôr a situação em Ativa conta como o primeiro pagamento: se a organização se cadastrou com um código de indicação, a indicação é confirmada e quem indicou ganha a recompensa (veja a seção Indicação, no detalhe).",
    ],
    problems: [
      {
        message: "O papel de suporte só consulta.",
        fix: "Só o administrador da plataforma altera a assinatura. Peça a ele.",
      },
    ],
    related: ["plataforma-planos", "assinatura-regularizar"],
    keywords: ["assinatura", "regularizar", "cortesia", "trial", "atraso", "cliente"],
  },
  {
    id: "plataforma-planos",
    category: "plataforma",
    title: "Planos",
    purpose: "Criar e ajustar os planos que aparecem no cadastro e seus limites.",
    where: "Menu do usuário › Área da plataforma › Planos",
    minRole: null,
    who: "Equipe da plataforma (só o administrador altera)",
    audience: [],
    steps: [
      "Abra Área da plataforma › Planos.",
      "Para criar, clique em Novo plano: nome, preço por mês e os limites de empresas e de lojas por empresa. Limite vazio é ilimitado.",
      "Para mudar, clique em Editar. A mudança vale para quem já usa o plano.",
      "Para excluir, use a lixeira. Só é possível se nenhuma organização usa o plano.",
      "Para ver os planos excluídos, marque Mostrar os planos excluídos, no fim da página. Reativar (só o administrador) faz o plano voltar a valer.",
    ],
    problems: [
      {
        message: "O plano está em uso por ... organização(ões).",
        fix: "Passe essas organizações para outro plano (em Organizações) e tente excluir de novo.",
      },
    ],
    related: ["plataforma-organizacoes"],
    keywords: ["plano", "preço", "limite", "reativar plano", "plano excluído"],
  },
  {
    id: "plataforma-usuarios",
    category: "plataforma",
    title: "Usuários",
    purpose: "Ver todas as contas do sistema e ativar ou desativar uma conta.",
    where: "Menu do usuário › Área da plataforma › Usuários",
    minRole: null,
    who: "Equipe da plataforma (só o administrador altera)",
    audience: [],
    steps: [
      "Abra Área da plataforma › Usuários e busque por nome ou e-mail.",
      "Para bloquear uma conta, clique em Desativar. A pessoa não entra mais e as sessões dela são encerradas na hora, em todas as empresas.",
      "Para liberar de novo, clique em Ativar.",
    ],
    problems: [
      {
        message: "Você não pode desativar o próprio usuário.",
        fix: "Peça a outro administrador da plataforma.",
      },
    ],
    keywords: ["desativar", "bloquear", "conta", "usuário"],
  },
  {
    id: "plataforma-notificacoes",
    category: "plataforma",
    title: "Notificações para os usuários",
    purpose: "Enviar avisos e novidades que aparecem no sino de todos os usuários.",
    where: "Menu do usuário › Área da plataforma › Notificações",
    minRole: null,
    who: "Equipe da plataforma (só o administrador altera)",
    audience: [],
    steps: [
      "Abra Área da plataforma › Notificações e clique em Nova notificação.",
      "Escreva o título e a mensagem e escolha o tipo (novidade, atualização, manutenção ou aviso).",
      "Em Publicar em, deixe vazio para publicar agora ou escolha uma data futura para agendar.",
      "Em Expira em, escolha quando ela deve sumir. Vazio = nunca expira.",
      "A lista mostra quantas pessoas já leram cada notificação.",
    ],
    problems: [
      {
        message: "A data de expiração precisa ser depois da data de publicação.",
        fix: "Corrija as datas: a expiração vem depois da publicação.",
      },
    ],
    related: ["gestao-notificacoes"],
    keywords: ["aviso", "novidade", "manutenção", "agendar"],
  },
  {
    id: "plataforma-indicacoes",
    category: "plataforma",
    title: "Indicações, representantes e comissões",
    purpose:
      "Acompanhar quem indicou quem, cadastrar representantes, pagar as comissões e ver os descontos dos clientes.",
    where:
      "Menu do usuário › Área da plataforma › Indicações (painel) e Representantes (cadastro)",
    minRole: null,
    who: "Equipe da plataforma: o administrador consulta e altera; o suporte só consulta",
    audience: [],
    steps: [
      "Há dois jeitos de indicar: um cliente (responsável pela assinatura) indica pelo código dele, em Indique e ganhe; um representante (não usa o sistema) indica com o código que você cadastra para ele.",
      "Para cadastrar um representante, abra Representantes › Novo representante: nome, telefone, chave Pix, comissão (% da primeira mensalidade do plano que o indicado assinar) e, se quiser, um código próprio (ex.: JOAO-REP). Sem código, o sistema cria um.",
      "Quem se cadastra com qualquer código ganha 20% de desconto nos 2 primeiros meses depois do teste. A recompensa de quem indicou só vale quando o indicado paga a primeira mensalidade.",
      'Enquanto não existe o pagamento automático, "pagou" é quando você põe a situação da organização em Ativa (Organizações › Abrir › Ajustar a assinatura). Nesse momento a indicação vira Confirmada: o cliente que indicou ganha 2 meses de desconto (acumulando até 12) e a comissão do representante é calculada pelo plano atual do indicado.',
      "Em Indicações, o painel mostra os totais, quanto falta pagar de comissão, os representantes, os clientes que mais indicam e as organizações com desconto a usar. Embaixo, Todas as indicações mostra onde cada código foi usado, com filtros por situação, origem, representante e comissão.",
      "Depois de mandar o Pix ao representante, clique em Pix enviado na indicação (dá para anotar o id da transação). A comissão passa para Já pago.",
      "Conta duplicada ou fraude: clique no ícone de cancelar na indicação e informe o motivo. Os meses de desconto não usados deixam de valer e o representante não recebe. Comissão já paga não pode ser cancelada.",
      "Excluir um representante faz o código dele parar de valer no cadastro; as indicações dele continuam no painel. Para reativar, marque Mostrar os representantes excluídos.",
      "No detalhe de cada organização, a seção Indicação mostra quem a indicou, o código dela, quantas ela indicou e os meses de desconto a usar.",
    ],
    problems: [
      {
        message: "O código ... já está em uso.",
        fix: "Cada código é único entre clientes e representantes (inclusive os excluídos). Escolha outro.",
      },
      {
        message: "A comissão só vale quando o indicado paga a 1ª mensalidade.",
        fix: "Ponha a organização indicada em Ativa quando ela pagar; depois marque o Pix.",
      },
    ],
    related: ["plataforma-organizacoes", "assinatura-indique-e-ganhe"],
    keywords: ["indicação", "representante", "comissão", "pix", "cupom", "desconto", "código"],
  },
];
