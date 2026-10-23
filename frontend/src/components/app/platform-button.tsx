"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlatform } from "@/lib/session/platform";

type ButtonProps = React.ComponentProps<typeof Button>;

/** Botão de escrita da plataforma: o SUPPORT só consulta, então fica apagado para ele. */
export function PlatformActionButton({ disabled, children, ...props }: ButtonProps) {
  const { canWrite } = usePlatform();
  if (canWrite) {
    return (
      <Button disabled={disabled} {...props}>
        {children}
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" tabIndex={0} />}>
        <Button {...props} disabled>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        O papel de suporte só consulta. Só o administrador da plataforma pode alterar.
      </TooltipContent>
    </Tooltip>
  );
}
