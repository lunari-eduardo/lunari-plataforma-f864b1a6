import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { CreditCard, Package } from "lucide-react";
import type { SessionData } from "@/types/workflow";

interface WorkflowCardExpandedProps {
  session: SessionData;
  packageOptions: any[];
  productOptions: any[];
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
}

export function WorkflowCardExpanded({
  session,
  packageOptions,
  productOptions,
  onFieldUpdate,
}: WorkflowCardExpandedProps) {
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  
  // Estados locais para edição inline
  const [descontoValue, setDescontoValue] = useState(session.desconto || '');
  const [adicionalValue, setAdicionalValue] = useState(session.valorAdicional || '');
  const [obsValue, setObsValue] = useState(session.observacoes || '');

  // Sync quando session muda
  useEffect(() => {
    setDescontoValue(session.desconto || '');
    setAdicionalValue(session.valorAdicional || '');
    setObsValue(session.observacoes || '');
  }, [session.desconto, session.valorAdicional, session.observacoes]);

  const formatCurrency = useCallback((value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }, []);

  const parseCurrency = useCallback((value: string): number => {
    return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  }, []);

  // Cálculos financeiros (mesma lógica do WorkflowTable)
  const calculateTotal = useCallback(() => {
    const valorPacote = parseCurrency(String(session.valorPacote || '0'));
    const valorFotoExtra = parseCurrency(String(session.valorTotalFotoExtra || '0'));
    const valorAdicional = parseCurrency(String(session.valorAdicional || '0'));
    const desconto = parseCurrency(String(session.desconto || '0'));

    let valorProdutosManuais = 0;
    if (session.produtosList && session.produtosList.length > 0) {
      const produtosManuais = session.produtosList.filter(p => p.tipo === 'manual');
      valorProdutosManuais = produtosManuais.reduce((total, p) => {
        return total + (parseFloat(String(p.valorUnitario || 0)) || 0) * (parseFloat(String(p.quantidade || 0)) || 0);
      }, 0);
    }

    return Math.max(0, valorPacote + valorFotoExtra + valorProdutosManuais + valorAdicional - desconto);
  }, [session, parseCurrency]);

  const valorPago = parseCurrency(String(session.valorPago || '0'));
  const total = calculateTotal();
  const pendente = Math.max(0, total - valorPago);

  // Handlers para campos editáveis
  const handleDescontoBlur = useCallback(() => {
    // Formatar como moeda ao sair
    const numValue = parseCurrency(descontoValue);
    const formatted = formatCurrency(numValue);
    setDescontoValue(formatted);
    onFieldUpdate(session.id, 'desconto', formatted);
  }, [descontoValue, session.id, onFieldUpdate, parseCurrency, formatCurrency]);

  const handleAdicionalBlur = useCallback(() => {
    const numValue = parseCurrency(adicionalValue);
    const formatted = formatCurrency(numValue);
    setAdicionalValue(formatted);
    onFieldUpdate(session.id, 'valorAdicional', formatted);
  }, [adicionalValue, session.id, onFieldUpdate, parseCurrency, formatCurrency]);

  const handleObsBlur = useCallback(() => {
    if (obsValue !== session.observacoes) {
      onFieldUpdate(session.id, 'observacoes', obsValue);
    }
  }, [obsValue, session.observacoes, session.id, onFieldUpdate]);

  // Dados para exibição
  const valorPacoteDisplay = formatCurrency(parseCurrency(String(session.valorPacote || '0')));
  const valorFotoExtraUnit = formatCurrency(parseCurrency(String(session.valorFotoExtra || '0')));
  const valorFotoExtraTotal = formatCurrency(parseCurrency(String(session.valorTotalFotoExtra || '0')));
  
  let valorProdutosTotal = 0;
  if (session.produtosList && session.produtosList.length > 0) {
    valorProdutosTotal = session.produtosList
      .filter(p => p.tipo === 'manual')
      .reduce((total, p) => total + (p.valorUnitario || 0) * (p.quantidade || 0), 0);
  }

  const pacoteNome = session.regras_congeladas?.pacote?.nome || session.pacote || 'Não definido';

  return (
    <div className="border-t border-border/30 bg-muted/20 px-4 py-4">
      {/* Grid de 3 blocos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        
        {/* BLOCO 1 - Dados da Sessão */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Dados da Sessão
          </h4>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Pacote:</span>
              <span className="text-sm font-medium text-foreground">{pacoteNome}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Valor base:</span>
              <span className="text-sm font-medium text-blue-600">{valorPacoteDisplay}</span>
            </div>
            
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Desconto:</span>
              <Input
                value={descontoValue}
                onChange={(e) => setDescontoValue(e.target.value)}
                onBlur={handleDescontoBlur}
                placeholder="R$ 0,00"
                className="h-7 text-xs text-right w-24 border border-border/50 rounded bg-background/50 focus:bg-background"
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Vlr foto extra:</span>
              <span className="text-sm font-medium text-foreground">{valorFotoExtraUnit}</span>
            </div>
          </div>
        </div>

        {/* BLOCO 2 - Adicionais */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Adicionais
          </h4>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total fotos extras:</span>
              <span className="text-sm font-medium text-foreground">{valorFotoExtraTotal}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total produtos:</span>
              <span className="text-sm font-medium text-foreground">{formatCurrency(valorProdutosTotal)}</span>
            </div>
            
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Adicional:</span>
              <Input
                value={adicionalValue}
                onChange={(e) => setAdicionalValue(e.target.value)}
                onBlur={handleAdicionalBlur}
                placeholder="R$ 0,00"
                className="h-7 text-xs text-right w-24 border border-border/50 rounded bg-background/50 focus:bg-background"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Obs:</span>
              <Textarea
                value={obsValue}
                onChange={(e) => setObsValue(e.target.value)}
                onBlur={handleObsBlur}
                placeholder="Observações..."
                className="text-xs min-h-[60px] border border-border/50 rounded bg-background/50 focus:bg-background resize-none"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 3 - Ações */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ações
          </h4>
          
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWorkflowPaymentsOpen(true)}
              className="w-full justify-start gap-2 h-9"
            >
              <CreditCard className="h-4 w-4 text-primary" />
              <span>Gerenciar pagamentos</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Financeiro */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 md:gap-8">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">TOTAL</span>
              <span className="text-lg font-bold text-blue-700">{formatCurrency(total)}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">PAGO</span>
              <span className="text-lg font-bold text-green-600">{formatCurrency(valorPago)}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">PENDENTE</span>
              <span className={`text-lg font-bold ${pendente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(pendente)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pagamentos */}
      {workflowPaymentsOpen && (
        <WorkflowPaymentsModal
          isOpen={workflowPaymentsOpen}
          onClose={() => setWorkflowPaymentsOpen(false)}
          sessionData={session}
          valorTotalCalculado={total}
          onPaymentUpdate={(sessionId, totalPaid, fullPaymentsArray) => {
            onFieldUpdate(sessionId, 'valorPago', `R$ ${totalPaid.toFixed(2).replace('.', ',')}`);
            if (fullPaymentsArray) {
              onFieldUpdate(sessionId, 'pagamentos', fullPaymentsArray);
            }
          }}
        />
      )}
    </div>
  );
}
