import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createBlock, normalizeBlocks } from '@/pages/comercial/blocks/registry';

export interface BlockData {
  type: string;
  /** Legado V1 (pré-normalização). Documentos novos usam apenas content/props. */
  data?: Record<string, any>;
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
  /** Contador de mutações locais desde a carga (usado para conciliar saves) */
  revision: number;
}

interface HistoryState {
  present: MaterialEditorState | null;
  past: MaterialEditorState[];
  future: MaterialEditorState[];
}

type EditorAction =
  | { type: 'LOAD'; state: MaterialEditorState }
  | { type: 'MUTATE'; coalesce: boolean; updater: (prev: MaterialEditorState) => MaterialEditorState }
  | { type: 'SET_VERSION'; versionId: string; versionNumber: number; isPublished: boolean }
  | { type: 'DISCARD'; to: MaterialEditorState }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const HISTORY_LIMIT = 50;
const COALESCE_WINDOW_MS = 900;

function reducer(state: HistoryState, action: EditorAction): HistoryState {
  switch (action.type) {
    case 'LOAD':
      return { present: action.state, past: [], future: [] };

    case 'MUTATE': {
      if (!state.present) return state;
      const next = { ...action.updater(state.present), revision: state.present.revision + 1 };
      const past = action.coalesce && state.past.length > 0
        ? [...state.past.slice(0, -1), state.present]
        : [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { present: next, past, future: [] };
    }

    case 'SET_VERSION': {
      if (!state.present) return state;
      return {
        ...state,
        present: {
          ...state.present,
          versionId: action.versionId,
          versionNumber: action.versionNumber,
          isPublished: action.isPublished,
        },
      };
    }

    case 'DISCARD': {
      if (!state.present) return state;
      return { present: { ...action.to, revision: state.present.revision + 1 }, past: [], future: [] };
    }

    case 'UNDO': {
      if (!state.present || state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        present: { ...previous, revision: state.present.revision + 1 },
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }

    case 'REDO': {
      if (!state.present || state.future.length === 0) return state;
      const next = state.future[0];
      return {
        present: { ...next, revision: state.present.revision + 1 },
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

/** Define um valor em caminho pontuado ("details.0.label") de forma imutável. */
function setPath(obj: Record<string, any>, path: string, value: any): Record<string, any> {
  const keys = path.split('.');
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor: any = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cursor[k] = Array.isArray(cursor[k]) ? [...cursor[k]] : { ...(cursor[k] ?? {}) };
    cursor = cursor[k];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone as Record<string, any>;
}

export function useMaterialEditor(materialId: string | undefined) {
  const queryClient = useQueryClient();
  const [history, dispatch] = useReducer(reducer, { present: null, past: [], future: [] });
  const state = history.present;
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [hasChanges, setHasChanges] = useState(false);

  // Snapshot do que foi persistido por último + revisão correspondente
  const savedRef = useRef<{ state: MaterialEditorState; revision: number } | null>(null);
  const stateRef = useRef<MaterialEditorState | null>(null);
  const savingRef = useRef(false);
  // Coalescência do histórico: edições rápidas no mesmo campo viram 1 entrada de undo
  const lastCoalesceRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Reavalia "sujo" sempre que o documento muda (comparação com o último persistido)
  useEffect(() => {
    const saved = savedRef.current?.state;
    if (!state || !saved) {
      setHasChanges(false);
      return;
    }
    const dirty =
      JSON.stringify(state.blocks) !== JSON.stringify(saved.blocks) ||
      state.title !== saved.title ||
      state.pdfUrl !== saved.pdfUrl ||
      JSON.stringify(state.globalSettings) !== JSON.stringify(saved.globalSettings);
    setHasChanges(dirty);
    if (!dirty) setSaveStatus('saved');
    else if (saveStatus !== 'saving') setSaveStatus('idle');
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bloqueia fechamento/navegação com alterações não salvas
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

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
        // Normaliza documentos V1 legados para o modelo V2 unificado (content/props)
        blocks = normalizeBlocks(version.content);
        const settingsBlockIndex = blocks.findIndex(b => b.type === 'global_settings');
        if (settingsBlockIndex !== -1) {
          globalSettings = blocks[settingsBlockIndex].data || {};
          blocks.splice(settingsBlockIndex, 1);
        }
      }

      const loadedState: MaterialEditorState = {
        materialId: material.id,
        title: material.title,
        versionId: version.id,
        versionNumber: version.version_number,
        isPublished: !!version.published_at,
        format,
        blocks,
        pdfUrl,
        globalSettings,
        revision: 0,
      };

      dispatch({ type: 'LOAD', state: loadedState });
      savedRef.current = { state: JSON.parse(JSON.stringify(loadedState)), revision: 0 };
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

  // ---------- Mutações (todas passam pelo reducer com histórico) ----------

  const mutate = useCallback((coalesceKey: string | undefined, updater: (prev: MaterialEditorState) => MaterialEditorState) => {
    const now = Date.now();
    const coalesce =
      coalesceKey !== undefined &&
      lastCoalesceRef.current?.key === coalesceKey &&
      now - lastCoalesceRef.current.at < COALESCE_WINDOW_MS;
    if (coalesceKey !== undefined) {
      lastCoalesceRef.current = { key: coalesceKey, at: now };
    } else {
      lastCoalesceRef.current = null;
    }
    dispatch({ type: 'MUTATE', coalesce, updater });
  }, []);

  const updateBlocks = useCallback((newBlocks: BlockData[]) => {
    mutate(undefined, (prev) => ({ ...prev, blocks: newBlocks }));
  }, [mutate]);

  const updatePdfUrl = useCallback((url: string) => {
    mutate('pdf-url', (prev) => ({ ...prev, pdfUrl: url }));
  }, [mutate]);

  const updateGlobalSettings = useCallback((updates: Record<string, any>) => {
    mutate('global-settings', (prev) => ({ ...prev, globalSettings: { ...prev.globalSettings, ...updates } }));
  }, [mutate]);

  const updateDesignTokens = useCallback((tokens: any) => {
    updateGlobalSettings({ design_tokens: tokens });
  }, [updateGlobalSettings]);

  const updateBlock = useCallback((index: number, dataOrUpdates: Record<string, any>, coalesceKey?: string) => {
    const key = coalesceKey ?? `block-${index}`;
    mutate(key, (prev) => {
      const newBlocks = [...prev.blocks];
      const target = newBlocks[index];
      if (!target) return prev;

      // Update de root (V2: content/props) ou merge em data (retrocompat V1)
      if ('props' in dataOrUpdates || 'content' in dataOrUpdates || 'data' in dataOrUpdates) {
        newBlocks[index] = { ...target, ...dataOrUpdates };
      } else {
        newBlocks[index] = { ...target, data: { ...(target.data ?? {}), ...dataOrUpdates } };
      }
      return { ...prev, blocks: newBlocks };
    });
  }, [mutate]);

  /** Edição inline / granular: atualiza content por caminho pontuado
   * ("details.0.label"). Caminhos "props.*" gravam em block.props
   * (slots de imagem, alinhamento, fundo etc.). */
  const updateBlockField = useCallback((index: number, path: string, value: any) => {
    mutate(`block-${index}:${path}`, (prev) => {
      const newBlocks = [...prev.blocks];
      const target = newBlocks[index];
      if (!target) return prev;
      if (path.startsWith('props.')) {
        const props = setPath(target.props ?? {}, path.slice('props.'.length), value);
        newBlocks[index] = { ...target, props };
      } else {
        const content = setPath(target.content ?? {}, path, value);
        newBlocks[index] = { ...target, content };
      }
      return { ...prev, blocks: newBlocks };
    });
  }, [mutate]);

  const addBlock = useCallback((type: string, afterIndex?: number) => {
    mutate(undefined, (prev) => {
      const newBlock = createBlock(type);
      const newBlocks = [...prev.blocks];
      const insertAt = afterIndex !== undefined ? afterIndex + 1 : newBlocks.length;
      newBlocks.splice(insertAt, 0, newBlock);
      return { ...prev, blocks: newBlocks };
    });
  }, [mutate]);

  const removeBlock = useCallback((index: number) => {
    mutate(undefined, (prev) => ({ ...prev, blocks: prev.blocks.filter((_, i) => i !== index) }));
  }, [mutate]);

  const moveBlock = useCallback((index: number, direction: 'up' | 'down') => {
    mutate(undefined, (prev) => {
      const newBlocks = [...prev.blocks];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= newBlocks.length) return prev;
      [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
      return { ...prev, blocks: newBlocks };
    });
  }, [mutate]);

  const reorderBlocks = useCallback((startIndex: number, endIndex: number) => {
    mutate(undefined, (prev) => {
      const newBlocks = Array.from(prev.blocks);
      const [removed] = newBlocks.splice(startIndex, 1);
      newBlocks.splice(endIndex, 0, removed);
      return { ...prev, blocks: newBlocks };
    });
  }, [mutate]);

  const updateTitle = useCallback((newTitle: string) => {
    mutate('title', (prev) => ({ ...prev, title: newTitle }));
  }, [mutate]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const discardChanges = useCallback(() => {
    if (!savedRef.current) return;
    dispatch({ type: 'DISCARD', to: savedRef.current.state });
    setHasChanges(false);
    setSaveStatus('saved');
    lastCoalesceRef.current = null;
  }, []);

  // ---------- Persistência ----------
  //
  // Semântica de versionamento:
  //  - saveDraft em versão-rascunho → UPDATE in-place da própria versão.
  //  - saveDraft com a última versão já PUBLICADA → cria nova versão-rascunho
  //    (a publicada permanece intocada; shares pinados nela não mudam).
  //  - publish → sempre cria uma NOVA versão publicada (v2, v3, ...);
  //    o trigger sync_active_version_on_publish aponta active_version_id.
  //    Compartilhamentos antigos ficam congelados na versão em que foram enviados.
  //
  const persist = useCallback(async (publish: boolean) => {
    if (savingRef.current) return;
    const current = stateRef.current;
    if (!current) return;
    if (!publish && !hasChanges) return;
    savingRef.current = true;
    setSaveStatus('saving');
    const savedRevision = current.revision;
    try {
      const contentToSave = current.format === 'pdf'
        ? { type: 'pdf', url: current.pdfUrl, settings: current.globalSettings }
        : [...current.blocks, { type: 'global_settings', data: current.globalSettings }];

      let resultingVersion = { id: current.versionId, versionNumber: current.versionNumber, isPublished: current.isPublished };

      if (publish || current.isPublished) {
        // Nova versão (publicação, ou rascunho sobre versão publicada)
        let attempt = 0;
        while (true) {
          attempt++;
          const { data: newVersion, error: insertError } = await (supabase as any)
            .from('material_versions')
            .insert({
              material_id: current.materialId,
              version_number: current.versionNumber + attempt,
              content: contentToSave,
              ...(publish ? { published_at: new Date().toISOString() } : {}),
            })
            .select()
            .single();

          if (insertError) {
            // Conflito de version_number (edição concorrente): tenta o próximo número
            if (insertError.code === '23505' && attempt < 5) continue;
            throw insertError;
          }
          resultingVersion = { id: newVersion.id, versionNumber: newVersion.version_number, isPublished: publish };
          break;
        }
        dispatch({
          type: 'SET_VERSION',
          versionId: resultingVersion.id,
          versionNumber: resultingVersion.versionNumber,
          isPublished: resultingVersion.isPublished,
        });
      } else {
        // Rascunho da própria versão: update in-place
        await (supabase as any)
          .from('material_versions')
          .update({ content: contentToSave })
          .eq('id', current.versionId);
      }

      if (savedRef.current?.state.title !== current.title) {
        await (supabase as any)
          .from('commercial_materials')
          .update({ title: current.title })
          .eq('id', current.materialId);
      }

      if (publish) {
        queryClient.invalidateQueries({ queryKey: ['commercial-materials'] });
      }

      // Registra o snapshot persistido; se houve mutações durante o await,
      // o efeito de "sujo" detecta a diferença e mantém hasChanges=true.
      const persistedSnapshot = JSON.parse(JSON.stringify({
        ...current,
        versionId: resultingVersion.id,
        versionNumber: resultingVersion.versionNumber,
        isPublished: resultingVersion.isPublished,
      }));
      savedRef.current = { state: persistedSnapshot, revision: savedRevision };
      const latest = stateRef.current;
      if (latest && latest.revision === savedRevision) {
        setHasChanges(false);
        setSaveStatus('saved');
      }

      if (publish) {
        toast.success(`Versão ${resultingVersion.versionNumber} publicada! Links antigos continuam vendo a versão em que foram enviados.`);
      } else {
        toast.success('Rascunho salvo com sucesso!');
      }
    } catch {
      setSaveStatus('error');
      toast.error(publish ? 'Erro ao publicar versão' : 'Erro ao salvar rascunho');
    } finally {
      savingRef.current = false;
    }
  }, [hasChanges, queryClient]);

  const saveDraft = useCallback(() => persist(false), [persist]);
  const publish = useCallback(() => persist(true), [persist]);

  return {
    state,
    isLoading,
    saveStatus,
    hasChanges,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo,
    redo,
    updateBlock,
    updateBlockField,
    updatePdfUrl,
    updateGlobalSettings,
    updateDesignTokens,
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
