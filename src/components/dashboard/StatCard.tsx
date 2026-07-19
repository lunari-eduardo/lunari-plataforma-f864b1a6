import { Link } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  subtitle?: string;
  href?: string;
  tone?: "default" | "success";
}

/**
 * Card de estatística do dashboard — fidelidade com mockup.
 * Ícone circular soft à esquerda, número grande, label e subtítulo empilhados.
 * Seta chevron aparece no hover / mobile.
 */
export function StatCard({
  icon: Icon,
  value,
  label,
  subtitle,
  href,
  tone = "default",
}: StatCardProps) {
  const content = (
    <Card
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border-border/60 bg-card p-4 shadow-card-subtle transition-all duration-300",
        href && "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-elevated hover:border-primary/40"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12",
          tone === "success"
            ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/15"
            : "bg-primary/10 text-primary group-hover:bg-primary/15"
        )}
      >
        <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold leading-none tracking-tight text-foreground sm:text-3xl">
          {value}
        </div>
        <div className="mt-1.5 text-xs font-medium text-foreground/85 sm:text-sm">
          {label}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>

      {href && (
        <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
      )}
    </Card>
  );

  if (href) {
    return (
      <Link to={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
