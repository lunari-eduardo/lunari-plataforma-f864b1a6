import { useState } from 'react';
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
      <div className="space-y-3">
        {/* Header com total */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-card/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
            <span className="text-[13px] font-medium text-foreground">
              Depreciação mensal total
            </span>
          </div>
          <div className="text-right">
            <span className="text-[17px] font-semibold tabular-nums" style={{ color: 'hsl(var(--accent-gold))' }}>
              {formatCurrency(totalDepreciacaoMensal)}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1">/mês</span>
          </div>
        </div>

        {/* Formulário de adição */}
        <div className="rounded-lg border border-border/20 bg-card/60 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Nome do equipamento</Label>
              <Input
                placeholder="Ex: Câmera Canon R6..."
                value={novoEquipamento.nome}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, nome: e.target.value }))}
                className="h-8 mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Valor pago</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={novoEquipamento.valorPago}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, valorPago: e.target.value }))}
                className="h-8 mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Data da compra</Label>
              <Input
                type="date"
                value={novoEquipamento.dataCompra}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, dataCompra: e.target.value }))}
                className="h-8 mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Vida útil (anos)</Label>
              <Input
                type="number"
                min="1"
                value={novoEquipamento.vidaUtil}
                onChange={e => setNovoEquipamento(prev => ({ ...prev, vidaUtil: e.target.value }))}
                className="h-8 mt-1 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-2.5">
            <span className="text-xs text-muted-foreground">
              {depreciacaoPreview > 0
                ? <>Depreciação mensal: <span className="font-medium text-foreground tabular-nums">{formatCurrency(depreciacaoPreview)}</span></>
                : 'Informe nome e valor para adicionar'}
            </span>
            <Button
              onClick={handleAdicionar}
              disabled={!novoEquipamento.nome || !novoEquipamento.valorPago}
              size="sm"
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Lista de equipamentos */}
        <div className="rounded-lg border border-border/20 bg-card/60 divide-y divide-border/20">
          {equipamentos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhum equipamento cadastrado
            </p>
          ) : (
            equipamentos.map(eq => {
              const depreciacao = calcularDepreciacao(eq.valorPago, eq.vidaUtil);
              return (
                <div key={eq.id} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={eq.nome}
                      onChange={e => atualizarEquipamento(eq.id, 'nome', e.target.value)}
                      className="h-8 text-sm font-medium flex-1"
                      placeholder="Nome do equipamento"
                    />
                    <div className="hidden sm:flex items-center h-8 px-2.5 rounded-md text-[13px] font-medium tabular-nums shrink-0"
                      style={{ background: 'hsl(var(--accent-gold-soft))', color: 'hsl(var(--accent-gold))' }}>
                      {formatCurrency(depreciacao)}<span className="ml-1 opacity-70">/mês</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removerEquipamento(eq.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Valor pago</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={eq.valorPago}
                        onChange={e => atualizarEquipamento(eq.id, 'valorPago', parseFloat(e.target.value) || 0)}
                        className="h-8 mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Data da compra</Label>
                      <Input
                        type="date"
                        value={eq.dataCompra}
                        onChange={e => atualizarEquipamento(eq.id, 'dataCompra', e.target.value)}
                        className="h-8 mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Vida útil (anos)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={eq.vidaUtil}
                        onChange={e => atualizarEquipamento(eq.id, 'vidaUtil', parseInt(e.target.value) || 1)}
                        className="h-8 mt-1 text-sm"
                      />
                    </div>
                  </div>

                  <p className="sm:hidden mt-2 text-[11px] text-muted-foreground">
                    Depreciação: <span className="font-medium text-foreground tabular-nums">{formatCurrency(depreciacao)}/mês</span>
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </EtapaColapsavel>
  );
}
