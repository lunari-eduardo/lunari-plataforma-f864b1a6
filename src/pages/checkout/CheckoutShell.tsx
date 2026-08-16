/**
 * CheckoutShell — casca visual branded compartilhada por todos os provedores
 * do checkout público. Mantém fundo, logo, valor e selo de segurança estáveis
 * entre estados (evita "pisca-pisca" ao trocar de painel).
 */
import { ReactNode } from 'react';
import { Lock } from 'lucide-react';

export interface CheckoutShellProps {
  photographer?: { name: string | null; logoUrl: string | null } | null;
  valor?: number;
  descricao?: string | null;
  children: ReactNode;
}

export default function CheckoutShell({
  photographer,
  valor,
  descricao,
  children,
}: CheckoutShellProps) {
  return (
    <div className="flex flex-col items-center px-4 py-6">
      <div className="max-w-md w-full space-y-4">
        <div className="flex items-center justify-between gap-3 min-h-8">
          {photographer?.logoUrl ? (
            <img
              src={photographer.logoUrl}
              alt={photographer.name || 'Estúdio'}
              className="h-8 object-contain opacity-90"
            />
          ) : photographer?.name ? (
            <h1 className="text-sm font-medium text-neutral-500 truncate">{photographer.name}</h1>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1 text-[10px] text-primary shrink-0">
            <Lock className="h-3 w-3" />
            Ambiente seguro
          </div>
        </div>

        {typeof valor === 'number' && (
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">
              Pagamento
            </p>
            <p className="text-3xl font-bold text-primary tracking-tight leading-tight">
              R$ {valor.toFixed(2).replace('.', ',')}
            </p>
            {descricao && <p className="text-xs text-neutral-600 mt-0.5">{descricao}</p>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

/** Skeleton branded — sem spinner cru, sem troca de fundo. */
export function CheckoutSkeleton() {
  return (
    <div className="flex flex-col items-center px-4 py-6">
      <div className="max-w-md w-full space-y-4 animate-pulse">
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-28 rounded bg-neutral-200/70" />
          <div className="h-3 w-24 rounded bg-neutral-200/70" />
        </div>
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="h-3 w-20 rounded bg-neutral-200/70" />
          <div className="h-8 w-40 rounded bg-neutral-200/70" />
          <div className="h-3 w-52 rounded bg-neutral-200/70" />
        </div>
        <div className="h-12 w-full rounded-lg bg-neutral-200/70" />
        <div className="h-40 w-full rounded-lg bg-neutral-200/60" />
      </div>
    </div>
  );
}
