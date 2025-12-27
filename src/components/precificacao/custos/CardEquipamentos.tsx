import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Camera, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Equipamento } from '@/types/precificacao';
import { cn } from '@/lib/utils';

interface CardEquipamentosProps {
  equipamentos: Equipamento[];
  setEquipamentos: React.Dispatch<React.SetStateAction<Equipamento[]>>;
  totalDepreciacaoMensal: number;
}

export function CardEquipamentos({
  equipamentos,
  setEquipamentos,
  totalDepreciacaoMensal
}: CardEquipamentosProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [novoEquipamento, setNovoEquipamento] = useState({
    nome: '',
    valorPago: '',
    dataCompra: '',
    vidaUtil: '5'
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calcularDepreciacao = (valorPago: number, vidaUtil: number) => {
    return valorPago / (vidaUtil * 12);
  };

  const adicionarEquipamento = () => {
    if (novoEquipamento.nome && novoEquipamento.valorPago) {
      setEquipamentos(prev => [...prev, {
        id: Date.now().toString(),
        nome: novoEquipamento.nome,
        valorPago: parseFloat(novoEquipamento.valorPago) || 0,
        dataCompra: novoEquipamento.dataCompra || new Date().toISOString().split('T')[0],
        vidaUtil: parseInt(novoEquipamento.vidaUtil) || 5
      }]);
      setNovoEquipamento({
        nome: '',
        valorPago: '',
        dataCompra: '',
        vidaUtil: '5'
      });
    }
  };

  const atualizarEquipamento = (id: string, campo: keyof Equipamento, valor: any) => {
    setEquipamentos(prev => prev.map(item => 
      item.id === id ? { ...item, [campo]: valor } : item
    ));
  };

  const removerEquipamento = (id: string) => {
    setEquipamentos(prev => prev.filter(item => item.id !== id));
  };

  const depreciacaoPreview = novoEquipamento.valorPago && novoEquipamento.vidaUtil
    ? calcularDepreciacao(parseFloat(novoEquipamento.valorPago), parseInt(novoEquipamento.vidaUtil))
    : 0;

  return (
    <Card className="overflow-hidden shadow-sm border-2 hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
              <Camera className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-base">Equipamentos</CardTitle>
          </div>
          <Badge variant="outline" className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 font-bold">
            {formatCurrency(totalDepreciacaoMensal)}/mês
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
              {equipamentos.length} {equipamentos.length === 1 ? 'equipamento' : 'equipamentos'} cadastrados
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {/* Formulário de adição */}
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome do Equipamento</Label>
                  <Input 
                    placeholder="Ex: Câmera Canon R6..." 
                    value={novoEquipamento.nome}
                    onChange={e => setNovoEquipamento(prev => ({ ...prev, nome: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Pago</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01"
                    placeholder="0,00" 
                    value={novoEquipamento.valorPago}
                    onChange={e => setNovoEquipamento(prev => ({ ...prev, valorPago: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vida Útil (Anos)</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={novoEquipamento.vidaUtil}
                    onChange={e => setNovoEquipamento(prev => ({ ...prev, vidaUtil: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
              
              {depreciacaoPreview > 0 && (
                <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                  Depreciação mensal: {formatCurrency(depreciacaoPreview)}
                </div>
              )}
              
              <Button 
                onClick={adicionarEquipamento} 
                disabled={!novoEquipamento.nome || !novoEquipamento.valorPago}
                className="w-full mt-3 h-9"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Equipamento
              </Button>
            </div>

            {/* Lista de equipamentos */}
            <div className="space-y-2">
              {equipamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum equipamento cadastrado
                </p>
              ) : (
                equipamentos.map(eq => {
                  const depreciacao = calcularDepreciacao(eq.valorPago, eq.vidaUtil);
                  return (
                    <div 
                      key={eq.id} 
                      className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Input 
                            value={eq.nome}
                            onChange={e => atualizarEquipamento(eq.id, 'nome', e.target.value)}
                            className="h-8 text-sm font-medium border-0 bg-transparent focus-visible:ring-1 p-0"
                            placeholder="Nome do equipamento"
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={() => removerEquipamento(eq.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Valor Pago</Label>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={eq.valorPago}
                            onChange={e => atualizarEquipamento(eq.id, 'valorPago', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Vida Útil</Label>
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number"
                              min="1"
                              value={eq.vidaUtil}
                              onChange={e => atualizarEquipamento(eq.id, 'vidaUtil', parseInt(e.target.value) || 1)}
                              className="h-7 text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground">anos</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Depreciação/mês</Label>
                          <div className="h-7 px-2 bg-purple-50 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-700 flex items-center justify-center">
                            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                              {formatCurrency(depreciacao)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
