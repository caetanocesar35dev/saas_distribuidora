"use client";

import { FormField } from "@/components/app/form";
import { MoneyInput } from "@/components/app/inputs";
import { moneyToInput, packWithArticle } from "@/lib/format";
import { defaultUnitPrice, type PriceDraft } from "@/lib/pack-pricing";

/**
 * Preço e custo de um produto numa loja. Sem embalagem: preço e custo da unidade. Com embalagem:
 * preço dela, preço da unidade (vazio = calculado) e custo dela.
 */
export function PriceFields({
  idPrefix,
  packSize,
  packName,
  value,
  onChange,
  suffix = "",
  fallback,
  autoFocus,
}: {
  idPrefix: string;
  packSize: number;
  packName: string | null | undefined;
  value: PriceDraft;
  onChange: (patch: Partial<PriceDraft>) => void;
  /** Completa o nome dos campos: " padrão", " nesta loja". */
  suffix?: string;
  /** Valores padrão do formulário, mostrados no campo vazio. */
  fallback?: PriceDraft;
  autoFocus?: boolean;
}) {
  const placeholder = (amount: number | undefined) =>
    amount === undefined ? "0,00" : moneyToInput(amount);

  if (packSize <= 1) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={`Preço de venda${suffix}`} htmlFor={`${idPrefix}-unit`}>
          <MoneyInput
            id={`${idPrefix}-unit`}
            value={value.unitPrice}
            placeholder={placeholder(fallback?.unitPrice)}
            onChange={(unitPrice) => onChange({ unitPrice })}
            autoFocus={autoFocus}
          />
        </FormField>
        <FormField label={`Custo${suffix}`} htmlFor={`${idPrefix}-cost`}>
          <MoneyInput
            id={`${idPrefix}-cost`}
            value={value.cost}
            placeholder={placeholder(fallback?.cost)}
            onChange={(cost) => onChange({ cost })}
          />
        </FormField>
      </div>
    );
  }

  const withArticle = packWithArticle(packName);
  const packPrice = value.packPrice ?? fallback?.packPrice;
  const unitPrice = value.unitPrice ?? fallback?.unitPrice;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField
        label={`Preço ${withArticle}${suffix}`}
        htmlFor={`${idPrefix}-pack`}
        hint={`Com ${packSize} unidades. Vazio: preço da unidade × ${packSize}.`}
      >
        <MoneyInput
          id={`${idPrefix}-pack`}
          value={value.packPrice}
          placeholder={placeholder(
            fallback?.packPrice ?? (unitPrice === undefined ? undefined : unitPrice * packSize),
          )}
          onChange={(next) => onChange({ packPrice: next })}
          autoFocus={autoFocus}
        />
      </FormField>
      <FormField
        label={`Preço da unidade${suffix}`}
        htmlFor={`${idPrefix}-unit`}
        hint={`Vazio: preço ${withArticle} ÷ ${packSize}. Preencha se a unidade avulsa for mais cara.`}
      >
        <MoneyInput
          id={`${idPrefix}-unit`}
          value={value.unitPrice}
          placeholder={placeholder(
            fallback?.unitPrice ??
              (packPrice === undefined ? undefined : defaultUnitPrice(packPrice, packSize)),
          )}
          onChange={(next) => onChange({ unitPrice: next })}
        />
      </FormField>
      <FormField
        label={`Custo ${withArticle}${suffix}`}
        htmlFor={`${idPrefix}-cost`}
        hint="Quanto você paga pela embalagem. O custo da unidade é calculado."
      >
        <MoneyInput
          id={`${idPrefix}-cost`}
          value={value.cost}
          placeholder={placeholder(fallback?.cost)}
          onChange={(cost) => onChange({ cost })}
        />
      </FormField>
    </div>
  );
}
