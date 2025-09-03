import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { EtapaTrabalho } from '@/types/configuration';
interface FluxoTrabalhoProps {
  etapas: EtapaTrabalho[];
  onAdd: (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => void;
  onUpdate: (id: string, dados: Partial<EtapaTrabalho>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direcao: 'cima' | 'baixo') => void;
}
export default function FluxoTrabalho({
  etapas,
  onAdd,
  onUpdate,
  onDelete,
  onMove
}: FluxoTrabalhoProps) {
  const [novaEtapa, setNovaEtapa] = useState({
    nome: '',
    cor: '#7950F2'
  });
  const [editandoEtapa, setEditandoEtapa] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<EtapaTrabalho>>({});
  const adicionarEtapa = () => {
    if (novaEtapa.nome.trim() === '') {
      return; // Error handled by service
    }
    onAdd(novaEtapa);
    setNovaEtapa({
      nome: '',
      cor: '#7950F2'
    });
  };
  const iniciarEdicaoEtapa = (id: string) => {
    const etapa = etapas.find(e => e.id === id);
    if (etapa) {
      setEditData({
        nome: etapa.nome,
        cor: etapa.cor
      });
    }
    setEditandoEtapa(id);
  };
  const salvarEdicaoEtapa = (id: string) => {
    onUpdate(id, editData);
    setEditandoEtapa(null);
    setEditData({});
  };
  const removerEtapa = (id: string) => {
    onDelete(id);
  };
  const moverEtapa = (id: string, direcao: 'cima' | 'baixo') => {
    onMove(id, direcao);
  };
  return <div className="mt-4 space-y-6">
      <div>
        <h3 className="font-medium text-sm">Nova Etapa de Fluxo</h3>
        <p className="text-muted-foreground mt-1 mb-3 text-xs">Configure as etapas personalizadas para o fluxo de trabalho dos seus projetos.</p>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="etapa-nome" className="block text-sm font-medium mb-1">
              Nome<span className="text-red-500">*</span>
            </label>
            <Input id="etapa-nome" placeholder="Nome da etapa" value={novaEtapa.nome} onChange={e => setNovaEtapa({
            ...novaEtapa,
            nome: e.target.value
          })} className="bg-lunar-surface" />
          </div>
          
          <div>
            <label htmlFor="etapa-cor" className="block text-sm font-medium mb-1">
              Cor<span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              
              <Input id="etapa-cor" type="color" value={novaEtapa.cor} onChange={e => setNovaEtapa({
              ...novaEtapa,
              cor: e.target.value
            })} className="w-20 h-7 bg-muted" />
            </div>
          </div>
        </div>
        
        <div className="mt-3">
          <Button onClick={adicionarEtapa} className="flex items-center gap-1 bg-lunar-accent">
            <Plus className="h-4 w-4" />
            <span>Adicionar Etapa</span>
          </Button>
        </div>
      </div>
      
      <div>
        <div className="space-y-2 mb-4">
          
          <p className="text-muted-foreground text-xs">Lista de todas as etapas do fluxo de trabalho em ordem de execução. </p>
        </div>
        
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 border-b border-border text-sm font-medium">
            <div className="col-span-1 hidden sm:block text-card-foreground">Ordem</div>
            <div className="col-span-7 sm:col-span-5 text-card-foreground">Etapa</div>
            <div className="col-span-4 hidden sm:block text-card-foreground">Cor</div>
            <div className="col-span-5 sm:col-span-2 text-right text-card-foreground">Ações</div>
          </div>
          
          <div className="divide-y divide-border">
            {etapas.sort((a, b) => a.ordem - b.ordem).map((etapa, index) => <div key={etapa.id} className={`grid grid-cols-12 px-4 py-2 text-sm ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'} hover:bg-accent/50 transition-colors`}>
                {editandoEtapa === etapa.id ? <>
                    <div className="col-span-1 hidden sm:block">{etapa.ordem}</div>
                    <div className="col-span-7 sm:col-span-5 pr-2">
                        <Input defaultValue={etapa.nome} onChange={e => {
                  setEditData(prev => ({
                    ...prev,
                    nome: e.target.value
                  }));
                }} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-4 hidden sm:flex items-center">
                      <Input type="color" defaultValue={etapa.cor} onChange={e => {
                  setEditData(prev => ({
                    ...prev,
                    cor: e.target.value
                  }));
                }} className="w-20 h-8" />
                    </div>
                    <div className="flex justify-end items-center gap-2 col-span-5 sm:col-span-2">
                      <Button variant="outline" size="sm" onClick={() => salvarEdicaoEtapa(etapa.id)}>
                        Salvar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditandoEtapa(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </> : <>
                    <div className="col-span-1 hidden sm:block">{etapa.ordem}</div>
                    <div className="col-span-7 sm:col-span-5 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border border-border" style={{
                  backgroundColor: etapa.cor
                }} title={etapa.cor} />
                      {etapa.nome}
                    </div>
                    <div className="col-span-4 hidden sm:flex items-center">
                      
                    </div>
                    <div className="flex justify-end gap-1 col-span-5 sm:col-span-2">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moverEtapa(etapa.id, 'cima')} disabled={etapa.ordem === 1}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moverEtapa(etapa.id, 'baixo')} disabled={etapa.ordem === etapas.length}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => iniciarEdicaoEtapa(etapa.id)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:border-red-200" onClick={() => removerEtapa(etapa.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>}
              </div>)}
            
            {etapas.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground bg-card">
                Nenhuma etapa cadastrada. Adicione sua primeira etapa acima.
              </div>}
          </div>
        </div>
      </div>
    </div>;
}