import type { ComponentChildren } from "preact";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded rounded-sm border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  class?: string;
  children: ComponentChildren;
}

export function Badge({ class: className, variant, children }: BadgeProps) {
  return (
    <span class={cn(badgeVariants({ variant }), className)}>{children}</span>
  );
}
