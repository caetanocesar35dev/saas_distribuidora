"use client";

import { LockIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Role } from "@/lib/api/types";
import { hasMinRole, ROLE_LABEL } from "@/lib/format";
import { useAccess } from "@/lib/session/context";

/** Mostra o conteúdo só para quem tem pelo menos o papel `min` (esconder botão é UX, não segurança). */
export function RequireRole({
  min,
  children,
  fallback = null,
}: {
  min: Role;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role } = useAccess();
  return hasMinRole(role, min) ? <>{children}</> : <>{fallback}</>;
}

export function RequireCompanyOwner({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isCompanyOwner } = useAccess();
  return isCompanyOwner ? <>{children}</> : <>{fallback}</>;
}

export function NoPermission({ min }: { min: Role }) {
  const who = min === "OWNER" ? "ao dono" : "ao gerente";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <LockIcon className="size-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Você não tem permissão para ver esta página</h2>
      <p className="text-sm text-muted-foreground">
        Esta área é para {ROLE_LABEL[min].toLowerCase()} ou acima. Peça {who} se precisar de
        acesso.
      </p>
    </div>
  );
}

/** Protege uma página inteira pelo papel mínimo. */
export function PageGuard({
  min,
  children,
}: {
  min: Role;
  children: ReactNode;
}) {
  return (
    <RequireRole min={min} fallback={<NoPermission min={min} />}>
      {children}
    </RequireRole>
  );
}

export function RequireCompanyOwnerPage({ children }: { children: ReactNode }) {
  return (
    <RequireCompanyOwner fallback={<NoPermission min="OWNER" />}>
      {children}
    </RequireCompanyOwner>
  );
}

/**
 * Estado de uma ação de escrita: desabilitada em modo somente leitura ou sem o papel exigido, com o
 * motivo para mostrar ao usuário. `allowWhenReadOnly` é só para fechar o caixa já aberto.
 */
export function useActionState(options: {
  minRole?: Role;
  allowWhenReadOnly?: boolean;
}): { blocked: boolean; reason: string | null } {
  const { role, readOnly, readOnlyMessage } = useAccess();
  if (options.minRole && !hasMinRole(role, options.minRole)) {
    return {
      blocked: true,
      reason: `Só ${ROLE_LABEL[options.minRole].toLowerCase()} ou acima pode fazer isso.`,
    };
  }
  if (readOnly && !options.allowWhenReadOnly) {
    return { blocked: true, reason: readOnlyMessage };
  }
  return { blocked: false, reason: null };
}

type ButtonProps = React.ComponentProps<typeof Button>;

/** Botão que se apaga sozinho em somente leitura / sem permissão, explicando o motivo. */
export function ActionButton({
  minRole,
  allowWhenReadOnly,
  disabled,
  children,
  ...props
}: ButtonProps & { minRole?: Role; allowWhenReadOnly?: boolean }) {
  const { blocked, reason } = useActionState({ minRole, allowWhenReadOnly });
  if (!blocked) {
    return (
      <Button disabled={disabled} {...props}>
        {children}
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex" tabIndex={0} />}
      >
        <Button {...props} disabled>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{reason}</TooltipContent>
    </Tooltip>
  );
}
