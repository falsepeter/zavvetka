import { cn } from "@/lib/utils";

interface SeparatorProps {
  class?: string;
}

export function Separator({ class: className }: SeparatorProps) {
  return <div class={cn("h-px w-full bg-border/70", className)} role="separator" />;
}
