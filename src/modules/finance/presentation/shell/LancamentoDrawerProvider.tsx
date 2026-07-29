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
  const [tipo, setTipo] = useState<LancamentoTipo | null>(null);
  const [onCreated, setOnCreated] = useState<(() => void) | null>(null);

  const open = useCallback((opts: OpenLancamentoDrawerOptions) => {
    setTipo(opts.tipo);
    setOnCreated(() => opts.onCreated ?? null);
  }, []);

  const close = useCallback(() => {
    setTipo(null);
    setOnCreated(null);
  }, []);

  const value = useMemo<LancamentoDrawerContextValue>(
    () => ({ open, close, isOpen: tipo !== null, currentTipo: tipo }),
    [open, close, tipo],
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
              ? 'h-[92dvh] w-full rounded-t-2xl border-l-0 border-t'
              : 'w-full sm:max-w-[560px]',
          )}
        >
          {meta && Icone ? (
            <>
              <header className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-border/40">
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

              {/* Placeholder até Etapa 5 — mantém o Sheet operacional para navegação */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                  <p className="text-[13px] font-medium text-foreground">
                    Formulário contextual em construção
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    Este painel receberá o formulário específico de{' '}
                    <span className="text-foreground/80">{meta.label}</span> na próxima etapa
                    (biblioteca de campos + layouts contextuais).
                  </p>
                </div>
              </div>

              <footer className="flex items-center justify-end gap-2 border-t border-border/40 px-6 py-4">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-md bg-accent-gold/90 px-3 py-1.5 text-[12px] font-medium text-background opacity-50 cursor-not-allowed"
                >
                  Salvar
                </button>
              </footer>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </LancamentoDrawerContext.Provider>
  );
});

export default LancamentoDrawerProvider;
