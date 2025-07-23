import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { GrupoPrincipal, ItemFinanceiro, NovaTransacaoFinanceira, StatusTransacao } from '@/types/financas';
import { CreateTransactionInput } from '@/services/FinancialEngine';

interface ModalNovoLancamentoProps {
  aberto: boolean;
  onFechar: () => void;
  onAdicionarTransacao: (transacao: Omit<NovaTransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
  createTransactionEngine?: (input: CreateTransactionInput) => void;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
  grupoAtivo: GrupoPrincipal;
}

export default function ModalNovoLancamento({
  aberto,
  onFechar,
  onAdicionarTransacao,
  createTransactionEngine,
  obterItensPorGrupo,
  grupoAtivo
}: ModalNovoLancamentoProps) {
  const [formData, setFormData] = useState({
    item_id: '',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    observacoes: '',
    parcelado: false,
    parcelas: { atual: 1, total: 1 },
    despesaRecorrente: false,
    valorFixo: true // Novo estado para controlar se o valor é fixo ou variável
  });

  // Função para determinar status automático baseado na data
  const determinarStatus = (dataVencimento: string): StatusTransacao => {
    const hoje = new Date().toISOString().split('T')[0];
    return dataVencimento <= hoje ? 'Pago' : 'Agendado';
  };

  const limparFormulario = () => {
    setFormData({
      item_id: '',
      valor: '',
      data_vencimento: new Date().toISOString().split('T')[0],
      observacoes: '',
      parcelado: false,
      parcelas: { atual: 1, total: 1 },
      despesaRecorrente: false,
      valorFixo: true
    });
  };

  const handleSubmit = () => {
    if (!formData.item_id || !formData.valor) return;

    const valor = parseFloat(formData.valor);
    if (isNaN(valor) || valor <= 0) return;

    // Usar o motor centralizado se disponível, senão usar implementação legada
    if (createTransactionEngine) {
      createTransactionEngine({
        valorTotal: valor,
        dataPrimeiraOcorrencia: formData.data_vencimento,
        itemId: formData.item_id,
        observacoes: formData.observacoes || '',
        isRecorrente: formData.despesaRecorrente,
        isParcelado: formData.parcelado,
        numeroDeParcelas: formData.parcelado ? formData.parcelas.total : undefined,
        isValorFixo: formData.valorFixo // Integração com o novo campo
      });
    } else {
      // Implementação legada para compatibilidade
      const baseTransacao = {
        item_id: formData.item_id,
        valor,
        data_vencimento: formData.data_vencimento,
        status: determinarStatus(formData.data_vencimento),
        observacoes: formData.observacoes || null,
        parcelas: formData.parcelado ? formData.parcelas : null
      };

      if (formData.parcelado) {
        // Criar múltiplas transações para parcelas
        const valorDaParcela = valor / formData.parcelas.total;
        
        for (let i = 1; i <= formData.parcelas.total; i++) {
          const dataVencimento = new Date(formData.data_vencimento);
          dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
          
          onAdicionarTransacao({
            ...baseTransacao,
            valor: valorDaParcela,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: determinarStatus(dataVencimento.toISOString().split('T')[0]),
            parcelas: { atual: i, total: formData.parcelas.total }
          });
        }
      } else if (formData.despesaRecorrente) {
        // Criar transações recorrentes até o final do ano
        const dataInicial = new Date(formData.data_vencimento);
        const anoAtual = dataInicial.getFullYear();
        
        for (let mes = dataInicial.getMonth(); mes < 12; mes++) {
          const dataVencimento = new Date(anoAtual, mes, dataInicial.getDate());
          
          onAdicionarTransacao({
            ...baseTransacao,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: determinarStatus(dataVencimento.toISOString().split('T')[0])
          });
        }
      } else {
        // Transação única
        onAdicionarTransacao(baseTransacao);
      }
    }

    limparFormulario();
    onFechar();
  };

  // Usar preferencialmente itens do grupo ativo, mas permitir todos
  const itensGrupoAtivo = obterItensPorGrupo(grupoAtivo);
  const todosItens = ['Despesa Fixa', 'Despesa Variável', 'Investimento', 'Receita Não Operacional']
    .flatMap(grupo => obterItensPorGrupo(grupo as GrupoPrincipal));

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="item">Item da Despesa</Label>
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
              <p className="text-xs text-gray-500 mt-1">
                Status será: <strong>{determinarStatus(formData.data_vencimento)}</strong>
              </p>
            </div>

            <div>
              <Label>Opções</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="despesaRecorrente"
                    checked={formData.despesaRecorrente}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      despesaRecorrente: checked as boolean,
                      parcelado: checked ? false : formData.parcelado 
                    })}
                  />
                  <Label htmlFor="despesaRecorrente" className="text-sm">
                    Despesa Recorrente
                  </Label>
                </div>

                {/* Checkbox para valor fixo - só aparece quando despesa recorrente está marcada */}
                {formData.despesaRecorrente && (
                  <div className="flex items-center space-x-2 ml-6">
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
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parcelado"
                    checked={formData.parcelado}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      parcelado: checked as boolean,
                      despesaRecorrente: checked ? false : formData.despesaRecorrente 
                    })}
                  />
                  <Label htmlFor="parcelado" className="text-sm">
                    Lançamento Parcelado
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {formData.parcelado && (
            <div>
              <Label htmlFor="totalParcelas">Número de Parcelas</Label>
              <Input
                id="totalParcelas"
                type="number"
                min="1"
                max="24"
                value={formData.parcelas.total}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  parcelas: { 
                    atual: 1,
                    total: parseInt(e.target.value) || 1 
                  }
                })}
                placeholder="Ex: 12 para 12 parcelas"
              />
              <p className="text-xs text-gray-500 mt-1">
                Será criado {formData.parcelas.total} lançamento(s) automático(s)
              </p>
            </div>
          )}

          {formData.despesaRecorrente && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>Despesa Recorrente:</strong> Será criada automaticamente para todos os meses 
                restantes do ano {new Date().getFullYear()}.
              </p>
              {formData.valorFixo ? (
                <p className="text-xs text-green-700 mt-1">
                  ✓ <strong>Valor Fixo:</strong> O valor R$ {formData.valor || '0,00'} será mantido em todos os meses.
                </p>
              ) : (
                <p className="text-xs text-orange-700 mt-1">
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
            <Button onClick={handleSubmit} disabled={!formData.item_id || !formData.valor}>
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}