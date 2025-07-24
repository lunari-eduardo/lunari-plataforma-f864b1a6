import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';

interface OpcoesLancamentoState {
  despesaRecorrente: boolean;
  cartaoCredito: boolean;
  cartaoCreditoId: string;
  numeroParcelas: number;
}

interface OpcoesLancamentoProps {
  opcoes: OpcoesLancamentoState;
  onOpcoesChange: (opcoes: OpcoesLancamentoState) => void;
  tipoLancamento: 'despesa' | 'receita';
  layout?: 'modal' | 'popover';
}

export default function OpcoesLancamento({
  opcoes,
  onOpcoesChange,
  tipoLancamento,
  layout = 'modal'
}: OpcoesLancamentoProps) {
  const { cartoes } = useAppContext();

  const handleOpcoesChange = (novasOpcoes: Partial<OpcoesLancamentoState>) => {
    onOpcoesChange({ ...opcoes, ...novasOpcoes });
  };

  const cartoesFiltrados = cartoes.filter(c => c.ativo);

  const isPopoverLayout = layout === 'popover';
  const labelClassName = isPopoverLayout ? "text-xs" : "text-sm";
  const inputClassName = isPopoverLayout ? "h-8" : "";

  // Textos adaptativos baseados no tipo de lançamento
  const textos = {
    recorrente: tipoLancamento === 'receita' ? 'Receita Recorrente' : 'Despesa Recorrente'
  };

  return (
    <div className="space-y-4">
      {/* Checkbox para recorrente */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="despesaRecorrente"
          checked={opcoes.despesaRecorrente}
          onCheckedChange={(checked) => handleOpcoesChange({ 
            despesaRecorrente: checked as boolean
          })}
        />
        <Label htmlFor="despesaRecorrente" className={labelClassName}>
          {textos.recorrente}
        </Label>
      </div>

      {/* Checkbox para cartão de crédito - só aparece para despesas */}
      {tipoLancamento === 'despesa' && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="cartaoCredito"
            checked={opcoes.cartaoCredito}
            onCheckedChange={(checked) => handleOpcoesChange({ 
              cartaoCredito: checked as boolean,
              // Reset campos relacionados quando desmarca
              cartaoCreditoId: checked ? opcoes.cartaoCreditoId : '',
              numeroParcelas: checked ? opcoes.numeroParcelas : 1
            })}
          />
          <Label htmlFor="cartaoCredito" className={labelClassName}>
            Cartão de Crédito
          </Label>
        </div>
      )}

      {/* Campos condicionais para cartão de crédito */}
      {opcoes.cartaoCredito && tipoLancamento === 'despesa' && (
        <div className="ml-6 space-y-3">
          {/* Seletor de cartão */}
          <div className="space-y-2">
            <Label className={labelClassName}>Selecionar Cartão</Label>
            <Select 
              value={opcoes.cartaoCreditoId} 
              onValueChange={(value) => handleOpcoesChange({ cartaoCreditoId: value })}
            >
              <SelectTrigger className={inputClassName}>
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
              <p className="text-xs text-red-600">
                Nenhum cartão configurado. Vá em Configurações para adicionar.
              </p>
            )}
          </div>

          {/* Número de parcelas */}
          <div className="space-y-2">
            <Label className={labelClassName}>Número de Parcelas</Label>
            <Input
              type="number"
              min="1"
              max="24"
              value={opcoes.numeroParcelas}
              onChange={(e) => handleOpcoesChange({ 
                numeroParcelas: parseInt(e.target.value) || 1 
              })}
              className={inputClassName}
              placeholder="Ex: 12 para 12 parcelas"
            />
            <p className="text-xs text-gray-500">
              Será criado {opcoes.numeroParcelas} lançamento(s) automático(s)
            </p>
          </div>
        </div>
      )}

      {/* Informações contextuais */}
      {opcoes.cartaoCredito && opcoes.cartaoCreditoId && tipoLancamento === 'despesa' && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-700">
            <strong>Cartão de Crédito:</strong> Lançamento será calculado baseado no cartão selecionado
          </p>
          {opcoes.numeroParcelas > 1 && (
            <p className="text-xs text-purple-600 mt-1">
              ✓ <strong>Parcelado:</strong> Cada parcela será lançada no vencimento da fatura correspondente.
            </p>
          )}
        </div>
      )}

      {opcoes.despesaRecorrente && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            <strong>{textos.recorrente}:</strong> Será criada automaticamente para todos os meses 
            restantes do ano {new Date().getFullYear()}.
          </p>
        </div>
      )}
    </div>
  );
}

export type { OpcoesLancamentoState };