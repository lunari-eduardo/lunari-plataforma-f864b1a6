import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Plus, Trash2 } from 'lucide-react';
import {
  LIST_SHELL,
  ROW_DIVIDER,
  ROW_BASE,
  INLINE_ADD,
  GHOST_INPUT,
  LIST_EMPTY,
} from '@/lib/dialogTokens';
import type { GastoItem } from '@/types/precificacao';

interface CardGastosPessoaisContentProps {
  gastosPessoais: GastoItem[];
  onAdicionar: (gasto: Omit<GastoItem, 'id'>) => void;
  onRemover: (id: string) => void;
  onAtualizar: (id: string, campo: keyof GastoItem, valor: any) => void;
}

export function CardGastosPessoaisContent({
  gastosPessoais,
  onAdicionar,
  onRemover,
  onAtualizar
}: CardGastosPessoaisContentProps) {
  const [novoGasto, setNovoGasto] = useState({ descricao: '', valor: 0 });

  const adicionarGasto = () => {
    if (novoGasto.descricao && novoGasto.valor > 0) {
      onAdicionar({ descricao: novoGasto.descricao, valor: novoGasto.valor });
      setNovoGasto({ descricao: '', valor: 0 });
    }
  };

  return (
    <div className={LIST_SHELL}>
      {/* Adição inline */}
      <div className={INLINE_ADD}>
        <div className="grid grid-cols-[minmax(0,1fr)_128px_32px] items-center gap-2">
          <Input
            placeholder="Ex: Alimentação, Transporte..."
            value={novoGasto.descricao}
            onChange={e => setNovoGasto(prev => ({ ...prev, descricao: e.target.value }))}
            className="h-8 text-[13px]"
          />
          <CurrencyInput
            value={novoGasto.valor}
            onChange={v => setNovoGasto(prev => ({ ...prev, valor: v }))}
            className="h-8 text-[13px]"
          />
          <Button
            onClick={adicionarGasto}
            disabled={!novoGasto.descricao || novoGasto.valor <= 0}
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Adicionar gasto"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className={ROW_DIVIDER}>
        {gastosPessoais.length === 0 ? (
          <p className={LIST_EMPTY}>Nenhum gasto pessoal cadastrado</p>
        ) : (
          gastosPessoais.map(gasto => (
            <div key={gasto.id} className={ROW_BASE}>
              <div className="grid grid-cols-[minmax(0,1fr)_128px_32px] items-center gap-2">
                <Input
                  value={gasto.descricao}
                  onChange={e => onAtualizar(gasto.id, 'descricao', e.target.value)}
                  className={GHOST_INPUT}
                  placeholder="Descrição"
                />
                <CurrencyInput
                  value={gasto.valor}
                  onChange={v => onAtualizar(gasto.id, 'valor', v)}
                  showPrefix={false}
                  className={GHOST_INPUT}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemover(gasto.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
