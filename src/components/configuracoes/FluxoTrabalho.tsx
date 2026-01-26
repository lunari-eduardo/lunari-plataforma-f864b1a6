import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, Save, X, Zap, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfigSectionHeader from './ConfigSectionHeader';
import type { EtapaTrabalho } from '@/types/configuration';

interface FluxoTrabalhoProps {
  etapas: EtapaTrabalho[];
  onAdd: (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => void;
  onUpdate: (id: string, dados: Partial<EtapaTrabalho>) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  onMove: (id: string, direcao: 'cima' | 'baixo') => void;
  hasGalleryAccess?: boolean;
}

export default function FluxoTrabalho({
  etapas,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
  hasGalleryAccess = false
}: FluxoTrabalhoProps) {
  const [novaEtapa, setNovaEtapa] = useState({ nome: '', cor: '#7950F2' });
  const [editandoEtapa, setEditandoEtapa] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<EtapaTrabalho>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const etapasOrdenadas = useMemo(() => {
    return [...etapas].sort((a, b) => a.ordem - b.ordem);
  }, [etapas]);

  const adicionarEtapa = () => {
    if (novaEtapa.nome.trim() === '') return;
    onAdd(novaEtapa);
    setNovaEtapa({ nome: '', cor: '#7950F2' });
  };

  const iniciarEdicaoEtapa = (id: string) => {
    const etapa = etapas.find(e => e.id === id);
    if (etapa) {
      setEditData({ nome: etapa.nome, cor: etapa.cor });
    }
    setEditandoEtapa(id);
  };

  const salvarEdicaoEtapa = async (id: string) => {
    try {
      await onUpdate(id, editData);
      setEditandoEtapa(null);
      setEditData({});
    } catch (error) {
      console.error('Erro ao atualizar etapa:', error);
    }
  };

  const removerEtapa = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const moverEtapa = async (id: string, direcao: 'cima' | 'baixo') => {
    await onMove(id, direcao);
  };

  const isSystemStatus = (etapa: EtapaTrabalho) => {
    return hasGalleryAccess && etapa.is_system_status === true;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4">
        <ConfigSectionHeader
          title="Etapas do Fluxo"
          subtitle="Configure as etapas do fluxo de trabalho dos seus projetos."
        />

        {/* Mensagem explicativa para PRO + Gallery */}
        {hasGalleryAccess && etapas.some(e => e.is_system_status) && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Zap className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              As etapas <strong className="text-foreground">"Enviado para seleção"</strong> e <strong className="text-foreground">"Seleção finalizada"</strong> são 
              automáticas e fazem parte da integração com o Gallery.
            </p>
          </div>
        )}

        {/* Formulário Nova Etapa */}
        <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="etapa-nome" className="text-sm font-medium text-foreground">
                Nome da Etapa <span className="text-destructive">*</span>
              </label>
              <Input
                id="etapa-nome"
                placeholder="Ex: Edição, Entrega..."
                value={novaEtapa.nome}
                onChange={e => setNovaEtapa({ ...novaEtapa, nome: e.target.value })}
                className="h-10"
              />
            </div>
            
            <div className="w-24 space-y-1.5">
              <label htmlFor="etapa-cor" className="text-sm font-medium text-foreground">
                Cor
              </label>
              <Input
                id="etapa-cor"
                type="color"
                value={novaEtapa.cor}
                onChange={e => setNovaEtapa({ ...novaEtapa, cor: e.target.value })}
                className="h-10 p-1 cursor-pointer"
              />
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={adicionarEtapa}
                disabled={novaEtapa.nome.trim() === ''}
                className="h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de Etapas */}
        <div className="space-y-3">
          {etapasOrdenadas.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa cadastrada. Adicione sua primeira etapa acima.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/50 text-sm font-medium">
                <div className="col-span-1 hidden sm:block text-foreground">#</div>
                <div className="col-span-7 sm:col-span-7 text-foreground">Etapa</div>
                <div className="col-span-5 sm:col-span-4 text-right text-foreground">Ações</div>
              </div>
              
              {/* Rows */}
              {etapasOrdenadas.map((etapa, index) => {
                const isSystem = isSystemStatus(etapa);
                
                return (
                  <div
                    key={etapa.id}
                    className={cn(
                      "grid grid-cols-12 px-4 py-3 text-sm transition-colors",
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/30',
                      "hover:bg-accent/50"
                    )}
                  >
                    {editandoEtapa === etapa.id && !isSystem ? (
                      <>
                        <div className="col-span-1 hidden sm:flex items-center text-muted-foreground">
                          {etapa.ordem}
                        </div>
                        <div className="col-span-7 sm:col-span-7 flex items-center gap-2 pr-2">
                          <Input
                            type="color"
                            defaultValue={etapa.cor}
                            onChange={e => setEditData(prev => ({ ...prev, cor: e.target.value }))}
                            className="w-8 h-8 p-1 cursor-pointer flex-shrink-0"
                          />
                          <Input
                            defaultValue={etapa.nome}
                            onChange={e => setEditData(prev => ({ ...prev, nome: e.target.value }))}
                            className="h-8 text-sm flex-1"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2 col-span-5 sm:col-span-4">
                          <Button size="sm" onClick={() => salvarEdicaoEtapa(etapa.id)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditandoEtapa(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-1 hidden sm:flex items-center text-muted-foreground">
                          {etapa.ordem}
                        </div>
                        <div className="col-span-7 sm:col-span-7 flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: etapa.cor }}
                          />
                          <span className="font-medium">{etapa.nome}</span>
                          
                          {/* Badge de status automático */}
                          {isSystem && (
                            <Badge variant="secondary" className="text-xs ml-1 gap-1">
                              <Zap className="h-3 w-3" />
                              Automático
                            </Badge>
                          )}
                        </div>
                        <div className="flex justify-end gap-1 col-span-5 sm:col-span-4">
                          {isSystem ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center text-muted-foreground text-xs px-2 gap-1">
                                  <Lock className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Protegido</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Etapa controlada automaticamente pela integração Gallery</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moverEtapa(etapa.id, 'cima')}
                                disabled={index === 0 || deletingId === etapa.id}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moverEtapa(etapa.id, 'baixo')}
                                disabled={index === etapasOrdenadas.length - 1 || deletingId === etapa.id}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => iniciarEdicaoEtapa(etapa.id)}
                                disabled={deletingId === etapa.id}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removerEtapa(etapa.id)}
                                disabled={deletingId === etapa.id}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
