import { WorkflowSession } from '@/features/workflow';
import { normalizeWorkflowSessionPartial } from '@/utils/workflowNormalization';
import { getYearMonthFromDateString, getCacheKey } from './types';

export const executeMergeUpdate = (
  memoryCache: Map<string, WorkflowSession[]>,
  session: WorkflowSession,
  removeSessionFn: ((sessionId: string) => void) | null,
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void
) => {
  if (!session) return;
  // Normalização parcial: NÃO força defaults em campos ausentes do payload
  // (evita que fetches parciais zerem valor_base_pacote, regras_congeladas, etc.)
  const normalized = normalizeWorkflowSessionPartial(session) as WorkflowSession;

  // Soft-delete (status='historico') deve REMOVER do cache do funil — não dá merge.
  if ((normalized as any).status === 'historico' && (normalized as any).id) {
    console.log('🗑️ [WorkflowCache] mergeUpdate detectou status=historico → removendo', (normalized as any).id);
    removeSessionFn?.((normalized as any).id);
    return;
  }
  console.log('🔀 [WorkflowCache] mergeUpdate called for session:', (normalized as any).id, 'updated_at:', (normalized as any).updated_at);

  // 1) Tentar localizar a sessão em algum bucket cacheado (por id UUID ou session_id text)
  let foundKey: string | null = null;
  let foundIdx = -1;
  for (const [k, list] of memoryCache.entries()) {
    const i = list.findIndex(
      (s) => s.id === (normalized as any).id || (s as any).session_id === (normalized as any).session_id
    );
    if (i >= 0) {
      foundKey = k;
      foundIdx = i;
      break;
    }
  }

  let year: number;
  let month: number;
  let currentSessions: WorkflowSession[];
  let index: number;

  if (foundKey) {
    // Atualizar no bucket onde a sessão já vive (não depende de data_sessao do payload)
    const [yStr, mStr] = foundKey.split('-');
    year = parseInt(yStr);
    month = parseInt(mStr);
    currentSessions = memoryCache.get(foundKey) || [];
    index = foundIdx;
  } else if ((normalized as any).data_sessao) {
    // Sessão nova com data conhecida → inserir SOMENTE se o mês já estiver
    // carregado. Criar um bucket para um mês nunca carregado faria a UI
    // pensar que aquele mês só tem essa sessão (cache envenenado).
    const ym = getYearMonthFromDateString((normalized as any).data_sessao);
    year = ym.year;
    month = ym.month;
    const bucketKey = getCacheKey(year, month);
    if (!memoryCache.has(bucketKey)) {
      console.log('ℹ️ [WorkflowCache] mergeUpdate ignorado: mês ainda não carregado', bucketKey);
      return;
    }
    currentSessions = memoryCache.get(bucketKey) || [];
    index = -1;
  } else {
    // Payload parcial sem bucket conhecido e sem data → ignorar para não criar "registro lixo"
    console.warn('⚠️ [WorkflowCache] mergeUpdate ignorado: sessão sem bucket e sem data_sessao', (normalized as any).id);
    return;
  }

  let updatedSessions: WorkflowSession[];
  if (index >= 0) {
    updatedSessions = [...currentSessions];
    // Shallow merge preservando campos populados (normalized é Partial)
    updatedSessions[index] = { ...updatedSessions[index], ...normalized };
  } else {
    updatedSessions = [...currentSessions, normalized];
  }

  setMonthData(year, month, updatedSessions);
};

export const executeRemoveSession = (
  memoryCache: Map<string, WorkflowSession[]>,
  sessionId: string,
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void
) => {
  // Remover de todos os meses em cache
  for (const [key, sessions] of memoryCache.entries()) {
    const filtered = sessions.filter(s => s.id !== sessionId);
    if (filtered.length !== sessions.length) {
      const [yearMonth] = key.split('-');
      const year = parseInt(yearMonth);
      const month = parseInt(key.split('-')[1]);
      setMonthData(year, month, filtered);
    }
  }
};

export const executeOptimisticPayment = (
  memoryCache: Map<string, WorkflowSession[]>,
  sessionId: string,
  delta: number,
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void
) => {
  for (const [key, sessions] of memoryCache.entries()) {
    const idx = sessions.findIndex(s => s.id === sessionId || (s as any).session_id === sessionId);
    if (idx >= 0) {
      const target = sessions[idx];
      const newValorPago = Math.max(0, (Number(target.valor_pago) || 0) + delta);
      const updated = [...sessions];
      updated[idx] = { ...target, valor_pago: newValorPago };
      const [yearStr, monthStr] = key.split('-');
      setMonthData(parseInt(yearStr), parseInt(monthStr), updated);
      console.log('⚡ [WorkflowCache] Otimista aplicado:', sessionId, 'delta:', delta, '→ valor_pago:', newValorPago);
      break;
    }
  }
};
