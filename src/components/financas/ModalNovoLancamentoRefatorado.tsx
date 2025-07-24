import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { GrupoPrincipal, ItemFinanceiro } from '@/types/financas';
import { CreateTransactionInput } from '@/services/FinancialEngine';
import { useAppContext } from '@/contexts/AppContext';

type FormaPagamento = 'avista' | 'parcelado' | 'cartao_credito';
type TipoLancamento = 'despesa' | 'receita';

interface ModalNovoLancamentoRefatoradoProps {
  aberto: boolean;
  onFechar: () => void;
  createTransactionEngine: (input: CreateTransactionInput) => void;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
  grupoAtivo: GrupoPrincipal;
  tipoLancamento?: TipoLancamento; // NOVO: contexto automático
}

export default function ModalNovoLancamentoRefatorado({
  aberto,
  onFechar,
  createTransactionEngine,
  obterItensPorGrupo,
  grupoAtivo,
  tipoLancamento = 'despesa'
}: ModalNovoLancamentoRefatoradoProps) {
  const { cartoes } = useAppContext();
  
  const [formData, setFormData] = useState({
    item_id: '',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    observacoes: '',
    despesaRecorrente: false,
    valorFixo: true,
    formaPagamento: 'avista' as FormaPagamento,
    numeroParcelas: 1,
    cartaoCreditoId: ''
  });

  const limparFormulario = () => {
    setFormData({
      item_id: '',
      valor: '',
      data_vencimento: new Date().toISOString().split('T')[0],
      observacoes: '',
      despesaRecorrente: false,
      valorFixo: true,
      formaPagamento: 'avista',
      numeroParcelas: 1,
      cartaoCreditoId: ''
    });
  };

  const handleSubmit = () => {
    if (!formData.item_id || !formData.valor) return;

    const valor = parseFloat(formData.valor);
    if (isNaN(valor) || valor <= 0) return;

    // Validação específica para cartão de crédito
    if (formData.formaPagamento === 'cartao_credito' && !formData.cartaoCreditoId) {
      return;
    }

    const input: CreateTransactionInput = {
      valorTotal: valor,
      dataPrimeiraOcorrencia: formData.data_vencimento,
      itemId: formData.item_id,
      observacoes: formData.observacoes || '',
      isRecorrente: formData.despesaRecorrente,
      isParcelado: formData.formaPagamento === 'parcelado',
      numeroDeParcelas: formData.formaPagamento === 'parcelado' || formData.formaPagamento === 'cartao_credito' 
        ? formData.numeroParcelas : undefined,
      isValorFixo: formData.valorFixo,
      cartaoCreditoId: formData.formaPagamento === 'cartao_credito' ? formData.cartaoCreditoId : undefined
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

  // Opções de forma de pagamento baseadas no tipo
  const formasPagamento = tipoLancamento === 'receita' 
    ? [
        { value: 'avista', label: 'À Vista' },
        { value: 'parcelado', label: 'Parcelado' }
      ]
    : [
        { value: 'avista', label: 'À Vista' },
        { value: 'parcelado', label: 'Parcelado' },
        { value: 'cartao_credito', label: 'Cartão de Crédito' }
      ];

  const cartoesFiltrados = cartoes.filter(c => c.ativo);

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="sm:max-w-md">
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="despesaRecorrente"
                    checked={formData.despesaRecorrente}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      despesaRecorrente: checked as boolean
                    })}
                  />
                  <Label htmlFor="despesaRecorrente" className="text-sm">
                    {textos.recorrente}
                  </Label>
                </div>

                {/* Checkbox para valor fixo - só aparece quando recorrente está marcada */}
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
              </div>
            </div>
          </div>

          {/* NOVO: Seletor de Forma de Pagamento */}
          <div>
            <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
            <Select 
              value={formData.formaPagamento} 
              onValueChange={(value: FormaPagamento) => setFormData({ 
                ...formData, 
                formaPagamento: value,
                // Reset campos relacionados quando muda forma de pagamento
                numeroParcelas: 1,
                cartaoCreditoId: ''
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formasPagamento.map(forma => (
                  <SelectItem key={forma.value} value={forma.value}>
                    {forma.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo de número de parcelas - aparece para parcelado e cartão */}
          {(formData.formaPagamento === 'parcelado' || formData.formaPagamento === 'cartao_credito') && (
            <div>
              <Label htmlFor="numeroParcelas">Número de Parcelas</Label>
              <Input
                id="numeroParcelas"
                type="number"
                min="1"
                max="24"
                value={formData.numeroParcelas}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  numeroParcelas: parseInt(e.target.value) || 1 
                })}
                placeholder="Ex: 12 para 12 parcelas"
              />
              <p className="text-xs text-gray-500 mt-1">
                Será criado {formData.numeroParcelas} lançamento(s) automático(s)
              </p>
            </div>
          )}

          {/* Seletor de cartão - só aparece para cartão de crédito */}
          {formData.formaPagamento === 'cartao_credito' && (
            <div>
              <Label htmlFor="cartaoSelect">Selecionar Cartão</Label>
              <Select 
                value={formData.cartaoCreditoId} 
                onValueChange={(value) => setFormData({ ...formData, cartaoCreditoId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cartão..." />
                </SelectTrigger>
                <SelectContent>
                  {cartoesFiltrados.map(cartao => (
                    <SelectItem key={cartao.id} value={cartao.id}>
                      {cartao.nome} (Venc: {cartao.diaVencimento})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cartoesFiltrados.length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Nenhum cartão configurado. Vá em Configurações para adicionar.
                </p>
              )}
            </div>
          )}

          {/* Informações contextuais */}
          {formData.formaPagamento === 'cartao_credito' && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-700">
                <strong>Cartão de Crédito:</strong> {formData.cartaoCreditoId ? 
                  `Lançamento será calculado baseado no cartão selecionado` : 
                  'Selecione um cartão para continuar'
                }
              </p>
              {formData.numeroParcelas > 1 && (
                <p className="text-xs text-purple-600 mt-1">
                  ✓ <strong>Parcelado:</strong> Cada parcela será lançada no vencimento da fatura correspondente.
                </p>
              )}
            </div>
          )}

          {formData.despesaRecorrente && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>{textos.recorrente}:</strong> Será criada automaticamente para todos os meses 
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
            <Button 
              onClick={handleSubmit} 
              disabled={
                !formData.item_id || 
                !formData.valor || 
                (formData.formaPagamento === 'cartao_credito' && !formData.cartaoCreditoId)
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