/**
 * LancamentoDrawerProvider — Etapa 3 do redesign de Lançamentos.
 *
 * Responsabilidades:
 *  1. Expor um contexto global (`useLancamentoDrawer`) para abrir/fechar
 *     o painel contextual de qualquer ponto do módulo Financeiro
 *     (header, cards de resumo, timeline, ações da LU, etc.).
 *  2. Renderizar UMA única instância do Sheet ancorado:
 *       • Desktop → painel lateral direito (~560px)
 *       • Mobile  → bottom sheet full-height
 *  3. Servir apenas de casca (shell). O conteúdo de cada tipo
 *     será plugado na Etapa 5 (Contextual Forms). Enquanto isso,
 *     mostra um placeholder editorial coerente com o Silent Luxury.
 *
 * ⚠️  NENHUMA regra de persistência aqui. Escrita continua nas capabilities.
 */
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  getLancamentoTipoMeta,
  type LancamentoTipo,
} from '@/modules/finance/domain/lancamentoTipos';
import LancamentoForm from './LancamentoForm';
import VendaAvulsaPanel from '@/modules/finance/presentation/vendaAvulsa/VendaAvulsaPanel';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateFinanceAll } from '@/modules/finance/infrastructure/realtime/invalidateFinanceAll';

// ─────────────────────────────────────────────────────────────
// Contexto
// ─────────────────────────────────────────────────────────────

export interface OpenLancamentoDrawerOptions {
  tipo: LancamentoTipo;
  /** Callback disparado após confirmação bem-sucedida (Etapa 5+). */
  onCreated?: () => void;
}

interface LancamentoDrawerContextValue {
  open: (opts: OpenLancamentoDrawerOptions) => void;
  close: () => void;
  openVendaAvulsa: () => void;
  isOpen: boolean;
  currentTipo: LancamentoTipo | null;
}

const LancamentoDrawerContext = createContext<LancamentoDrawerContextValue | null>(null);

export function useLancamentoDrawer(): LancamentoDrawerContextValue {
  const ctx = useContext(LancamentoDrawerContext);
  if (!ctx) {
    throw new Error(
      'useLancamentoDrawer precisa estar dentro de <LancamentoDrawerProvider>.',
    );
  }
  return ctx;
}


// ─────────────────────────────────────────────────────────────
// Provider + Shell
// ─────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
}

export const LancamentoDrawerProvider = memo(function LancamentoDrawerProvider({
  children,
}: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<LancamentoTipo | null>(null);
  const [onCreated, setOnCreated] = useState<(() => void) | null>(null);
  const [vendaAvulsaOpen, setVendaAvulsaOpen] = useState(false);

  const open = useCallback((opts: OpenLancamentoDrawerOptions) => {
    setTipo(opts.tipo);
    setOnCreated(() => opts.onCreated ?? null);
  }, []);

  const close = useCallback(() => {
    setTipo(null);
    setOnCreated(null);
  }, []);

  const openVendaAvulsa = useCallback(() => {
    setTipo(null);
    setOnCreated(null);
    setVendaAvulsaOpen(true);
  }, []);

  const handleVendaSucesso = useCallback(() => {
    // Invalida caches financeiros e de workflow para refletir a nova venda.
    queryClient.invalidateQueries({ queryKey: ['transacoes'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-financeiro'] });
    queryClient.invalidateQueries({ queryKey: ['workflow-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['workflow-metrics-by-year'] });
    queryClient.invalidateQueries({ queryKey: ['extrato'] });
    queryClient.invalidateQueries({ queryKey: ['clientes-sessoes'] });
  }, [queryClient]);

  const value = useMemo<LancamentoDrawerContextValue>(
    () => ({ open, close, openVendaAvulsa, isOpen: tipo !== null, currentTipo: tipo }),
    [open, close, openVendaAvulsa, tipo],
  );

  const meta = tipo ? getLancamentoTipoMeta(tipo) : null;
  const Icone = meta?.icone;

  return (
    <LancamentoDrawerContext.Provider value={value}>
      {children}

      <Sheet open={tipo !== null} onOpenChange={(v) => !v && close()}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'flex flex-col gap-0 border-l border-border/60 bg-background p-0',
            'shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]',
            isMobile
              ? 'h-[92dvh] max-h-[92dvh] w-full rounded-t-2xl border-l-0 border-t'
              : 'w-full sm:max-w-[560px]',
          )}
        >
          {meta && Icone ? (
            <>
              {isMobile && (
                <div className="flex justify-center pt-2 pb-1 shrink-0">
                  <span aria-hidden className="h-1 w-10 rounded-full bg-border/80" />
                </div>
              )}
              <header
                className={cn(
                  'flex items-start gap-3 border-b border-border/40 shrink-0',
                  isMobile ? 'px-5 pt-3 pb-3' : 'px-6 pt-6 pb-4',
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gold/10 text-accent-gold shrink-0">
                  <Icone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
                    {meta.tituloDrawer}
                  </h2>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    {meta.subtituloDrawer}
                  </p>
                </div>
              </header>

              <LancamentoForm
                key={tipo ?? 'none'}
                tipo={tipo!}
                onClose={close}
                onCreated={onCreated ?? undefined}
                isMobile={isMobile}
                onSelectVendaAvulsa={openVendaAvulsa}
              />
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <VendaAvulsaPanel
        aberto={vendaAvulsaOpen}
        onFechar={() => setVendaAvulsaOpen(false)}
        onSucesso={handleVendaSucesso}
      />
    </LancamentoDrawerContext.Provider>
  );
});

export default LancamentoDrawerProvider;

