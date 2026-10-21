"use client";

import { AlertTriangleIcon, InfoIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useAccess } from "@/lib/session/context";
import { subscriptionNotice } from "@/lib/subscription";
import { cn } from "@/lib/utils";

/**
 * Faixa de aviso da assinatura: teste acabando, pagamento pendente (carência) ou somente leitura.
 * Inadimplência nunca bloqueia o sistema inteiro: o pior caso é consultar tudo e fechar o caixa.
 */
export function SubscriptionBanner() {
  const { subscription, isBillingOwner, companyId } = useAccess();
  const notice = subscriptionNotice(subscription);
  if (!notice) return null;

  const Icon =
    notice.tone === "danger" ? LockIcon : notice.tone === "warning" ? AlertTriangleIcon : InfoIcon;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm",
        notice.tone === "danger" && "bg-destructive/10 text-destructive",
        notice.tone === "warning" && "bg-amber-100 text-amber-900",
        notice.tone === "info" && "bg-sky-50 text-sky-900",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>
        <strong className="font-semibold">{notice.title}.</strong> {notice.description}
      </span>
      {notice.tone !== "info" &&
        (isBillingOwner ? (
          <Link
            href={`/empresa/${companyId}/assinatura`}
            className="font-medium underline"
          >
            Como regularizar
          </Link>
        ) : (
          <span className="opacity-80">Fale com o responsável pela assinatura.</span>
        ))}
    </div>
  );
}
