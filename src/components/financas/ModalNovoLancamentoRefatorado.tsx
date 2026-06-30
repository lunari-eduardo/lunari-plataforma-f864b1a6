import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { GrupoPrincipal, ItemFinanceiro } from '@/types/financas';
import { CreateTransactionInput } from '@/hooks/useFinancialTransactionsSupabase';
import OpcoesLancamento, { OpcoesLancamentoState } from './OpcoesLancamento';
import { parseFinancialInput } from '@/utils/financialPrecision';
import GroupCategorySelector from '@/modules/finance/presentation/components/GroupCategorySelector';
import type { GroupScope } from '@/modules/finance';

type TipoLancamento = 'despesa' | 'receita';

interface ModalNovoLancamentoRefatoradoProps {
  aberto: boolean;
  onFechar: () => void;
  createTransactionEngine: (input: CreateTransactionInput) => void;
  /** @deprecated mantido por compatibilidade — não é mais usado pelo novo seletor. */
  obterItensPorGrupo?: (grupo: GrupoPrincipal) => ItemFinanceiro[];
  /** @deprecated mantido por compatibilidade — não é mais usado pelo novo seletor. */
  grupoAtivo?: GrupoPrincipal;
  tipoLancamento?: TipoLancamento;
  /** Escopo de naturezas/grupos exibidos no seletor (default: derivado do tipo). */
  scope?: GroupScope;
  /** Grupo inicial sugerido (ex.: ao abrir via "Adicionar Equipamento"). */
  initialGroupCode?: string;
  /** @deprecated mantido por compatibilidade — sem efeito no novo seletor. */
  filtrarApenasGrupo?: boolean;
}

export default function ModalNovoLancamentoRefatorado({
  aberto,
  onFechar,
  createTransactionEngine,
  tipoLancamento = 'despesa',
  scope,
  initialGroupCode,
}: ModalNovoLancamentoRefatoradoProps) {
  const [formData, setFormData] = useState({
    item_id: '',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    data_competencia: '',
    observacoes: '',
    valorFixo: true
  });

  const [opcoes, setOpcoes] = useState<OpcoesLancamentoState>({
    despesaRecorrente: false,
    cartaoCredito: false,
    cartaoCreditoId: '',
    numeroParcelas: 1
  });

  const limparFormulario = () => {
    setFormData({
      item_id: '',
      valor: '',
      data_vencimento: new Date().toISOString().split('T')[0],
      data_competencia: '',
      observacoes: '',
      valorFixo: true
    });
    setOpcoes({
      despesaRecorrente: false,
      cartaoCredito: false,
      cartaoCreditoId: '',
      numeroParcelas: 1
    });
  };

  const handleSubmit = () => {
    if (!formData.item_id || !formData.valor) return;

    const valor = parseFinancialInput(formData.valor);
    if (valor <= 0) return;

    // Validação específica para cartão de crédito
    if (opcoes.cartaoCredito && !opcoes.cartaoCreditoId) {
      return;
    }

    const input: CreateTransactionInput = {
      valorTotal: valor,
      dataPrimeiraOcorrencia: formData.data_vencimento,
      dataCompetencia: formData.data_competencia || undefined,
      itemId: formData.item_id,
      observacoes: formData.observacoes || '',
      isRecorrente: opcoes.despesaRecorrente,
      isParcelado: opcoes.cartaoCredito,
      numeroDeParcelas: opcoes.cartaoCredito ? opcoes.numeroParcelas : undefined,
      isValorFixo: formData.valorFixo,
      cartaoCreditoId: opcoes.cartaoCredito ? opcoes.cartaoCreditoId : undefined
    };

    createTransactionEngine(input);
    limparFormulario();
    onFechar();
  };

  // Textos adaptativos baseados no tipo de lançamento
  const textos = {
    titulo: tipoLancamento === 'receita' ? 'Nova Receita' : 'Nova Despesa',
    recorrente: tipoLancamento === 'receita' ? 'Receita Recorrente' : 'Despesa Recorrente'
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => {
        // Permitir cliques em elementos do Select sem fechar o modal
        const target = e.target as Element;
        if (target.closest('[data-radix-select-content]') || target.closest('[data-radix-popper-content-wrapper]')) {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle>{textos.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <GroupCategorySelector
            tipoLancamento={tipoLancamento}
            scope={scope}
            initialGroupCode={initialGroupCode}
            itemId={formData.item_id}
            onItemIdChange={(id) => setFormData((prev) => ({ ...prev, item_id: id }))}
          />



          <div>
            <Label htmlFor="valor">Valor</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data">Data de Vencimento</Label>
              <Input
                id="data"
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              />
            </div>

            <div>
              <Label>Opções</Label>
              <div className="space-y-2 mt-2">
                {/* Checkbox para valor fixo - só aparece quando recorrente está marcada */}
                {opcoes.despesaRecorrente && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="valorFixo"
                      checked={formData.valorFixo}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        valorFixo: checked as boolean
                      })}
                    />
                    <Label htmlFor="valorFixo" className="text-sm text-primary">
                      Manter valor fixo mensalmente?
                    </Label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data de Competência (opcional) */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label htmlFor="data_competencia" className="text-sm">
                Data de competência <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Use quando o lançamento se refere a um período diferente da data de vencimento.
                      Exemplo: pagar em janeiro um serviço prestado em dezembro.
                      Se vazio, será usada a data de vencimento.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="data_competencia"
              type="date"
              value={formData.data_competencia}
              onChange={(e) => setFormData({ ...formData, data_competencia: e.target.value })}
            />
          </div>

          {/* Componente Unificado de Opções */}
          <OpcoesLancamento 
            opcoes={opcoes}
            onOpcoesChange={setOpcoes}
            tipoLancamento={tipoLancamento}
            layout="modal"
          />

          {/* Informação adicional para valor fixo/variável em recorrentes */}
          {opcoes.despesaRecorrente && (
            <div className="p-3 bg-muted rounded-lg border border-border">
              {formData.valorFixo ? (
                <p className="text-xs text-lunar-success">
                  ✓ <strong>Valor Fixo:</strong> O valor R$ {formData.valor || '0,00'} será mantido em todos os meses.
                </p>
              ) : (
                <p className="text-xs text-lunar-warning">
                  ⚠ <strong>Valor Variável:</strong> Será criado com valor R$ 0,00 para edição manual a cada mês.
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações opcionais..."
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={
                !formData.item_id || 
                !formData.valor || 
                (opcoes.cartaoCredito && !opcoes.cartaoCreditoId)
              }
            >
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}