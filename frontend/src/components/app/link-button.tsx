import type { VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

/** Link com a aparência de um botão. */
export function LinkButton({ variant, size, className, ...props }: Props) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
