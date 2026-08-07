import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface BlockData {
  type: string;
  data: Record<string, any>;
}

export interface MaterialEditorState {
  materialId: string;
  title: string;
  versionId: string;
  versionNumber: number;
  isPublished: boolean;
  blocks: BlockData[];
}

export function useMaterialEditor(materialId: string | undefined) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<MaterialEditorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef<BlockData[]>([]);

  // Carregar o material e sua versão corrente
  useEffect(() => {
    if (!materialId) return;

    const load = async () => {
      setIsLoading(true);
      try {
        // Carregar material
        const { data: material, error: matErr } = await (supabase as any)
          .from('commercial_materials')
          .select('*')
          .eq('id', materialId)
          .single();

        if (matErr) throw matErr;

        // Carregar a versão mais recente (draft primeiro, senão a última publicada)
        const { data: versions, error: verErr } = await (supabase as any)
          .from('material_versions')
          .select('*')
          .eq('material_id', materialId)
          .order('version_number', { ascending: false })
          .limit(1);

        if (verErr) throw verErr;

        const version = versions?.[0];
        if (!version) throw new Error('Nenhuma versão encontrada');

        const blocks = Array.isArray(version.content) ? version.content : [];
        latestContent.current = blocks;

        setState({
          materialId: material.id,
          title: material.title,
          versionId: version.id,
          versionNumber: version.version_number,
          isPublished: !!version.published_at,
          blocks,
        });
        setSaveStatus('saved');
      } catch (err: any) {
        console.error('Erro ao carregar material:', err);
        toast.error('Erro ao carregar material');
      } finally {
        setIsLoading(false);
      }
    };

    load();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [materialId]);

  // Auto-save debounced
  const persistContent = useCallback(async (versionId: string, content: BlockData[]) => {
    setSaveStatus('saving');
    try {
      const { error } = await (supabase as any)
        .from('material_versions')
        .update({ content })
        .eq('id', versionId);

      if (error) throw error;

      // Atualizar updated_at no material pai
      await (supabase as any)
        .from('commercial_materials')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', state?.materialId);

      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [state?.materialId]);

  const updateBlocks = useCallback((newBlocks: BlockData[]) => {
    if (!state) return;
    latestContent.current = newBlocks;
    setState(prev => prev ? { ...prev, blocks: newBlocks } : null);

    // Debounce auto-save
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      persistContent(state.versionId, newBlocks);
    }, 2000);
  }, [state, persistContent]);

  const updateBlock = useCallback((index: number, data: Record<string, any>) => {
    if (!state) return;
    const newBlocks = [...state.blocks];
    newBlocks[index] = { ...newBlocks[index], data: { ...newBlocks[index].data, ...data } };
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

    const newBlock: BlockData = { type, data: defaultData[type] || {} };
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

  const updateTitle = useCallback(async (newTitle: string) => {
    if (!state) return;
    setState(prev => prev ? { ...prev, title: newTitle } : null);
    await (supabase as any)
      .from('commercial_materials')
      .update({ title: newTitle })
      .eq('id', state.materialId);
  }, [state]);

  const publish = useCallback(async () => {
    if (!state) return;
    setSaveStatus('saving');
    try {
      // Salvar conteúdo final
      await (supabase as any)
        .from('material_versions')
        .update({ content: latestContent.current, published_at: new Date().toISOString() })
        .eq('id', state.versionId);

      setState(prev => prev ? { ...prev, isPublished: true } : null);
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['commercial-materials'] });
      toast.success(`Versão ${state.versionNumber} publicada com sucesso!`);
    } catch {
      setSaveStatus('error');
      toast.error('Erro ao publicar versão');
    }
  }, [state, queryClient]);

  return {
    state,
    isLoading,
    saveStatus,
    updateBlock,
    addBlock,
    removeBlock,
    moveBlock,
    updateTitle,
    publish,
  };
}
