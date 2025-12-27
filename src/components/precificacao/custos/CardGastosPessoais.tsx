import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { User, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { GastoItem } from '@/types/precificacao';
import { cn } from '@/lib/utils';

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
  const [isOpen, setIsOpen] = useState(false);
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
    <Card className="overflow-hidden shadow-sm border-2 hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-base">Gastos Pessoais</CardTitle>
          </div>
          <Badge variant="outline" className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 font-bold">
            {formatCurrency(totalGastosPessoais)}
          </Badge>
        </div>
      </CardHeader>
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between rounded-none border-t h-10 hover:bg-muted/50"
          >
            <span className="text-sm text-muted-foreground">
              {gastosPessoais.length} {gastosPessoais.length === 1 ? 'item' : 'itens'} cadastrados
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {/* Formulário de adição rápida */}
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <Input 
                    placeholder="Ex: Alimentação, Transporte..." 
                    value={novoGasto.descricao}
                    onChange={e => setNovoGasto(prev => ({ ...prev, descricao: e.target.value }))}
                    className="h-9"
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
                    className="h-9"
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
            <div className="space-y-2">
              {gastosPessoais.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum gasto pessoal cadastrado
                </p>
              ) : (
                gastosPessoais.map(gasto => (
                  <div 
                    key={gasto.id} 
                    className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <Input 
                      value={gasto.descricao}
                      onChange={e => atualizarGasto(gasto.id, 'descricao', e.target.value)}
                      className="flex-1 h-8 text-sm border-0 bg-transparent focus-visible:ring-1"
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
                        className="w-24 h-8 text-sm text-right border-0 bg-transparent focus-visible:ring-1"
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
