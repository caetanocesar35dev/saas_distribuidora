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
      "Clique em Abrir para ver o responsável, o plano, as datas, quantos usuários têm acesso e as empresas e lojas.",
      "Em Ajustar a assinatura, mude a situação, o plano, o fim do teste ou a data de atraso e clique em Salvar ajuste.",
      'A mudança vale na hora, em todas as lojas da organização. Ao marcar "Pagamento em atraso", a data de atraso é preenchida com hoje (a carência de 5 dias conta a partir dela).',
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
    ],
    problems: [
      {
        message: "O plano está em uso por ... organização(ões).",
        fix: "Passe essas organizações para outro plano (em Organizações) e tente excluir de novo.",
      },
    ],
    related: ["plataforma-organizacoes"],
    keywords: ["plano", "preço", "limite"],
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
];
