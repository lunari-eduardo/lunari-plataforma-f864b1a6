import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { WorkflowPackageCombobox } from "./WorkflowPackageCombobox";
import { ColoredStatusBadge } from "./ColoredStatusBadge";
import { GerenciarProdutosModal } from "./GerenciarProdutosModal";
import { FotosExtrasPaymentBadge } from "./FotosExtrasPaymentBadge";
import { CreditCard, Plus, Package } from "lucide-react";
import type { SessionData } from "@/types/workflow";
import { useAppContext } from "@/contexts/AppContext";

interface WorkflowCardExpandedProps {
  session: SessionData;
  packageOptions: any[];
  productOptions: any[];
  statusOptions?: string[];
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function WorkflowCardExpanded({
  session,
  packageOptions,
  productOptions,
  statusOptions = [],
  onFieldUpdate,
  onStatusChange,
}: WorkflowCardExpandedProps) {
  const { addPayment } = useAppContext();
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');
  const [produtosModalOpen, setProdutosModalOpen] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(session.descricao || '');
  
  // Estados locais para edição inline
  const [descontoValue, setDescontoValue] = useState(session.desconto || '');
  const [adicionalValue, setAdicionalValue] = useState(session.valorAdicional || '');
  const [obsValue, setObsValue] = useState(session.observacoes || '');

  // Sync quando session muda
  useEffect(() => {
    setDescontoValue(session.desconto || '');
    setAdicionalValue(session.valorAdicional || '');
    setObsValue(session.observacoes || '');
    setDescriptionValue(session.descricao || '');
  }, [session.desconto, session.valorAdicional, session.observacoes, session.descricao]);

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
  const displayPackageName = session.regras_congeladas?.pacote?.nome || session.pacote || '';
  const hasProdutos = session.produtosList && session.produtosList.length > 0;

  const handleStatusChange = useCallback((newStatus: string) => {
    const statusValue = newStatus === '__CLEAR__' ? '' : newStatus;
    if (onStatusChange) {
      onStatusChange(session.id, statusValue);
    }
  }, [session.id, onStatusChange]);

  const handleDescriptionBlur = useCallback(() => {
    if (descriptionValue !== session.descricao) {
      onFieldUpdate(session.id, 'descricao', descriptionValue);
    }
  }, [descriptionValue, session.descricao, session.id, onFieldUpdate]);

  return (
    <div className="bg-muted/5 dark:bg-muted/10 px-4 py-5 md:px-6">
      {/* MOBILE: Seção de Edição Rápida (visível apenas em mobile) */}
      <div className="md:hidden space-y-4 pb-4 border-b border-border/20 mb-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Editar Sessão
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Pacote */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase">Pacote</span>
            <WorkflowPackageCombobox
              key={`package-mobile-${session.id}-${session.pacote}`}
              value={session.pacote}
              displayName={displayPackageName}
              onValueChange={(packageData) => {
                onFieldUpdate(session.id, 'pacote', packageData.id || packageData.nome);
              }}
            />
            {/* Tag informativa - Fotos Incluídas */}
            {session.regras_congeladas?.pacote?.fotosIncluidas > 0 && (
              <span className="text-[10px] text-primary/80 font-medium">
                ({session.regras_congeladas.pacote.fotosIncluidas} fotos incluídas)
              </span>
            )}
          </div>
          
          {/* Status */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase">Status</span>
            <Select
              value={session.status || ''}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="h-8 text-xs border border-border/50 rounded bg-background/50">
                <SelectValue placeholder="Status">
                  {session.status ? (
                    <ColoredStatusBadge status={session.status} showBackground={true} />
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Sem status</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                <SelectItem value="__CLEAR__" className="text-muted-foreground italic">
                  Limpar status
                </SelectItem>
                {statusOptions.map(status => (
                  <SelectItem key={status} value={status}>
                    <ColoredStatusBadge status={status} showBackground={true} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Fotos Extras */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase">Fotos extras</span>
            <Input 
              type="number" 
              value={session.qtdFotosExtra || ''} 
              onChange={(e) => onFieldUpdate(session.id, 'qtdFotosExtra', parseInt(e.target.value) || 0)}
              className="h-8 text-xs p-2 text-center border border-border/50 rounded bg-background/50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0"
            />
          </div>
          
          {/* Produtos */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase">Produtos</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProdutosModalOpen(true)}
              className="h-8 text-xs border rounded bg-background hover:bg-muted justify-start"
            >
              <Package className={`h-3.5 w-3.5 mr-1.5 ${hasProdutos ? 'text-blue-600' : 'text-muted-foreground'}`} />
              Gerenciar ({hasProdutos ? session.produtosList.length : 0})
            </Button>
          </div>
        </div>
        
        {/* Descrição (full width) */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase">Descrição</span>
          <Input
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Descrição da sessão..."
            className="h-8 text-xs border border-border/50 rounded bg-background/50 focus:bg-background"
          />
        </div>
      </div>

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
                className="h-7 text-xs text-right w-24 border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80 focus:bg-background"
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{valorFotoExtraTotal}</span>
                <FotosExtrasPaymentBadge status={session.galeriaStatusPagamento} />
              </div>
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
                className="h-7 text-xs text-right w-24 border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80 focus:bg-background"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Obs:</span>
              <Textarea
                value={obsValue}
                onChange={(e) => setObsValue(e.target.value)}
                onBlur={handleObsBlur}
                placeholder="Observações..."
                className="text-xs min-h-[60px] border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80 focus:bg-background resize-none"
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
      <div className="mt-6 pt-4 border-t border-border/30 dark:border-border/50">
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
            <div className="flex items-center border border-border/50 dark:border-border rounded-md bg-background/50 dark:bg-background/80">
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

      {/* Modal de Gerenciamento de Produtos (Mobile) */}
      {produtosModalOpen && (
        <GerenciarProdutosModal
          open={produtosModalOpen}
          onOpenChange={setProdutosModalOpen}
          sessionId={session.id}
          clienteName={session.nome}
          produtos={session.produtosList || []}
          productOptions={productOptions}
          onSave={async (novosProdutos) => {
            const produtosCorrigidos = novosProdutos.map(p => ({
              ...p,
              valorUnitario: p.tipo === 'incluso' ? 0 : p.valorUnitario
            }));
            
            onFieldUpdate(session.id, 'produtosList', produtosCorrigidos);
            
            const produtosManuais = produtosCorrigidos.filter(p => p.tipo === 'manual');
            const valorTotalManuais = produtosManuais.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
            
            if (produtosManuais.length > 0) {
              const nomesProdutos = produtosManuais.map(p => p.nome).join(', ');
              const nomesInclusos = produtosCorrigidos.filter(p => p.tipo === 'incluso').map(p => p.nome);
              const nomeCompleto = nomesInclusos.length > 0 
                ? `${nomesProdutos} + ${nomesInclusos.length} incluso(s)` 
                : nomesProdutos;
              onFieldUpdate(session.id, 'produto', nomeCompleto);
              onFieldUpdate(session.id, 'qtdProduto', produtosManuais.reduce((total, p) => total + p.quantidade, 0));
            } else if (produtosCorrigidos.filter(p => p.tipo === 'incluso').length > 0) {
              const produtosInclusos = produtosCorrigidos.filter(p => p.tipo === 'incluso');
              onFieldUpdate(session.id, 'produto', `${produtosInclusos.length} produto(s) incluso(s)`);
              onFieldUpdate(session.id, 'qtdProduto', 0);
            } else {
              onFieldUpdate(session.id, 'produto', '');
              onFieldUpdate(session.id, 'qtdProduto', 0);
            }
            
            await onFieldUpdate(session.id, 'valorTotalProduto', formatCurrency(valorTotalManuais), true);
          }}
        />
      )}
    </div>
  );
}
