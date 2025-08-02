import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
interface EtapaTrabalho {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}
interface FluxoTrabalhoProps {
  etapas: EtapaTrabalho[];
  setEtapas: React.Dispatch<React.SetStateAction<EtapaTrabalho[]>>;
}
export default function FluxoTrabalho({
  etapas,
  setEtapas
}: FluxoTrabalhoProps) {
  const [novaEtapa, setNovaEtapa] = useState({
    nome: '',
    cor: '#7950F2'
  });
  const [editandoEtapa, setEditandoEtapa] = useState<string | null>(null);

  // Persistência das etapas de trabalho
  useEffect(() => {
    storage.save(STORAGE_KEYS.WORKFLOW_STATUS, etapas);
    // Dispara evento personalizado para notificar outras partes da aplicação
    window.dispatchEvent(new Event('workflowStatusUpdated'));
  }, [etapas]);
  const adicionarEtapa = () => {
    if (novaEtapa.nome.trim() === '') {
      toast.error('O nome da etapa não pode estar vazio');
      return;
    }
    const newId = String(Date.now());
    const novaOrdem = etapas.length > 0 ? Math.max(...etapas.map(e => e.ordem)) + 1 : 1;
    setEtapas([...etapas, {
      id: newId,
      nome: novaEtapa.nome,
      cor: novaEtapa.cor,
      ordem: novaOrdem
    }]);
    setNovaEtapa({
      nome: '',
      cor: '#7950F2'
    });
    toast.success('Etapa adicionada com sucesso!');
  };
  const iniciarEdicaoEtapa = (id: string) => {
    setEditandoEtapa(id);
  };
  const salvarEdicaoEtapa = (id: string, dados: Partial<EtapaTrabalho>) => {
    setEtapas(etapas.map(etapa => etapa.id === id ? {
      ...etapa,
      ...dados
    } : etapa));
    setEditandoEtapa(null);
    toast.success('Etapa atualizada com sucesso!');
  };
  const removerEtapa = (id: string) => {
    setEtapas(etapas.filter(etapa => etapa.id !== id));
    toast.success('Etapa removida com sucesso!');
  };
  const moverEtapa = (id: string, direcao: 'cima' | 'baixo') => {
    const index = etapas.findIndex(e => e.id === id);
    if (direcao === 'cima' && index === 0 || direcao === 'baixo' && index === etapas.length - 1) {
      return;
    }
    const etapasAtualizadas = [...etapas];
    const etapaAtual = etapasAtualizadas[index];
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    const etapaTroca = etapasAtualizadas[novoIndex];

    // Troca as ordens
    const ordemTemp = etapaAtual.ordem;
    etapaAtual.ordem = etapaTroca.ordem;
    etapaTroca.ordem = ordemTemp;

    // Reorganiza o array baseado na nova ordem
    etapasAtualizadas.sort((a, b) => a.ordem - b.ordem);
    setEtapas(etapasAtualizadas);
    toast.success('Ordem das etapas atualizada');
  };
  return <div className="mt-4 space-y-6">
      <div>
        <h3 className="font-medium text-sm">Nova Etapa de Fluxo</h3>
        <p className="text-muted-foreground mt-1 mb-3 text-xs">Configure as etapas personalizadas para o fluxo de trabalho dos seus projetos.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            })} className="w-20 h-7 bg-neutral-50" />
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
          <h3 className="font-medium text-sm">Etapas do Fluxo de Trabalho</h3>
          <p className="text-muted-foreground text-xs">Lista de todas as etapas do fluxo de trabalho em ordem de execução. </p>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 bg-gray-50/50 px-4 py-3 border-b border-gray-100 text-sm font-medium">
            <div className="col-span-1 hidden sm:block text-gray-700">Ordem</div>
            <div className="col-span-7 sm:col-span-5 text-gray-700">Etapa</div>
            <div className="col-span-4 hidden sm:block text-gray-700">Cor</div>
            <div className="col-span-5 sm:col-span-2 text-right text-gray-700">Ações</div>
          </div>
          
          <div className="divide-y divide-gray-50">
            {etapas.sort((a, b) => a.ordem - b.ordem).map((etapa, index) => <div key={etapa.id} className={`grid grid-cols-12 px-4 py-3 text-sm ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25/30'} hover:bg-gray-50/70 transition-colors`}>
                {editandoEtapa === etapa.id ? <>
                    <div className="col-span-1 hidden sm:block">{etapa.ordem}</div>
                    <div className="col-span-7 sm:col-span-5 pr-2">
                      <Input defaultValue={etapa.nome} onChange={e => {
                  const novoNome = e.target.value;
                  setEtapas(prev => prev.map(et => et.id === etapa.id ? {
                    ...et,
                    nome: novoNome
                  } : et));
                }} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-4 hidden sm:flex items-center">
                      <Input type="color" defaultValue={etapa.cor} onChange={e => {
                  const novaCor = e.target.value;
                  setEtapas(prev => prev.map(et => et.id === etapa.id ? {
                    ...et,
                    cor: novaCor
                  } : et));
                }} className="w-20 h-8" />
                    </div>
                    <div className="flex justify-end items-center gap-2 col-span-5 sm:col-span-2">
                      <Button variant="outline" size="sm" onClick={() => salvarEdicaoEtapa(etapa.id, etapas.find(e => e.id === etapa.id) || {})}>
                        Salvar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditandoEtapa(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </> : <>
                    <div className="col-span-1 hidden sm:block">{etapa.ordem}</div>
                    <div className="col-span-7 sm:col-span-5 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border border-gray-200" style={{
                  backgroundColor: etapa.cor
                }} title={etapa.cor} />
                      {etapa.nome}
                    </div>
                    <div className="col-span-4 hidden sm:flex items-center">
                      <div className="px-3 py-1 rounded-full text-xs border border-gray-200" style={{
                  backgroundColor: etapa.cor,
                  color: etapa.cor.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff'
                }}>
                        {etapa.cor}
                      </div>
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
            
            {etapas.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground bg-white">
                Nenhuma etapa cadastrada. Adicione sua primeira etapa acima.
              </div>}
          </div>
        </div>
      </div>
    </div>;
}