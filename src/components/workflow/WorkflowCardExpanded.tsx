import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { CreditCard, Plus } from "lucide-react";
import type { SessionData } from "@/types/workflow";
import { useAppContext } from "@/contexts/AppContext";

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
  const { addPayment } = useAppContext();
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');
  
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

  // Handler pagamento rápido
  const handlePaymentAdd = useCallback(async () => {
    if (paymentInput && !isNaN(parseFloat(paymentInput))) {
      const paymentValue = parseFloat(paymentInput);
      try {
        await addPayment(session.id, paymentValue);
        setPaymentInput('');
      } catch (error) {
        console.error('❌ Erro ao adicionar pagamento:', error);
      }
    }
  }, [paymentInput, addPayment, session.id]);

  const handlePaymentKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePaymentAdd();
    }
  }, [handlePaymentAdd]);

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
    <div className="border-t border-border/30 bg-muted/10 px-4 py-5 md:px-6">
      {/* Grid de 3 blocos com divisórias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* BLOCO 1 - Dados da Sessão */}
        <div className="space-y-3 md:border-r md:border-border/20 md:pr-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Dados da Sessão
          </h4>
          
          <div className="space-y-2.5">
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
        <div className="space-y-3 md:border-r md:border-border/20 md:pr-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Adicionais
          </h4>
          
          <div className="space-y-2.5">
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
            
            <div className="flex flex-col gap-1.5">
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
        <div className="space-y-3 flex flex-col items-center justify-center py-4">
          <CreditCard className="h-10 w-10 text-muted-foreground/40" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWorkflowPaymentsOpen(true)}
            className="gap-2"
          >
            <CreditCard className="h-4 w-4" />
            Gerenciar pagamentos
          </Button>
        </div>
      </div>

      {/* Footer Financeiro com input de pagamento rápido */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Resumo financeiro à esquerda */}
          <div className="flex items-center gap-6 md:gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
              <span className="text-lg font-bold text-blue-700">{formatCurrency(total)}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago</span>
              <span className="text-lg font-bold text-green-600">{formatCurrency(valorPago)}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pendente</span>
              <span className={`text-lg font-bold ${pendente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(pendente)}
              </span>
            </div>
          </div>
          
          {/* Input pagamento rápido à direita */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:inline">Adic. Pag. Rápido</span>
            <div className="flex items-center border border-border/50 rounded-md bg-background/50">
              <span className="text-sm text-muted-foreground pl-2">R$</span>
              <Input
                type="number"
                placeholder="0,00"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                onKeyDown={handlePaymentKeyDown}
                className="h-8 text-sm w-20 border-0 focus-visible:ring-0 bg-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoComplete="off"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaymentAdd}
              className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-300 hover:text-green-600"
            >
              <Plus className="h-4 w-4" />
            </Button>
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
