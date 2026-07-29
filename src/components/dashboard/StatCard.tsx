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
  // Silent Luxury: monochromatic icon, hairline border, hover eleva por alpha.
  void tone;
  const content = (
    <Card
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border-border/20 bg-card/60 p-4 shadow-sm transition-colors duration-200",
        href && "cursor-pointer hover:bg-card/80 hover:border-border/40"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        <div className="mt-1.5 text-xs font-medium text-foreground/80">
          {label}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>

      {href && (
        <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
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
