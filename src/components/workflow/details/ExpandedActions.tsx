import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, Send, Images, ChevronDown } from "lucide-react";
import { SessaoContratoButton } from "@/components/contratos/SessaoContratoButton";
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
}

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Coluna de ações (Bloco 3) do card expandido.
 *
 * UX unificada com o modal de Pagamentos: um único botão "Cobrar" com
 * dropdown que expõe Sessão / Extras / Tudo. "Cobrar tudo" gera UM link
 * único (finalidade `sessao_e_extras`) via CombinedChargeModal.
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
}: Props) {
  const canCobrarSessao = sessaoPendente > 0.001;
  const canCobrarExtras =
    hasGaleria && !!onCobrarExtras && extrasPendente > 0.001 && !extrasFullyPaid;
  const canCobrarTudo = canCobrarSessao && canCobrarExtras && !!onCobrarTudo;

  const showDropdown = hasGaleria && (canCobrarExtras || extrasPendente > 0);

  return (
    <div className="space-y-3 flex flex-col items-center justify-center py-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Ações
      </h4>

      <div className="flex flex-col items-center gap-2 w-full max-w-[220px]">
        {showDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!canCobrarSessao && !canCobrarExtras}
                className="gap-2 w-full border-primary text-primary hover:bg-primary/10"
              >
                <Send className="h-3.5 w-3.5" />
                Cobrar
                <ChevronDown className="h-3 w-3 opacity-70" />
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
            variant="outline"
            size="sm"
            onClick={onCobrar}
            disabled={!canCobrarSessao}
            className="gap-2 w-full border-primary text-primary hover:bg-primary/10"
          >
            <Send className="h-3.5 w-3.5" />
            Cobrar sessão
          </Button>
        )}

        <div className="w-full border-t border-border/20 my-1" />

        <Button variant="outline" size="sm" onClick={onAbrirPagamentos} className="gap-2 w-full">
          <CreditCard className="h-4 w-4" />
          Pagamentos
        </Button>

        {session.clienteId && (
          <SessaoContratoButton
            sessionId={session.sessionId || session.id}
            clienteId={session.clienteId}
            clienteNome={session.nome}
          />
        )}
      </div>
    </div>
  );
}
