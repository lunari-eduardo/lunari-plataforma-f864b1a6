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
  const canCobrarExtras =
    hasGaleria && !!onCobrarExtras && extrasPendente > 0.001 && !extrasFullyPaid;
  const canCobrarTudo = canCobrarSessao && canCobrarExtras && !!onCobrarTudo;
  const showDropdown = hasGaleria && (canCobrarExtras || extrasPendente > 0);

  return (
    <div className="flex flex-col gap-2 items-stretch">
      {showDropdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              disabled={!canCobrarSessao && !canCobrarExtras}
              className="gap-2 w-full"
            >
              <Send className="h-3.5 w-3.5" />
              Cobrar
              <ChevronDown className="h-3 w-3 opacity-70 ml-auto" />
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
          size="sm"
          onClick={onCobrar}
          disabled={!canCobrarSessao}
          className="gap-2 w-full"
        >
          <Send className="h-3.5 w-3.5" />
          Cobrar sessão
        </Button>
      )}

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={onRegistrarPagamento}
                disabled={!canRegistrar}
                className="gap-2 w-full border-border/30"
              >
                <Wallet className="h-4 w-4" />
                Registrar pagamento
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

      <div className="w-full border-t border-border/15 my-1" />

      <span className={LABEL_CLS}>Atalhos</span>
      <div className="flex items-center gap-2">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onAbrirPagamentos}
                className="h-8 w-8 flex items-center justify-center rounded-md border border-border/25 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                aria-label="Pagamentos"
              >
                <CreditCard className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Pagamentos</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {session.clienteId && (
          <SessaoContratoButton
            sessionId={session.sessionId || session.id}
            clienteId={session.clienteId}
            clienteNome={session.nome}
            iconOnly
          />
        )}
      </div>
    </div>
  );
}
