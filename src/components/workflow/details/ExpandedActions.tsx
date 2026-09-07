import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, Send, Images, ChevronDown, Wallet, FileSignature } from "lucide-react";
import { SessaoContratoButton } from "@/components/contratos/SessaoContratoButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LABEL_CLS } from "./cardTokens";
import type { SessionData } from "@/types/workflow";

interface Props {
  session: SessionData;
  onCobrar: () => void;
  onCobrarExtras?: () => void;
  onCobrarTudo?: () => void;
  extrasPendente?: number;
  extrasFullyPaid?: boolean;
  sessaoPendente?: number;
  hasGaleria?: boolean;
  onAbrirPagamentos: () => void;
  onRegistrarPagamento: () => void;
  canRegistrar: boolean;
}

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Bloco 4 — Ações. Assume que o SectionHeader é renderizado pelo pai.
 * Layout: 1) Cobrar (primário sólido) 2) Registrar pagamento (outline)
 * 3) hairline 4) grupo secundário ícone-only.
 */
export function ExpandedActions({
  session,
  onCobrar,
  onCobrarExtras,
  onCobrarTudo,
  extrasPendente = 0,
  extrasFullyPaid = false,
  sessaoPendente = 0,
  hasGaleria = false,
  onAbrirPagamentos,
  onRegistrarPagamento,
  canRegistrar,
}: Props) {
  const canCobrarSessao = sessaoPendente > 0.001;
  // Extras cobráveis independem de galeria vinculada — basta haver pendência.
  const canCobrarExtras =
    !!onCobrarExtras && extrasPendente > 0.001 && !extrasFullyPaid;
  const canCobrarTudo = canCobrarSessao && canCobrarExtras && !!onCobrarTudo;
  const showDropdown = canCobrarExtras || extrasPendente > 0;

  return (
    <div className="flex flex-col gap-2.5 items-stretch">
      {showDropdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={!canCobrarSessao && !canCobrarExtras}
              className="h-10 w-full rounded-xl bg-gradient-to-r from-[#1C1815] to-[#2B231D] text-[#FAF6F0] hover:from-[#2B231D] hover:to-[#382E25] border border-[#3E342B] font-medium text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              <Send className="h-3.5 w-3.5 text-[#E0C6A5]" />
              Cobrar via link
              <ChevronDown className="h-3.5 w-3.5 text-[#E0C6A5]/70 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              disabled={!canCobrarSessao}
              onClick={() => canCobrarSessao && onCobrar()}
              className="gap-2"
            >
              <Send className="h-3.5 w-3.5 text-primary" />
              <div className="flex-1">
                <div className="text-xs font-medium">Cobrar sessão</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatBRL(sessaoPendente)}
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canCobrarExtras}
              onClick={() => canCobrarExtras && onCobrarExtras?.()}
              className="gap-2"
            >
              <Images className="h-3.5 w-3.5 text-amber-500" />
              <div className="flex-1">
                <div className="text-xs font-medium">Cobrar extras</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatBRL(extrasPendente)}
                </div>
              </div>
            </DropdownMenuItem>
            {canCobrarTudo && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onCobrarTudo} className="gap-2">
                  <Send className="h-3.5 w-3.5 text-primary" />
                  <div className="flex-1">
                    <div className="text-xs font-medium">Cobrar tudo</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatBRL(sessaoPendente + extrasPendente)} · 1 link único
                    </div>
                  </div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          onClick={onCobrar}
          disabled={!canCobrarSessao}
          className="h-10 w-full rounded-xl bg-gradient-to-r from-[#1C1815] to-[#2B231D] text-[#FAF6F0] hover:from-[#2B231D] hover:to-[#382E25] border border-[#3E342B] font-medium text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
        >
          <Send className="h-3.5 w-3.5 text-[#E0C6A5]" />
          Cobrar via link
        </Button>
      )}

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full">
              <Button
                onClick={onRegistrarPagamento}
                disabled={!canRegistrar}
                className="h-10 w-full rounded-xl bg-gradient-to-r from-[#1C1815] to-[#2B231D] text-[#FAF6F0] hover:from-[#2B231D] hover:to-[#382E25] border border-[#3E342B] font-medium text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <CreditCard className="h-3.5 w-3.5 text-[#E0C6A5]" />
                Adicionar pagamento
              </Button>
            </span>
          </TooltipTrigger>
          {!canRegistrar && (
            <TooltipContent side="top" className="text-xs">
              Nada pendente para registrar.
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-2 mb-0.5">
        Atalhos
      </span>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAbrirPagamentos}
          className="h-9 w-full rounded-xl border border-stone-200/80 dark:border-border/60 bg-white dark:bg-card hover:bg-stone-50 dark:hover:bg-muted text-stone-700 dark:text-stone-200 text-xs font-medium gap-2 shadow-2xs transition-all justify-center"
          aria-label="Histórico Financeiro"
        >
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span>Histórico Financeiro</span>
        </Button>

        {session.clienteId && (
          <SessaoContratoButton
            sessionId={session.sessionId || session.id}
            clienteId={session.clienteId}
            clienteNome={session.nome}
            iconOnly={false}
            className="h-9 w-full rounded-xl border border-stone-200/80 dark:border-border/60 bg-white dark:bg-card hover:bg-stone-50 dark:hover:bg-muted text-stone-700 dark:text-stone-200 text-xs font-medium shadow-2xs transition-all justify-center"
          />
        )}
      </div>
    </div>
  );
}
