import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { GrupoPrincipal, ItemFinanceiro } from '@/types/financas';
import { CreateTransactionInput } from '@/services/FinancialEngine';
import OpcoesLancamento, { OpcoesLancamentoState } from './OpcoesLancamento';

type TipoLancamento = 'despesa' | 'receita';

interface ModalNovoLancamentoRefatoradoProps {
  aberto: boolean;
  onFechar: () => void;
  createTransactionEngine: (input: CreateTransactionInput) => void;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
  grupoAtivo: GrupoPrincipal;
  tipoLancamento?: TipoLancamento;
}

export default function ModalNovoLancamentoRefatorado({
  aberto,
  onFechar,
  createTransactionEngine,
  obterItensPorGrupo,
  grupoAtivo,
  tipoLancamento = 'despesa'
}: ModalNovoLancamentoRefatoradoProps) {
  const [formData, setFormData] = useState({
    item_id: '',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
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

    const valor = parseFloat(formData.valor);
    if (isNaN(valor) || valor <= 0) return;

    // Validação específica para cartão de crédito
    if (opcoes.cartaoCredito && !opcoes.cartaoCreditoId) {
      return;
    }

    const input: CreateTransactionInput = {
      valorTotal: valor,
      dataPrimeiraOcorrencia: formData.data_vencimento,
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

  // Usar preferencialmente itens do grupo ativo, mas permitir todos
  const itensGrupoAtivo = obterItensPorGrupo(grupoAtivo);
  const todosItens = ['Despesa Fixa', 'Despesa Variável', 'Investimento', 'Receita Não Operacional']
    .flatMap(grupo => obterItensPorGrupo(grupo as GrupoPrincipal));

  // Textos adaptativos baseados no tipo de lançamento
  const textos = {
    titulo: tipoLancamento === 'receita' ? 'Nova Receita' : 'Nova Despesa',
    item: tipoLancamento === 'receita' ? 'Item da Receita' : 'Item da Despesa',
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
          <div>
            <Label htmlFor="item">{textos.item}</Label>
            <Select 
              value={formData.item_id} 
              onValueChange={(value) => setFormData({ ...formData, item_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um item..." />
              </SelectTrigger>
              <SelectContent>
                {/* Priorizar itens do grupo ativo */}
                {itensGrupoAtivo.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                      {grupoAtivo} (Recomendado)
                    </div>
                    {itensGrupoAtivo.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                    <div className="border-t my-1"></div>
                  </>
                )}
                
                {/* Outros itens */}
                <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                  Todos os Itens
                </div>
                {todosItens.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome} <span className="text-xs text-gray-500">({item.grupo_principal})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    <Label htmlFor="valorFixo" className="text-sm text-blue-700">
                      Manter valor fixo mensalmente?
                    </Label>
                  </div>
                )}
              </div>
            </div>
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
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              {formData.valorFixo ? (
                <p className="text-xs text-green-700">
                  ✓ <strong>Valor Fixo:</strong> O valor R$ {formData.valor || '0,00'} será mantido em todos os meses.
                </p>
              ) : (
                <p className="text-xs text-orange-700">
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