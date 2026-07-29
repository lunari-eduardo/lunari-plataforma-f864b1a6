/**
 * PageHeader — cabeçalho padrão "Silent Luxury" das páginas.
 * Espelha o `FinanceHeader`: título compacto + slot de ação à direita.
 *
 * Uso:
 *   <PageHeader title="Integrações" description="..." action={<Button>...</Button>} />
 */
import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const PageHeader = memo(function PageHeader({
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 pb-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </header>
  );
});

export default PageHeader;
