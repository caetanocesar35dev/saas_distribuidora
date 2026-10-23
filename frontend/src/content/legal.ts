/**
 * Termos de uso e política de privacidade (LGPD), mostrados em /termos e /privacidade e aceitos
 * no cadastro.
 *
 * ⚠️ É um MODELO: preencha os dados de quem opera o sistema nas variáveis `LEGAL_*` do ambiente
 * (ver `.env.example`) e peça a revisão de um advogado antes de usar com clientes de verdade.
 *
 * Só para componentes do servidor (as páginas /termos e /privacidade): as variáveis não são
 * `NEXT_PUBLIC_`, então no navegador viriam vazias.
 *
 * Mudou o texto? Troque `TERMS_VERSION` aqui **e** em `backend/src/auth/terms.ts` (precisam ser
 * iguais: é a versão gravada no aceite de cada conta).
 */
import { formatCnpj } from "@/lib/format";

export const TERMS_VERSION = "2026-10-21";
export const TERMS_UPDATED_AT = "21/10/2026";

export interface LegalOperator {
  name: string;
  cnpj: string;
  email: string;
  forum: string;
}

const env = (key: string, placeholder: string) => process.env[key]?.trim() || placeholder;

/**
 * Quem opera o sistema, lido do ambiente na hora de montar a página. Variável não preenchida
 * aparece entre colchetes, para ficar claro que falta.
 */
export function legalOperator(): LegalOperator {
  const cnpj = process.env.LEGAL_OPERATOR_CNPJ?.trim();
  return {
    name: env("LEGAL_OPERATOR_NAME", "[NOME DA EMPRESA RESPONSÁVEL PELO SISTEMA]"),
    cnpj: cnpj ? formatCnpj(cnpj) : "[CNPJ]",
    email: env("LEGAL_CONTACT_EMAIL", "[E-MAIL DE CONTATO E DO ENCARREGADO DE DADOS]"),
    forum: env("LEGAL_FORUM", "[CIDADE/UF]"),
  };
}

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

/** Termos de uso com os dados do operador lidos do ambiente. */
export function termsSections(op = legalOperator()): LegalSection[] {
  return [
    {
      title: "1. O que é o serviço",
      paragraphs: [
        `Este sistema é oferecido por ${op.name} (CNPJ ${op.cnpj}) para distribuidoras de bebidas controlarem vendas (PDV), estoque, caixa, comandas, vasilhames e vendas a prazo (fiado), em uma ou mais lojas.`,
        "Ao criar uma conta, você declara que leu e aceita estes termos e a Política de Privacidade, e que tem poderes para representar a distribuidora cadastrada.",
      ],
    },
    {
      title: "2. Conta e acesso",
      paragraphs: [
        "Você é responsável pelos dados informados no cadastro (nome, e-mail, CNPJ, razão social) e por mantê-los corretos.",
        "A senha é pessoal. Quem tem a conta de dono convida a equipe e define o papel de cada pessoa (dono, gerente ou atendente) em cada loja, e responde pelo uso que a equipe faz do sistema.",
        "Avise-nos imediatamente se suspeitar de uso indevido da sua conta. Você pode encerrar as sessões de todos os aparelhos em Minha conta.",
      ],
    },
    {
      title: "3. Teste grátis e assinatura",
      paragraphs: [
        "A conta começa com 14 dias de teste grátis, sem cartão. Depois, o uso depende do pagamento da assinatura do plano escolhido.",
        "Se o teste acabar ou a mensalidade ficar em atraso por mais de 5 dias, o sistema não é bloqueado: passa a funcionar somente para consulta. Continua sendo possível ver todos os dados, fechar o caixa já aberto e pagar a assinatura. O acesso completo volta assim que o pagamento for confirmado.",
        "Os valores e limites de cada plano (quantidade de empresas e de lojas) são os informados no momento da contratação.",
      ],
    },
    {
      title: "4. Dados dos seus clientes",
      paragraphs: [
        "Os dados que você cadastra sobre os clientes da distribuidora (nome, telefone, compras e dívidas) são de sua responsabilidade. Em relação a eles, a distribuidora é a controladora e nós somos operadores: tratamos esses dados só para prestar o serviço, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).",
        "Cadastre apenas os dados necessários e tenha base legal para tratá-los (por exemplo, para registrar uma venda a prazo combinada com o cliente).",
      ],
    },
    {
      title: "5. Uso adequado",
      paragraphs: [
        "Não é permitido usar o sistema para fins ilegais, tentar acessar dados de outras empresas, contornar limites de acesso ou sobrecarregar o serviço.",
        "O sistema não emite nota fiscal nem substitui as obrigações fiscais e contábeis da distribuidora.",
      ],
    },
    {
      title: "6. Disponibilidade e responsabilidade",
      paragraphs: [
        "Trabalhamos para manter o serviço disponível e os dados seguros, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros (internet, hospedagem).",
        "Não respondemos por prejuízos causados por dados informados de forma incorreta, uso indevido das contas da sua equipe ou falta de conexão com a internet no local de uso.",
      ],
    },
    {
      title: "7. Encerramento",
      paragraphs: [
        "Você pode cancelar a assinatura quando quiser. Os registros financeiros e o histórico de alterações são mantidos pelo prazo exigido em lei, conforme a Política de Privacidade.",
        "Podemos suspender contas que violem estes termos, avisando o responsável pela assinatura.",
      ],
    },
    {
      title: "8. Alterações e foro",
      paragraphs: [
        "Estes termos podem mudar. Quando isso acontecer, avisaremos no sistema e a nova versão valerá a partir da data indicada.",
        `Fica eleito o foro da comarca de ${op.forum} para resolver questões sobre estes termos. Dúvidas: ${op.email}.`,
      ],
    },
  ];
}

/** Política de privacidade com os dados do operador lidos do ambiente. */
export function privacySections(op = legalOperator()): LegalSection[] {
  return [
    {
      title: "1. Quem somos",
      paragraphs: [
        `${op.name} (CNPJ ${op.cnpj}) é a controladora dos dados das contas de acesso ao sistema e operadora dos dados que cada distribuidora cadastra sobre os próprios clientes. Contato do encarregado de dados (LGPD): ${op.email}.`,
      ],
    },
    {
      title: "2. Quais dados tratamos",
      paragraphs: [
        "Conta de acesso: nome, e-mail, senha (guardada só em forma criptografada, que nem nós conseguimos ler), papel em cada loja e data de aceite destes termos.",
        "Distribuidora e lojas: CNPJ, razão social, nome fantasia, endereço e telefone das lojas.",
        "Clientes da distribuidora: nome, telefone, compras, dívidas de fiado e vasilhames emprestados, cadastrados pela própria distribuidora.",
        "Operação: vendas, caixa, estoque e o histórico de alterações (quem mudou o quê e quando), usado para auditoria.",
        "Dados técnicos: endereço IP e data dos acessos (para segurança e para limitar tentativas de login) e cookies de sessão.",
      ],
    },
    {
      title: "3. Para que usamos",
      paragraphs: [
        "Para prestar o serviço contratado (execução de contrato), cumprir obrigações legais, garantir a segurança das contas e prevenir fraudes (legítimo interesse) e enviar e-mails do próprio sistema, como redefinição de senha e convites.",
        "Não vendemos dados e não os usamos para publicidade.",
      ],
    },
    {
      title: "4. Com quem compartilhamos",
      paragraphs: [
        "Com fornecedores necessários para o serviço funcionar: hospedagem e banco de dados, envio de e-mails e, quando houver, o processador de pagamentos da assinatura (os dados do cartão são digitados direto no processador e nunca passam pelo nosso sistema).",
        "Ao digitar um CNPJ no cadastro ou nas lojas, o seu navegador consulta um serviço público de CNPJ (publica.cnpj.ws) para preencher razão social, nome fantasia e endereço. Só o CNPJ é enviado.",
        "Com autoridades, quando exigido por lei ou ordem judicial.",
      ],
    },
    {
      title: "5. Cookies",
      paragraphs: [
        "Usamos apenas cookies essenciais para manter você conectado com segurança. Eles não podem ser lidos por scripts da página e não são usados para rastreamento ou publicidade. O navegador também guarda preferências locais, como a última loja aberta.",
      ],
    },
    {
      title: "6. Por quanto tempo guardamos",
      paragraphs: [
        "Enquanto a conta estiver ativa. Registros financeiros, de vendas e o histórico de alterações são mantidos pelo prazo exigido pela legislação fiscal e para defesa em processos (em geral, 5 anos). Depois disso, os dados são eliminados ou anonimizados.",
        "Por segurança e auditoria, um registro excluído no sistema é marcado como excluído e deixa de aparecer, mas continua guardado até o fim desse prazo.",
      ],
    },
    {
      title: "7. Seus direitos",
      paragraphs: [
        "Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização ou eliminação do que for desnecessário, portabilidade, informação sobre compartilhamentos e revogação do consentimento, nos termos do art. 18 da LGPD.",
        `Pedidos sobre dados de clientes de uma distribuidora devem ser feitos primeiro à própria distribuidora, que é a controladora; nós a apoiamos no atendimento. Para os demais, escreva para ${op.email}.`,
      ],
    },
    {
      title: "8. Segurança",
      paragraphs: [
        "Senhas criptografadas, conexão segura (HTTPS), sessões que expiram, cada empresa enxergando só os próprios dados e cada pessoa só o que o seu papel permite, além do registro de todas as alterações.",
        "Se houver um incidente de segurança que possa causar risco relevante, avisaremos os afetados e a Autoridade Nacional de Proteção de Dados (ANPD), como manda a lei.",
      ],
    },
    {
      title: "9. Alterações",
      paragraphs: [
        "Esta política pode ser atualizada. A data da versão em vigor fica no topo da página, e mudanças importantes serão avisadas no sistema.",
      ],
    },
  ];
}
