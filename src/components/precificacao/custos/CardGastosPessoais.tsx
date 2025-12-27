import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Plus, Trash2 } from 'lucide-react';
import type { GastoItem } from '@/types/precificacao';

interface CardGastosPessoaisProps {
  gastosPessoais: GastoItem[];
  setGastosPessoais: React.Dispatch<React.SetStateAction<GastoItem[]>>;
  totalGastosPessoais: number;
}

export function CardGastosPessoais({
  gastosPessoais,
  setGastosPessoais,
  totalGastosPessoais
}: CardGastosPessoaisProps) {
  const [novoGasto, setNovoGasto] = useState({ descricao: '', valor: '' });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const adicionarGasto = () => {
    if (novoGasto.descricao && novoGasto.valor) {
      setGastosPessoais(prev => [...prev, {
        id: Date.now().toString(),
        descricao: novoGasto.descricao,
        valor: parseFloat(novoGasto.valor) || 0
      }]);
      setNovoGasto({ descricao: '', valor: '' });
    }
  };

  const atualizarGasto = (id: string, campo: keyof GastoItem, valor: any) => {
    setGastosPessoais(prev => prev.map(item => 
      item.id === id ? { ...item, [campo]: valor } : item
    ));
  };

  const removerGasto = (id: string) => {
    setGastosPessoais(prev => prev.filter(item => item.id !== id));
  };

  return (
    <Card className="border-2 shadow-sm bg-card">
      <CardHeader className="pb-3 bg-muted/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Gastos Pessoais</CardTitle>
          </div>
          <span className="font-bold text-lg text-foreground">
            {formatCurrency(totalGastosPessoais)}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Formulário de adição */}
        <div className="bg-background border-2 border-dashed border-border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Input 
                placeholder="Ex: Alimentação, Transporte..." 
                value={novoGasto.descricao}
                onChange={e => setNovoGasto(prev => ({ ...prev, descricao: e.target.value }))}
                className="h-9 bg-background border-input"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Valor</Label>
              <Input 
                type="number" 
                min="0" 
                step="0.01"
                placeholder="0,00" 
                value={novoGasto.valor}
                onChange={e => setNovoGasto(prev => ({ ...prev, valor: e.target.value }))}
                className="h-9 bg-background border-input"
              />
            </div>
          </div>
          <Button 
            onClick={adicionarGasto} 
            disabled={!novoGasto.descricao || !novoGasto.valor}
            className="w-full mt-3 h-9"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Gasto
          </Button>
        </div>

        {/* Lista de gastos */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {gastosPessoais.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum gasto pessoal cadastrado
            </p>
          ) : (
            gastosPessoais.map(gasto => (
              <div 
                key={gasto.id} 
                className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/40 shadow-sm"
              >
                <Input 
                  value={gasto.descricao}
                  onChange={e => atualizarGasto(gasto.id, 'descricao', e.target.value)}
                  className="flex-1 h-8 text-sm bg-background border-input"
                  placeholder="Descrição"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={gasto.valor}
                    onChange={e => atualizarGasto(gasto.id, 'valor', parseFloat(e.target.value) || 0)}
                    className="w-24 h-8 text-sm text-right bg-background border-input"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removerGasto(gasto.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
