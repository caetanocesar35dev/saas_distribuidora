import type { Onboarding } from "@/lib/api/types";

export interface OnboardingStep {
  key: keyof Onboarding;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/**
 * Passos do "Primeiros passos" do Início (decisão do usuário), na ordem em que fazem sentido. Os
 * links levam para onde a tarefa é feita.
 */
export function onboardingSteps(
  status: Onboarding,
  ids: { storeId: string; companyId: string },
): OnboardingStep[] {
  const store = `/loja/${ids.storeId}`;
  const company = `/empresa/${ids.companyId}`;
  return [
    {
      key: "address",
      label: "Confirmar o endereço da loja",
      hint: "Confira o que veio pela consulta do CNPJ ou preencha rua e cidade.",
      href: `${company}/lojas`,
      done: status.address,
    },
    {
      key: "products",
      label: "Cadastrar os produtos",
      hint: "Com preço e estoque, para poder vender.",
      href: `${store}/produtos/novo`,
      done: status.products,
    },
    {
      key: "cashOpened",
      label: "Abrir o caixa",
      hint: "É o que libera as vendas no PDV.",
      href: `${store}/caixa`,
      done: status.cashOpened,
    },
    {
      key: "team",
      label: "Convidar a equipe",
      hint: "Gerentes e atendentes entram com o próprio e-mail.",
      href: `${company}/equipe`,
      done: status.team,
    },
  ];
}
