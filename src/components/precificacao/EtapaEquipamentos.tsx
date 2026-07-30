import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';
import { EtapaColapsavel } from './EtapaColapsavel';
import { formatCurrency } from '@/utils/currencyUtils';
import {
  LIST_SHELL,
  ROW_DIVIDER,
  ROW_HEADER,
  ROW_BASE,
  INLINE_ADD,
  GHOST_INPUT,
  GOLD_ICON,
  LIST_EMPTY,
} from '@/lib/dialogTokens';

/** Grade única compartilhada entre cabeçalho, formulário e linhas. */
const GRID = 'grid grid-cols-[minmax(0,1fr)_112px_120px_64px_104px_32px] items-center gap-2';

export function EtapaEquipamentos() {
  const {
    estruturaCustos,
    loading,
    statusSalvamento,
    adicionarEquipamento,
    removerEquipamento,
    atualizarEquipamento
  } = usePricing();

  const [novoEquipamento, setNovoEquipamento] = useState({
    nome: '',
    valorPago: 0,
    dataCompra: '',
    vidaUtil: '5'
  });

  const equipamentos = estruturaCustos?.equipamentos || [];

  const calcularDepreciacao = (valorPago: number, vidaUtil: number) =>
    vidaUtil > 0 ? valorPago / (vidaUtil * 12) : 0;

  const totalDepreciacaoMensal = equipamentos.reduce(
    (total, eq) => total + calcularDepreciacao(eq.valorPago, eq.vidaUtil),
    0
  );

  const handleAdicionar = () => {
    if (novoEquipamento.nome && novoEquipamento.valorPago > 0) {
      adicionarEquipamento({
        nome: novoEquipamento.nome,
        valorPago: novoEquipamento.valorPago,
        dataCompra: novoEquipamento.dataCompra || new Date().toISOString().split('T')[0],
        vidaUtil: parseInt(novoEquipamento.vidaUtil) || 5
      });
      setNovoEquipamento({ nome: '', valorPago: 0, dataCompra: '', vidaUtil: '5' });
    }
  };

  const depreciacaoPreview = calcularDepreciacao(
    novoEquipamento.valorPago,
    parseInt(novoEquipamento.vidaUtil) || 0
  );

  if (loading) {
    return (
      <EtapaColapsavel
        numero={2}
        titulo="Meus Equipamentos"
        descricao="Depreciação dos seus equipamentos"
        defaultOpen={false}
        statusSalvamento="salvando"
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-5 w-5 rounded-full border border-muted-foreground/40 border-t-transparent" />
        </div>
      </EtapaColapsavel>
    );
  }

  return (
    <EtapaColapsavel
      numero={2}
      titulo="Meus Equipamentos"
      descricao="Depreciação dos seus equipamentos"
      defaultOpen={false}
      statusSalvamento={statusSalvamento}
    >
      <div className="space-y-3">
        {/* Faixa de total — sem card, apenas hairline */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Camera className={GOLD_ICON} />
            <span className="text-[13px] font-semibold text-foreground">
              Depreciação mensal total
            </span>
          </div>
          <div className="text-right">
            <span className="text-[15px] font-semibold tabular-nums text-[hsl(var(--accent-gold))]">
              {formatCurrency(totalDepreciacaoMensal)}
            </span>
            <span className="ml-1 text-[11px] text-muted-foreground">/mês</span>
          </div>
        </div>

        <div className={LIST_SHELL}>
          {/* Cabeçalho da grade (desktop) */}
          <div className={`hidden sm:block ${ROW_HEADER} border-b border-border/60`}>
            <div className={GRID}>
              <span>Equipamento</span>
              <span className="text-right">Valor pago</span>
              <span className="text-right">Compra</span>
              <span className="text-right">Anos</span>
              <span className="text-right">Depreciação</span>
              <span />
            </div>
          </div>

          {/* Adição inline */}
          <div className={INLINE_ADD}>
            <div className={`${GRID} max-sm:grid-cols-2`}>
              <Input
                placeholder="Ex: Câmera Canon R6..."
                value={novoEquipamento.nome}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, nome: e.target.value }))}
                className="h-8 text-[13px] max-sm:col-span-2"
              />
              <CurrencyInput
                value={novoEquipamento.valorPago}
                onChange={v => setNovoEquipamento(prev => ({ ...prev, valorPago: v }))}
                className="h-8 text-[13px]"
              />
              <Input
                type="date"
                value={novoEquipamento.dataCompra}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, dataCompra: e.target.value }))}
                className="h-8 text-[13px]"
              />
              <Input
                type="number"
                min="1"
                value={novoEquipamento.vidaUtil}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, vidaUtil: e.target.value }))}
                className="h-8 text-[13px] text-right"
              />
              <span className="text-right text-[12px] tabular-nums text-muted-foreground max-sm:hidden">
                {depreciacaoPreview > 0 ? formatCurrency(depreciacaoPreview) : '—'}
              </span>
              <Button
                onClick={handleAdicionar}
                disabled={!novoEquipamento.nome || novoEquipamento.valorPago <= 0}
                size="icon"
                variant="ghost"
                className="h-8 w-8 max-sm:col-span-2 max-sm:w-full"
                title="Adicionar equipamento"
              >
                <Plus className="h-4 w-4" />
                <span className="sm:hidden ml-1 text-[13px]">Adicionar</span>
              </Button>
            </div>
          </div>

          {/* Lista */}
          <div className={ROW_DIVIDER}>
            {equipamentos.length === 0 ? (
              <p className={LIST_EMPTY}>Nenhum equipamento cadastrado</p>
            ) : (
              equipamentos.map(eq => {
                const depreciacao = calcularDepreciacao(eq.valorPago, eq.vidaUtil);
                return (
                  <div key={eq.id} className={ROW_BASE}>
                    <div className={`${GRID} max-sm:grid-cols-2`}>
                      <Input
                        value={eq.nome}
                        onChange={e => atualizarEquipamento(eq.id, 'nome', e.target.value)}
                        className={`${GHOST_INPUT} font-medium max-sm:col-span-2`}
                        placeholder="Nome do equipamento"
                      />
                      <CurrencyInput
                        value={eq.valorPago}
                        onChange={v => atualizarEquipamento(eq.id, 'valorPago', v)}
                        showPrefix={false}
                        className={GHOST_INPUT}
                      />
                      <Input
                        type="date"
                        value={eq.dataCompra}
                        onChange={e => atualizarEquipamento(eq.id, 'dataCompra', e.target.value)}
                        className={`${GHOST_INPUT} text-right`}
                      />
                      <Input
                        type="number"
                        min="1"
                        value={eq.vidaUtil}
                        onChange={e => atualizarEquipamento(eq.id, 'vidaUtil', parseInt(e.target.value) || 1)}
                        className={`${GHOST_INPUT} text-right`}
                      />
                      <span className="text-right text-[13px] font-medium tabular-nums text-[hsl(var(--accent-gold))] max-sm:text-left">
                        {formatCurrency(depreciacao)}
                        <span className="ml-0.5 text-[11px] opacity-70">/mês</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive max-sm:justify-self-end"
                        onClick={() => removerEquipamento(eq.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </EtapaColapsavel>
  );
}
