import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Plus, Trash2 } from 'lucide-react';
import type { Equipamento } from '@/types/precificacao';

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
    <Card className="border-2 shadow-sm bg-card">
      <CardHeader className="pb-3 bg-muted/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Equipamentos</CardTitle>
          </div>
          <div className="text-right">
            <span className="font-bold text-lg text-foreground">
              {formatCurrency(totalDepreciacaoMensal)}
            </span>
            <span className="text-xs text-muted-foreground">/mês</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Formulário de adição */}
        <div className="bg-background border-2 border-dashed border-border rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Nome do Equipamento</Label>
              <Input 
                placeholder="Ex: Câmera Canon R6..." 
                value={novoEquipamento.nome}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, nome: e.target.value }))}
                className="h-9 bg-background border-input"
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
                className="h-9 bg-background border-input"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data Compra</Label>
              <Input 
                type="date"
                value={novoEquipamento.dataCompra}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, dataCompra: e.target.value }))}
                className="h-9 bg-background border-input"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Vida Útil (Anos)</Label>
              <Input 
                type="number" 
                min="1" 
                value={novoEquipamento.vidaUtil}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, vidaUtil: e.target.value }))}
                className="h-9 bg-background border-input"
              />
            </div>
          </div>
          
          {depreciacaoPreview > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              Depreciação mensal: <span className="font-medium text-foreground">{formatCurrency(depreciacaoPreview)}</span>
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
        <div className="space-y-2 max-h-48 overflow-y-auto">
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
                  className="p-3 rounded-lg border border-border bg-muted/40 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Input 
                        value={eq.nome}
                        onChange={e => atualizarEquipamento(eq.id, 'nome', e.target.value)}
                        className="h-8 text-sm font-medium bg-background border-input"
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
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Valor Pago</Label>
                      <Input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={eq.valorPago}
                        onChange={e => atualizarEquipamento(eq.id, 'valorPago', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs bg-background border-input"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Data Compra</Label>
                      <Input 
                        type="date"
                        value={eq.dataCompra}
                        onChange={e => atualizarEquipamento(eq.id, 'dataCompra', e.target.value)}
                        className="h-7 text-xs bg-background border-input"
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
                          className="h-7 text-xs bg-background border-input"
                        />
                        <span className="text-[10px] text-muted-foreground">anos</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Depreciação/mês</Label>
                      <div className="h-7 px-2 bg-muted/50 rounded border flex items-center justify-center">
                        <span className="text-xs font-medium text-foreground">
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
    </Card>
  );
}
