"use client";

import { GiftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOrganizations } from "@/lib/api/hooks/admin";
import { useOrganizationReferral } from "@/lib/api/hooks/referrals";
import { DISCOUNT_REASON_LABEL, discountText } from "@/lib/referral";

/**
 * Selo ao lado do sino: aparece para o responsável pela assinatura quando ele tem meses de desconto
 * por indicação (decisão do usuário: um lugar simples de ver que há desconto para usar).
 */
export function DiscountBadge() {
  const organizations = useOrganizations();
  const owned = organizations.data?.filter((o) => o.isBillingOwner) ?? [];
  return (
    <>
      {owned.map((org) => (
        <OrganizationDiscountBadge
          key={org.id}
          organizationId={org.id}
          name={owned.length > 1 ? org.name : null}
        />
      ))}
    </>
  );
}

function OrganizationDiscountBadge({
  organizationId,
  name,
}: {
  organizationId: string;
  name: string | null;
}) {
  const [open, setOpen] = useState(false);
  const referral = useOrganizationReferral(organizationId);
  const data = referral.data;
  if (!data || data.remainingMonths <= 0) return null;
  const percent = data.discounts.find((d) => d.remaining > 0)?.percent ?? data.rules.discountPercent;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Desconto na mensalidade"
            className="gap-1 text-emerald-700 dark:text-emerald-400"
          />
        }
      >
        <GiftIcon />
        <span className="text-xs font-semibold">-{percent}%</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">
          Desconto na mensalidade{name ? ` · ${name}` : ""}
        </div>
        <div className="space-y-2 px-3 py-3 text-sm">
          <p>
            Você tem <strong>{discountText(data.remainingMonths, percent)}</strong> para usar nas
            próximas mensalidades.
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {data.discounts
              .filter((d) => d.remaining > 0)
              .map((d) => (
                <li key={d.id}>
                  {DISCOUNT_REASON_LABEL[d.reason]}
                  {d.from ? ` (${d.from})` : ""}: {d.remaining}{" "}
                  {d.remaining === 1 ? "mês" : "meses"}
                </li>
              ))}
          </ul>
        </div>
        <Link
          href="/indique"
          onClick={() => setOpen(false)}
          className="block border-t px-3 py-2 text-center text-sm text-primary hover:bg-muted/50"
        >
          Indique e ganhe mais
        </Link>
      </PopoverContent>
    </Popover>
  );
}
