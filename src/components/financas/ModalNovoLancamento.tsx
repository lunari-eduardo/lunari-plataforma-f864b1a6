import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { GrupoPrincipal } from '@/types/financas';
import { CreateTransactionInput, FinancialEngine } from '@/services/FinancialEngine';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from '@/hooks/use-toast';
import { useAppContext } from '@/contexts/AppContext';

type TipoLancamento = 'despesa' | 'receita';
type FormaPagamento = 'vista' | 'parcelado' | 'cartao';

interface ModalNovoLancamentoProps {
  open: boolean;
  onClose: () => void;
  grupoAtivo: GrupoPrincipal;
  itensFinanceiros: Array<{
    id: string;
    nome: string;
    grupo_principal: GrupoPrincipal;
  }>;
  onTransacaoCriada: () => void;
  tipoLancamento?: TipoLancamento;
}

export default function ModalNovoLancamento({
  open,
  onClose,
  grupoAtivo,
  itensFinanceiros,
  onTransacaoCriada,
  tipoLancamento = 'despesa'
}: ModalNovoLancamentoProps) {
  const { cartoes } = useAppContext();

  const [formData, setFormData] = useState({
    item_id: '',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    observacoes: '',
    despesaRecorrente: false,
    valorFixo: true,
    formaPagamento: 'vista' as FormaPagamento,
    numeroParcelas: 1,
    cartaoCreditoId: ''
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        item_id: '',
        valor: '',
        data_vencimento: new Date().toISOString().split('T')[0],
        observacoes: '',
        despesaRecorrente: false,
        valorFixo: true,
        formaPagamento: 'vista' as FormaPagamento,
        numeroParcelas: 1,
        cartaoCreditoId: ''
      });
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!formData.item_id || !formData.valor) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    // Validar cartão de crédito se selecionado
    if (formData.formaPagamento === 'cartao' && !formData.cartaoCreditoId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um cartão de crédito.",
        variant: "destructive"
      });
      return;
    }

    const valor = parseFloat(formData.valor);
    if (isNaN(valor) || valor <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido.",
        variant: "destructive"
      });
      return;
    }

    try {
      const input: CreateTransactionInput = {
        valorTotal: valor,
        dataPrimeiraOcorrencia: formData.data_vencimento,
        itemId: formData.item_id,
        observacoes: formData.observacoes,
        isRecorrente: formData.despesaRecorrente,
        isParcelado: formData.formaPagamento === 'parcelado',
        numeroDeParcelas: (formData.formaPagamento === 'parcelado' || formData.formaPagamento === 'cartao') ? formData.numeroParcelas : undefined,
        isValorFixo: formData.despesaRecorrente ? formData.valorFixo : undefined,
        cartaoCreditoId: formData.formaPagamento === 'cartao' ? formData.cartaoCreditoId : undefined
      };

      const result = FinancialEngine.createTransactions(input);

      // Salvar transações
      FinancialEngine.saveTransactions(result.transactions);

      // Salvar template recorrente se aplicável
      if (result.recurringTemplate) {
        FinancialEngine.saveRecurringTemplates([result.recurringTemplate]);
      }

      toast({
        title: "Sucesso",
        description: `${result.transactions.length} transação(ões) criada(s) com sucesso.`,
      });

      onTransacaoCriada();
      onClose();
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Filtrar itens por grupo ativo
  const itensDisponiveis = itensFinanceiros.filter(item => item.grupo_principal === grupoAtivo);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tipoLancamento === 'receita' ? 'Nova Receita' : 'Novo Lançamento'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="item_id">
              {tipoLancamento === 'receita' ? 'Item da Receita' : 'Item da Despesa'} *
            </Label>
            <Select 
              value={formData.item_id} 
              onValueChange={(value) => setFormData({...formData, item_id: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um item..." />
              </SelectTrigger>
              <SelectContent>
                {itensDisponiveis.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.valor}
              onChange={(e) => setFormData({...formData, valor: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_vencimento">Data de Vencimento *</Label>
            <Input
              id="data_vencimento"
              type="date"
              value={formData.data_vencimento}
              onChange={(e) => setFormData({...formData, data_vencimento: e.target.value})}
            />
            <p className="text-xs text-gray-500">
              Status será: <strong>{formData.data_vencimento <= new Date().toISOString().split('T')[0] ? 'Pago' : 'Agendado'}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="despesaRecorrente"
                checked={formData.despesaRecorrente}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  despesaRecorrente: !!checked,
                  formaPagamento: checked ? 'vista' : formData.formaPagamento
                })}
              />
              <Label htmlFor="despesaRecorrente" className="text-sm font-medium">
                {tipoLancamento === 'receita' ? 'Receita Recorrente' : 'Despesa Recorrente'}
              </Label>
            </div>

            {formData.despesaRecorrente && (
              <div className="ml-6 space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="valorFixo"
                    checked={formData.valorFixo}
                    onCheckedChange={(checked) => setFormData({...formData, valorFixo: !!checked})}
                  />
                  <Label htmlFor="valorFixo" className="text-sm">
                    Manter valor fixo mensalmente?
                  </Label>
                </div>
                
                <p className="text-xs text-blue-700">
                  {formData.valorFixo 
                    ? "✓ O valor será mantido fixo todos os meses (ex: Aluguel, Salário)" 
                    : "⚠️ Apenas um lembrete será criado. Você precisará informar o valor a cada mês (ex: Conta de luz, água)"
                  }
                </p>
              </div>
            )}

            {!formData.despesaRecorrente && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Forma de Pagamento</Label>
                <Select 
                  value={formData.formaPagamento} 
                  onValueChange={(value: FormaPagamento) => setFormData({
                    ...formData, 
                    formaPagamento: value,
                    cartaoCreditoId: value !== 'cartao' ? '' : formData.cartaoCreditoId
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vista">À Vista</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                    {tipoLancamento === 'despesa' && (
                      <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {formData.formaPagamento === 'cartao' && (
                  <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="space-y-2">
                      <Label className="text-sm">Selecionar Cartão</Label>
                      <Select 
                        value={formData.cartaoCreditoId} 
                        onValueChange={(value) => setFormData({...formData, cartaoCreditoId: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cartão..." />
                        </SelectTrigger>
                        <SelectContent>
                          {cartoes.filter(c => c.ativo).map(cartao => (
                            <SelectItem key={cartao.id} value={cartao.id}>
                              {cartao.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {!formData.cartaoCreditoId && (
                        <p className="text-sm text-purple-700 mt-2">
                          <span className="font-medium">Cartão de Crédito:</span> Selecione um cartão para continuar
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {(formData.formaPagamento === 'parcelado' || formData.formaPagamento === 'cartao') && (
                  <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="space-y-2">
                      <Label className="text-sm">Número de Parcelas</Label>
                      <Select 
                        value={formData.numeroParcelas.toString()} 
                        onValueChange={(value) => setFormData({...formData, numeroParcelas: parseInt(value)})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({length: 24}, (_, i) => i + 1).map(num => (
                            <SelectItem key={num} value={num.toString()}>
                              {num}x de {formatCurrency(parseFloat(formData.valor || '0') / num)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações opcionais..."
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.item_id || !formData.valor || (formData.formaPagamento === 'cartao' && !formData.cartaoCreditoId)}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}