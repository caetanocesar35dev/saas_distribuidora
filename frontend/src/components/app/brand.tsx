import { BeerIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        size === "lg" ? "text-2xl" : "text-lg",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BeerIcon className="size-5" />
      </span>
      {/* Em espaço estreito (menu lateral, celular), o nome quebra em duas linhas. */}
      <span className="leading-tight">Minha Distribuidora Online</span>
    </span>
  );
}
