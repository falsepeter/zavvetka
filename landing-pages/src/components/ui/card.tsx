import type { JSX } from "preact";
import { cn } from "@/lib/utils";

type CardProps = JSX.HTMLAttributes<HTMLElement>;
type CardHeaderProps = JSX.HTMLAttributes<HTMLElement>;
type CardTitleProps = JSX.HTMLAttributes<HTMLHeadingElement>;
type CardDescriptionProps = JSX.HTMLAttributes<HTMLParagraphElement>;
type CardContentProps = JSX.HTMLAttributes<HTMLDivElement>;

export function Card({ class: className, children, ...props }: CardProps) {
  return (
    <article
      {...props}
      class={cn(
        "rounded-xl border border-border/70 bg-card/90 text-card-foreground shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function CardHeader({
  class: className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <header {...props} class={cn("p-6 pb-2", className)}>
      {children}
    </header>
  );
}

export function CardTitle({
  class: className,
  children,
  ...props
}: CardTitleProps) {
  return (
    <h3
      {...props}
      class={cn("font-display text-lg font-semibold tracking-tight", className)}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  class: className,
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <p {...props} class={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function CardContent({
  class: className,
  children,
  ...props
}: CardContentProps) {
  return (
    <div {...props} class={cn("p-6 pt-2", className)}>
      {children}
    </div>
  );
}
