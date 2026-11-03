import {
  ArrowRightIcon,
  BoxesIcon,
  ChevronDownIcon,
  ContainerIcon,
  HistoryIcon,
  ShieldCheckIcon,
  StoreIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/app/brand";
import {
  ContactChannels,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/app/contact-channels";
import { LinkButton } from "@/components/app/link-button";
import { buttonVariants } from "@/components/ui/button";
import { INSTAGRAM_URL, SALES_MESSAGE, whatsappUrl } from "@/content/contact";
import type { Plan } from "@/lib/api/types";
import { formatCents } from "@/lib/format";
import { planLimits } from "@/lib/plans";
import { cn } from "@/lib/utils";

const SIGNUP = "/cadastro";
const WHATSAPP = whatsappUrl(SALES_MESSAGE);

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ContainerIcon,
    title: "Vasilhame por cliente",
    text: "Saiba quem levou, quantos cascos deve e em qual loja. A venda já registra o empréstimo, e a devolução abate a dívida.",
  },
  {
    icon: WalletIcon,
    title: "Fiado com limite de crédito",
    text: "A dívida fica separada por loja e somada no total do cliente. Passou do limite, a venda só sai com a senha do gerente.",
  },
  {
    icon: StoreIcon,
    title: "Várias lojas, um painel",
    text: "Veja faturamento e lucro de todas as lojas juntas. Dê a cada pessoa um papel por loja ou nomeie um gerente geral.",
  },
  {
    icon: HistoryIcon,
    title: "Quem mudou o quê",
    text: "Preço, estoque, caixa e venda cancelada ficam no histórico, com o autor e a data. E o atendente nunca vê custo nem lucro.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Caixa que se cuida sozinho",
    text: "A primeira venda abre o caixa, com o saldo do último fechamento. Esqueceu aberto? Ele fecha no horário que você escolher.",
  },
  {
    icon: BoxesIcon,
    title: "Fardo e unidade na mesma venda",
    text: "Venda 2 fardos e mais 3 unidades sem fazer conta. O preço e o estoque continuam certos, sempre em unidades.",
  },
];

const ALSO = [
  "PDV com leitor de código de barras e atalhos de teclado",
  "Comandas para quem consome no local",
  "Lançamento de venda antiga, para quando a internet cair",
  "Funciona no computador, no tablet e no celular",
  "Central de Dúvidas com o passo a passo de cada tela",
];

const STEPS = [
  {
    title: "Crie a conta",
    text: "Digite o CNPJ e a razão social e o endereço vêm preenchidos pela consulta pública. Leva poucos minutos.",
  },
  {
    title: "Cadastre produtos e equipe",
    text: "Coloque preço e estoque de cada loja e convide gerentes e atendentes por e-mail.",
  },
  {
    title: "Comece a vender",
    text: "Abra o PDV e faça a primeira venda. O quadro Primeiros passos mostra o que ainda falta.",
  },
];

const FAQ = [
  {
    question: "Preciso informar cartão para testar?",
    answer:
      "Não. São 14 dias grátis, sem cartão e sem cobrança. Todos os recursos ficam liberados durante o teste.",
  },
  {
    question: "O que acontece quando o teste acaba?",
    answer:
      "Nada é apagado. O sistema fica somente para consulta até a assinatura ser feita: você continua vendo seus dados e pode fechar o caixa aberto, mas não faz vendas novas.",
  },
  {
    question: "Como faço para assinar?",
    answer:
      "Escolha o plano dentro do sistema, em Assinatura, e fale com a gente pelo WhatsApp para combinar o pagamento. O pagamento automático pela internet ainda não está disponível.",
  },
  {
    question: "O sistema emite nota fiscal?",
    answer:
      "Ainda não. Ele cuida de vendas, caixa, estoque, fiado e vasilhames, mas não emite NFC-e nem NF-e. Se a sua loja precisa emitir pelo sistema, fale com a gente antes de decidir.",
  },
  {
    question: "Funciona sem internet?",
    answer:
      "Não, o sistema precisa de internet. Se ela cair, anote as vendas e depois use Lançar venda antiga: a venda fica com a data em que aconteceu e o estoque baixa na hora do lançamento.",
  },
  {
    question: "Posso vender outros produtos além de bebidas?",
    answer:
      "Pode. Cigarro, salgadinho, gelo, carvão e outros itens são cadastrados como qualquer produto. O vasilhame é opcional, só para o que tem retorno.",
  },
  {
    question: "Posso mudar de plano ou cancelar depois?",
    answer:
      "Sim. Você troca de plano sozinho, em Assinatura, desde que as suas lojas e empresas caibam no plano novo. E pode cancelar quando quiser.",
  },
];

/** Ilustração do produto, feita em HTML: leve, nítida e sem depender de imagem. */
function ProductIllustration() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:ml-auto">
      <div className="rounded-2xl border bg-card p-5 shadow-xl shadow-primary/10 sm:pb-16">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-semibold">Bar do Zé</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            Limite: R$ 1.000,00
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">Dívida total</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">R$ 342,50</dd>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">Litrões emprestados</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">5</dd>
          </div>
        </dl>

        <ul className="mt-4 divide-y text-sm">
          <li className="flex justify-between gap-3 py-2.5">
            <span>Loja Centro</span>
            <span className="font-medium tabular-nums">R$ 262,50</span>
          </li>
          <li className="flex justify-between gap-3 py-2.5">
            <span>Loja Norte</span>
            <span className="font-medium tabular-nums">R$ 80,00</span>
          </li>
        </ul>
      </div>

      <div className="mt-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg shadow-primary/10 sm:absolute sm:-bottom-6 sm:-left-8 sm:mt-0 sm:w-64">
        <p className="font-medium">Última venda no fiado: R$ 28,00</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          2 litrões · 2 cascos para devolver
        </p>
      </div>
      <figcaption className="sr-only">
        Ilustração com dados de exemplo: a dívida e os vasilhames de um cliente, separados por loja.
      </figcaption>
    </figure>
  );
}

function Plans({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <p className="mt-8 rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Fale com a gente pelo{" "}
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="text-primary underline">
          WhatsApp
        </a>{" "}
        para conhecer os planos e os preços.
      </p>
    );
  }
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => (
        <li key={plan.id} className="flex flex-col rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">{plan.name}</h3>
          <p className="mt-3">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatCents(plan.priceInCents)}
            </span>
            <span className="text-sm text-muted-foreground"> /mês</span>
          </p>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">{planLimits(plan)}</p>
          <LinkButton href={SIGNUP} variant="outline" className="mt-5 w-full">
            Testar grátis
          </LinkButton>
        </li>
      ))}
    </ul>
  );
}

/** Página pública de apresentação (`/`). Quem já está logado é levado direto para a loja. */
export function LandingPage({ plans }: { plans: Plan[] }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Início" className="min-w-0">
            <Brand />
          </Link>
          <nav aria-label="Seções da página" className="ml-6 hidden gap-5 text-sm md:flex">
            <a href="#recursos" className="text-muted-foreground hover:text-foreground">
              Recursos
            </a>
            <a href="#planos" className="text-muted-foreground hover:text-foreground">
              Planos
            </a>
            <a href="#perguntas" className="text-muted-foreground hover:text-foreground">
              Perguntas
            </a>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <LinkButton href="/login" variant="ghost">
              Entrar
            </LinkButton>
            {/* No celular falta espaço para o nome: o botão principal vem logo abaixo. */}
            <LinkButton href={SIGNUP} className="hidden sm:inline-flex">
              Teste grátis
            </LinkButton>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-primary/10 to-background">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="text-sm font-medium text-primary">
                Para distribuidoras e depósitos de bebidas
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Saiba quem deve, em dinheiro e em vasilhame
              </h1>
              <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
                Vendas, caixa, estoque e comandas num sistema só, com o que o PDV comum não controla:
                o fiado de cada cliente e os cascos que ainda não voltaram, loja por loja.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LinkButton href={SIGNUP} size="lg" className="w-full sm:w-auto">
                  Testar grátis por 14 dias <ArrowRightIcon />
                </LinkButton>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
                >
                  <WhatsAppIcon /> Falar no WhatsApp
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Sem cartão e sem cobrança durante o teste.
              </p>
            </div>
            <ProductIllustration />
          </div>
        </section>

        <section id="recursos" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
              Feito especialmente para distribuidoras e adegas.
            </h2>
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title}>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-12 border-t pt-8">
              <h3 className="font-semibold">E também</h3>
              <ul className="mt-3 grid list-disc gap-x-8 gap-y-2 pl-5 text-sm text-muted-foreground sm:grid-cols-2">
                {ALSO.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/40 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Como começar</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="planos" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Planos</h2>
            <p className="mt-3 text-muted-foreground">
              Todos com os mesmos recursos. O que muda é o número de empresas e de lojas. Os 14 dias
              grátis valem para qualquer um.
            </p>
            <Plans plans={plans} />
            <p className="mt-6 rounded-xl bg-primary/10 px-4 py-3 text-sm">
              <strong className="font-semibold">Foi indicado por alguém?</strong> Cadastre-se com o
              código de indicação e ganhe 20% de desconto nos 2 primeiros meses depois do teste.
            </p>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-20 border-t bg-muted/40 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Perguntas frequentes</h2>
            <div className="mt-8 divide-y rounded-2xl border bg-card">
              {FAQ.map((item) => (
                <details key={item.question} className="group px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Teste na sua distribuidora por 14 dias
            </h2>
            <p className="mt-3 text-muted-foreground">
              Ficou alguma dúvida antes de começar? Fale com a gente.
            </p>
            <LinkButton href={SIGNUP} size="lg" className="mt-6">
              Criar conta grátis <ArrowRightIcon />
            </LinkButton>
            <ContactChannels message={SALES_MESSAGE} className="mx-auto mt-8 max-w-lg text-left" />
          </div>
        </section>
      </main>

      <footer className="border-t pb-24 sm:pb-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <Brand />
          <div className="flex flex-wrap gap-x-5 gap-y-2 sm:ml-auto">
            <Link href="/duvidas" className="hover:text-foreground">
              Dúvidas
            </Link>
            <Link href="/termos" className="hover:text-foreground">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <InstagramIcon className="size-4" /> Instagram
            </a>
          </div>
        </div>
      </footer>

      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        title="Falar no WhatsApp"
        className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-colors hover:bg-emerald-700"
      >
        <WhatsAppIcon className="size-7" />
      </a>
    </div>
  );
}
