import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppContext } from '@/contexts/AppContext';

type FormaPagamento = 'avista' | 'parcelado' | 'cartao_credito';

interface OpcoesAvancadas {
  despesaRecorrente: boolean;
  formaPagamento: FormaPagamento;
  numeroParcelas: number;
  cartaoCreditoId: string;
}

interface PopoverOpcoesAvancadasProps {
  opcoes: OpcoesAvancadas;
  onOpcoesChange: (opcoes: OpcoesAvancadas) => void;
  tipoLancamento?: 'despesa' | 'receita';
}

export default function PopoverOpcoesAvancadas({
  opcoes,
  onOpcoesChange,
  tipoLancamento = 'despesa'
}: PopoverOpcoesAvancadasProps) {
  const { cartoes } = useAppContext();
  const [aberto, setAberto] = useState(false);

  const handleOpcoesChange = (novasOpcoes: Partial<OpcoesAvancadas>) => {
    onOpcoesChange({ ...opcoes, ...novasOpcoes });
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
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          title="Opções avançadas"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Opções Avançadas</h4>
            
            {/* Checkbox para despesa recorrente */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="despesaRecorrentePopover"
                checked={opcoes.despesaRecorrente}
                onCheckedChange={(checked) => handleOpcoesChange({ 
                  despesaRecorrente: checked as boolean
                })}
              />
              <Label htmlFor="despesaRecorrentePopover" className="text-sm">
                {tipoLancamento === 'receita' ? 'Receita Recorrente' : 'Despesa Recorrente'}
              </Label>
            </div>

            {/* Seletor de forma de pagamento */}
            <div className="space-y-2">
              <Label className="text-sm">Forma de Pagamento</Label>
              <Select 
                value={opcoes.formaPagamento} 
                onValueChange={(value: FormaPagamento) => handleOpcoesChange({ 
                  formaPagamento: value,
                  // Reset campos relacionados quando muda forma de pagamento
                  numeroParcelas: 1,
                  cartaoCreditoId: ''
                })}
              >
                <SelectTrigger className="h-8">
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
            {(opcoes.formaPagamento === 'parcelado' || opcoes.formaPagamento === 'cartao_credito') && (
              <div className="space-y-2">
                <Label className="text-sm">Número de Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={opcoes.numeroParcelas}
                  onChange={(e) => handleOpcoesChange({ 
                    numeroParcelas: parseInt(e.target.value) || 1 
                  })}
                  className="h-8"
                  placeholder="Ex: 12"
                />
              </div>
            )}

            {/* Seletor de cartão - só aparece para cartão de crédito */}
            {opcoes.formaPagamento === 'cartao_credito' && (
              <div className="space-y-2">
                <Label className="text-sm">Selecionar Cartão</Label>
                <Select 
                  value={opcoes.cartaoCreditoId} 
                  onValueChange={(value) => handleOpcoesChange({ cartaoCreditoId: value })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cartoesFiltrados.map(cartao => (
                      <SelectItem key={cartao.id} value={cartao.id}>
                        {cartao.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cartoesFiltrados.length === 0 && (
                  <p className="text-xs text-red-600">
                    Nenhum cartão configurado.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Informações contextuais */}
          {opcoes.formaPagamento === 'cartao_credito' && opcoes.cartaoCreditoId && (
            <div className="p-2 bg-purple-50 rounded border border-purple-200">
              <p className="text-xs text-purple-700">
                <strong>Cartão:</strong> Vencimento calculado automaticamente
              </p>
            </div>
          )}

          {opcoes.despesaRecorrente && (
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-700">
                <strong>Recorrente:</strong> Criado mensalmente até o final do ano
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}