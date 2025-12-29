import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';
import { EtapaColapsavel } from './EtapaColapsavel';
import type { Equipamento } from '@/types/precificacao';

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
    valorPago: '',
    dataCompra: '',
    vidaUtil: '5'
  });

  const equipamentos = estruturaCustos?.equipamentos || [];
  
  const totalDepreciacaoMensal = equipamentos.reduce((total, eq) => {
    const depreciacaoMensal = eq.valorPago / (eq.vidaUtil * 12);
    return total + depreciacaoMensal;
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calcularDepreciacao = (valorPago: number, vidaUtil: number) => {
    return valorPago / (vidaUtil * 12);
  };

  const handleAdicionar = () => {
    if (novoEquipamento.nome && novoEquipamento.valorPago) {
      adicionarEquipamento({
        nome: novoEquipamento.nome,
        valorPago: parseFloat(novoEquipamento.valorPago) || 0,
        dataCompra: novoEquipamento.dataCompra || new Date().toISOString().split('T')[0],
        vidaUtil: parseInt(novoEquipamento.vidaUtil) || 5
      });
      setNovoEquipamento({
        nome: '',
        valorPago: '',
        dataCompra: '',
        vidaUtil: '5'
      });
    }
  };

  const depreciacaoPreview = novoEquipamento.valorPago && novoEquipamento.vidaUtil
    ? calcularDepreciacao(parseFloat(novoEquipamento.valorPago), parseInt(novoEquipamento.vidaUtil))
    : 0;

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
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
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
      <div className="space-y-4">
        {/* Header com total */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-purple-500/5 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-purple-800 dark:text-purple-300">
              Total de Depreciação Mensal
            </span>
          </div>
          <div className="text-right">
            <span className="font-bold text-2xl text-foreground">
              {formatCurrency(totalDepreciacaoMensal)}
            </span>
            <span className="text-sm text-muted-foreground ml-1">/mês</span>
          </div>
        </div>

        {/* Formulário de adição */}
        <Card className="border bg-card">
          <CardContent className="p-4">
            <div className="bg-background border-2 border-dashed border-border rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="sm:col-span-2">
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
                <div className="mt-2 text-sm text-muted-foreground">
                  Depreciação mensal: <span className="font-medium text-foreground">{formatCurrency(depreciacaoPreview)}</span>
                </div>
              )}
              
              <Button 
                onClick={handleAdicionar} 
                disabled={!novoEquipamento.nome || !novoEquipamento.valorPago}
                className="w-full mt-3"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Equipamento
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de equipamentos */}
        <Card className="border bg-card">
          <CardContent className="p-4">
            <div className="space-y-3">
              {equipamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum equipamento cadastrado
                </p>
              ) : (
                equipamentos.map(eq => {
                  const depreciacao = calcularDepreciacao(eq.valorPago, eq.vidaUtil);
                  return (
                    <div 
                      key={eq.id} 
                      className="p-4 rounded-lg border border-border bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <Input 
                            value={eq.nome}
                            onChange={e => atualizarEquipamento(eq.id, 'nome', e.target.value)}
                            className="h-9 text-sm font-medium bg-background border-input"
                            placeholder="Nome do equipamento"
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={() => removerEquipamento(eq.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Valor Pago</Label>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={eq.valorPago}
                            onChange={e => atualizarEquipamento(eq.id, 'valorPago', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm bg-background border-input"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Data Compra</Label>
                          <Input 
                            type="date"
                            value={eq.dataCompra}
                            onChange={e => atualizarEquipamento(eq.id, 'dataCompra', e.target.value)}
                            className="h-8 text-sm bg-background border-input"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Vida Útil</Label>
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number"
                              min="1"
                              value={eq.vidaUtil}
                              onChange={e => atualizarEquipamento(eq.id, 'vidaUtil', parseInt(e.target.value) || 1)}
                              className="h-8 text-sm bg-background border-input"
                            />
                            <span className="text-xs text-muted-foreground">anos</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Depreciação/mês</Label>
                          <div className="h-8 px-3 bg-purple-500/10 rounded border border-purple-500/30 flex items-center justify-center">
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
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
      </div>
    </EtapaColapsavel>
  );
}
