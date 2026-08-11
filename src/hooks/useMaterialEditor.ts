import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface BlockData {
  type: string;
  data: Record<string, any>;
  id?: string;
  content?: Record<string, any>;
  props?: Record<string, any>;
}

export interface MaterialEditorState {
  materialId: string;
  title: string;
  versionId: string;
  versionNumber: number;
  isPublished: boolean;
  format: 'blocks' | 'pdf';
  blocks: BlockData[];
  pdfUrl?: string;
  globalSettings: Record<string, any>;
}

export function useMaterialEditor(materialId: string | undefined) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<MaterialEditorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const originalState = useRef<MaterialEditorState | null>(null);

  const fetchMaterial = useCallback(async () => {
    if (!materialId) return;
    setIsLoading(true);
    try {
      const { data: material, error: matErr } = await (supabase as any)
        .from('commercial_materials')
        .select('*')
        .eq('id', materialId)
        .single();

      if (matErr) throw matErr;

      const { data: versions, error: verErr } = await (supabase as any)
        .from('material_versions')
        .select('*')
        .eq('material_id', materialId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (verErr) throw verErr;

      const version = versions?.[0];
      if (!version) throw new Error('Nenhuma versão encontrada');

      let format: 'blocks' | 'pdf' = 'blocks';
      let blocks: BlockData[] = [];
      let pdfUrl: string | undefined = undefined;
      let globalSettings: Record<string, any> = {};

      if (version.content && typeof version.content === 'object' && !Array.isArray(version.content) && version.content.type === 'pdf') {
        format = 'pdf';
        pdfUrl = version.content.url;
        globalSettings = version.content.settings || {};
      } else {
        blocks = Array.isArray(version.content) ? version.content : [];
        const settingsBlockIndex = blocks.findIndex(b => b.type === 'global_settings');
        if (settingsBlockIndex !== -1) {
          globalSettings = blocks[settingsBlockIndex].data || {};
          blocks.splice(settingsBlockIndex, 1);
        }
      }

      const loadedState = {
        materialId: material.id,
        title: material.title,
        versionId: version.id,
        versionNumber: version.version_number,
        isPublished: !!version.published_at,
        format,
        blocks,
        pdfUrl
      };
      
      originalState.current = JSON.parse(JSON.stringify(loadedState));
      setState(loadedState);
      setHasChanges(false);
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar proposta');
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    fetchMaterial();
  }, [fetchMaterial]);

  const updateState = useCallback((updater: (prev: MaterialEditorState) => MaterialEditorState) => {
    setState(prev => {
      if (!prev) return prev;
      const newState = updater(prev);
      
      const isDifferent = JSON.stringify(newState.blocks) !== JSON.stringify(originalState.current?.blocks) ||
                          newState.title !== originalState.current?.title ||
                          newState.pdfUrl !== originalState.current?.pdfUrl ||
                          JSON.stringify(newState.globalSettings) !== JSON.stringify(originalState.current?.globalSettings);
      setHasChanges(isDifferent);
      if (isDifferent) setSaveStatus('idle');
      
      return newState;
    });
  }, []);

  const updateBlocks = useCallback((newBlocks: BlockData[]) => {
    updateState(prev => ({ ...prev, blocks: newBlocks }));
  }, [updateState]);

  const updatePdfUrl = useCallback((url: string) => {
    updateState(prev => ({ ...prev, pdfUrl: url }));
  }, [updateState]);

  const updateGlobalSettings = useCallback((updates: Record<string, any>) => {
    updateState(prev => ({ ...prev, globalSettings: { ...prev.globalSettings, ...updates } }));
  }, [updateState]);

  const updateBlock = useCallback((index: number, dataOrUpdates: Record<string, any>) => {
    if (!state) return;
    const newBlocks = [...state.blocks];
    
    // Verifica se é uma atualização de root (V2: content/props/data) ou V1 (tudo em data)
    // Se conter 'props', 'content' ou 'data' explicitamente, assumimos que é um update root.
    // Caso contrário (retrocompatibilidade V1), injetamos no data.
    if ('props' in dataOrUpdates || 'content' in dataOrUpdates || 'data' in dataOrUpdates) {
      newBlocks[index] = { ...newBlocks[index], ...dataOrUpdates };
    } else {
      newBlocks[index] = { ...newBlocks[index], data: { ...newBlocks[index].data, ...dataOrUpdates } };
    }
    
    updateBlocks(newBlocks);
  }, [state, updateBlocks]);

  const addBlock = useCallback((type: string, afterIndex?: number) => {
    if (!state) return;
    const defaultData: Record<string, any> = {
      cover: { title: '', subtitle: '', image_url: '' },
      about: { title: 'Nova Seção', text: '', photo_url: '' },
      package: { name: 'Novo Pacote', price_cents: 0, description: '', items: [], highlight: false },
      portfolio: { title: 'Portfólio', images: [] },
      faq: { items: [{ question: '', answer: '' }] },
      cta: { whatsapp: '', instagram: '', email: '', text: '' },
      text: { title: '', body: '' },
    };

    // Gera ID simples para o drag-and-drop
    const newBlock: BlockData = { 
      type, 
      data: defaultData[type] || {},
      id: `${type}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    const newBlocks = [...state.blocks];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : newBlocks.length;
    newBlocks.splice(insertAt, 0, newBlock);
    updateBlocks(newBlocks);
  }, [state, updateBlocks]);

  const removeBlock = useCallback((index: number) => {
    if (!state) return;
    const newBlocks = state.blocks.filter((_, i) => i !== index);
    updateBlocks(newBlocks);
  }, [state, updateBlocks]);

  const moveBlock = useCallback((index: number, direction: 'up' | 'down') => {
    if (!state) return;
    const newBlocks = [...state.blocks];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newBlocks.length) return;
    [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
    updateBlocks(newBlocks);
  }, [state, updateBlocks]);

  // Usado para drag and drop index flexível
  const reorderBlocks = useCallback((startIndex: number, endIndex: number) => {
    if (!state) return;
    const newBlocks = Array.from(state.blocks);
    const [removed] = newBlocks.splice(startIndex, 1);
    newBlocks.splice(endIndex, 0, removed);
    updateBlocks(newBlocks);
  }, [state, updateBlocks]);

  const updateTitle = useCallback((newTitle: string) => {
    updateState(prev => ({ ...prev, title: newTitle }));
  }, [updateState]);

  // Salva no banco explicitamente
  const saveDraft = useCallback(async () => {
    if (!state || !hasChanges) return;
    setSaveStatus('saving');
    try {
      // 1. Salvar conteúdo na versão
      const contentToSave = state.format === 'pdf' 
        ? { type: 'pdf', url: state.pdfUrl, settings: state.globalSettings }
        : [...state.blocks, { type: 'global_settings', data: state.globalSettings }];

      await (supabase as any)
        .from('material_versions')
        .update({ content: contentToSave })
        .eq('id', state.versionId);
        
      if (originalState.current?.title !== state.title) {
        await (supabase as any)
          .from('commercial_materials')
          .update({ title: state.title })
          .eq('id', state.materialId);
      }

      setHasChanges(false);
      setSaveStatus('saved');
      originalState.current = JSON.parse(JSON.stringify(state));
      
      toast.success('Rascunho salvo com sucesso!');
    } catch {
      setSaveStatus('error');
      toast.error('Erro ao salvar rascunho');
    }
  }, [state]);

  const publish = useCallback(async () => {
    if (!state) return;
    setSaveStatus('saving');
    try {
      const contentToSave = state.format === 'pdf' 
        ? { type: 'pdf', url: state.pdfUrl, settings: state.globalSettings }
        : [...state.blocks, { type: 'global_settings', data: state.globalSettings }];

      await (supabase as any)
        .from('material_versions')
        .update({ content: contentToSave, published_at: new Date().toISOString() })
        .eq('id', state.versionId);

      if (originalState.current?.title !== state.title) {
        await (supabase as any)
          .from('commercial_materials')
          .update({ title: state.title })
          .eq('id', state.materialId);
      }

      setState(prev => prev ? { ...prev, isPublished: true } : null);
      setHasChanges(false);
      setSaveStatus('saved');
      originalState.current = JSON.parse(JSON.stringify(state));
      
      queryClient.invalidateQueries({ queryKey: ['commercial-materials'] });
      toast.success(`Versão ${state.versionNumber} publicada com sucesso!`);
    } catch {
      setSaveStatus('error');
      toast.error('Erro ao publicar versão');
    }
  }, [state, queryClient]);

  const discardChanges = useCallback(() => {
    if (originalState.current) {
      setState(JSON.parse(JSON.stringify(originalState.current)));
      setHasChanges(false);
      setSaveStatus('saved');
    }
  }, []);

  return {
    state,
    isLoading,
    saveStatus,
    hasChanges,
    updateBlock,
    updatePdfUrl,
    updateGlobalSettings,
    addBlock,
    removeBlock,
    moveBlock,
    reorderBlocks,
    updateTitle,
    saveDraft,
    discardChanges,
    publish,
  };
}
