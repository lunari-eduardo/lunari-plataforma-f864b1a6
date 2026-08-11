/**
 * NovoLancamentoMenu — menu contextual estilo Notion.
 *
 * Aberto pelo botão único "+ Novo lançamento" do FinanceHeader.
 * Lista os 5 tipos de lançamento (Etapa 1) com ícone dourado + label + descrição.
 * NÃO abre o drawer direto: apenas emite `onSelectTipo(tipo)`; quem hospeda decide
 * (Etapa 3 vai plugar o LancamentoDrawerProvider aqui).
 */
import { memo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LANCAMENTO_TIPOS,
  LANCAMENTO_TIPOS_ORDEM,
  type LancamentoTipo,
} from "@/modules/finance/domain/lancamentoTipos";

interface NovoLancamentoMenuProps {
  onSelectTipo: (tipo: LancamentoTipo) => void;
}

export const NovoLancamentoMenu = memo(function NovoLancamentoMenu({
  onSelectTipo,
}: NovoLancamentoMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Novo lançamento
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-[320px] p-1.5",
          "border-border/60 bg-popover/95 backdrop-blur-xl",
          "shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]",
          "rounded-xl",
        )}
      >
        <div className="px-2.5 pt-2 pb-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
            Novo lançamento
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          {LANCAMENTO_TIPOS_ORDEM.map((tipoId) => {
            const meta = LANCAMENTO_TIPOS[tipoId];
            const Icon = meta.icone;
            return (
              <button
                key={tipoId}
                type="button"
                onClick={() => onSelectTipo(tipoId)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left",
                  "transition-colors duration-150",
                  "hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    "bg-accent-gold/10 text-accent-gold",
                    "ring-1 ring-accent-gold/15",
                    "group-hover:bg-accent-gold/15 transition-colors",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-medium leading-tight text-foreground">
                    {meta.label}
                  </span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">
                    {meta.descricao}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default NovoLancamentoMenu;
