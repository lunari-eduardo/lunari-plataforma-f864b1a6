/**
 * EtapaSection — Onda 5. Antes era um acordeão pesado (`bg-primary/40`) que
 * empilhava 4 blocos fechados. Com as abas da Central de Precificação, cada
 * etapa já está isolada: aqui sobra apenas um cabeçalho discreto + conteúdo.
 *
 * O nome `EtapaColapsavel` é mantido como alias para não quebrar imports.
 */
import { CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusSalvamento } from '@/types/precificacao';

interface EtapaSectionProps {
  numero?: number;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  /** Ignorado — mantido para compatibilidade com os callers antigos. */
  defaultOpen?: boolean;
  statusSalvamento?: StatusSalvamento;
  className?: string;
}

export function EtapaSection({
  titulo,
  descricao,
  children,
  statusSalvamento,
  className,
}: EtapaSectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{titulo}</h2>
          {descricao ? (
            <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
          ) : null}
        </div>

        {statusSalvamento ? (
          <div className="flex items-center shrink-0">
            {statusSalvamento === 'salvo' && (
              <CheckCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
            )}
            {statusSalvamento === 'erro' && (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            {statusSalvamento === 'salvando' && (
              <div className="animate-spin h-3 w-3 border border-muted-foreground/50 border-t-transparent rounded-full" />
            )}
          </div>
        ) : null}
      </header>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

export const EtapaColapsavel = EtapaSection;

export default EtapaSection;
