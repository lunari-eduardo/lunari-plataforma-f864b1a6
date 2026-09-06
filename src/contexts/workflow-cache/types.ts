import { WorkflowSession } from '@/features/workflow';

// Helper para extrair ano/mês de string YYYY-MM-DD sem conversão de timezone
export const getYearMonthFromDateString = (dateString: string): { year: number; month: number } => {
  if (!dateString || typeof dateString !== 'string') {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [year, month] = dateString.split('-').map(Number);
  return { year: year || new Date().getFullYear(), month: month || (new Date().getMonth() + 1) };
};

export const getCacheKey = (year: number, month: number): string => {
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const SILENT_REFRESH_TTL_MS = 60_000;
export const BC_KEY = 'workflow-cache-sync';
export const LS_FALLBACK_KEY = '__lunari_bc_workflow_cache_sync__';

/**
 * Tranche 2 — MonthLoadStatus state machine
 * ------------------------------------------
 *  - idle    : nunca solicitado
 *  - loading : fetch cold em andamento (sem cache)
 *  - ready   : dados válidos + sem revalidação pendente
 *  - stale   : dados válidos + revalidação silenciosa em andamento
 *  - error   : último fetch falhou; UI pode oferecer retry
 */
export type MonthLoadStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

export interface MonthLoadState {
  status: MonthLoadStatus;
  error: string | null;
  loadedAt: number | null;
}

export const DEFAULT_STATE: MonthLoadState = {
  status: 'idle',
  error: null,
  loadedAt: null,
};

export interface WorkflowCacheContextType {
  getSessionsForMonthSync: (year: number, month: number) => WorkflowSession[] | null;
  getAllCachedSessionsSync: () => WorkflowSession[];
  isPreloading: boolean;
  invalidateMonth: (year: number, month: number) => Promise<void>;
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void;
  mergeUpdate: (session: WorkflowSession) => void;
  removeSession: (sessionId: string) => void;
  subscribe: (callback: (sessions: WorkflowSession[]) => void) => () => void;
  forceRefresh: () => Promise<void>;
  ensureMonthLoaded: (year: number, month: number, forceRefresh?: boolean) => Promise<void>;
  isLoadingMonth: (year: number, month: number) => boolean;
  getMonthStatus: (year: number, month: number) => MonthLoadState;
  subscribeMonthStatus: (
    year: number,
    month: number,
    callback: (state: MonthLoadState) => void,
  ) => () => void;
  retryMonth: (year: number, month: number) => Promise<void>;
}
