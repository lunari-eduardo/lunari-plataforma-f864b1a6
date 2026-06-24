/**
 * WorkflowCacheManager - Sistema de Cache Inteligente para Workflow
 * 
 * Responsabilidades:
 * 1. Cache em memória de sessões (mês atual + anterior)
 * 2. Pré-carregamento automático ao fazer login
 * 3. Invalidação inteligente (só o que mudou)
 * 4. Sincronização cross-tab via BroadcastChannel
 * 5. Detecção de cache stale
 */

import { supabase } from '@/integrations/supabase/client';
import { WorkflowSession } from '@/hooks/useWorkflowRealtime';

interface CacheEntry {
  sessions: WorkflowSession[];
  lastUpdate: number;
  isPreloaded: boolean;
}

type CacheUpdateListener = (sessions: WorkflowSession[]) => void;

class WorkflowCacheManager {
  private static instance: WorkflowCacheManager;
  private cache: Map<string, CacheEntry> = new Map();
  private channel: BroadcastChannel | null = null;
  private listeners: Set<CacheUpdateListener> = new Set();
  private userId: string | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutos (aumentado para persistência)
  private readonly CHANNEL_NAME = 'workflow-cache-sync';
  private readonly STORAGE_KEY = 'workflow-cache';
  private readonly STORAGE_MAX_AGE = 30 * 60 * 1000; // 30 minutos
  
  // FASE 1: Controle de preload
  private isPreloading: boolean = false;
  private preloadPromise: Promise<void> | null = null;

  private constructor() {
    this.initBroadcastChannel();
    this.initStorageListener();
  }

  static getInstance(): WorkflowCacheManager {
    if (!WorkflowCacheManager.instance) {
      WorkflowCacheManager.instance = new WorkflowCacheManager();
    }
    return WorkflowCacheManager.instance;
  }

  /**
   * Inicializa BroadcastChannel para sincronização cross-tab
   */
  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.CHANNEL_NAME);
      this.channel.onmessage = this.handleBroadcastMessage.bind(this);
      console.log('📡 WorkflowCacheManager: BroadcastChannel initialized');
    }
  }

  /**
   * Inicializa listener para StorageEvent (sincronização entre abas via localStorage)
   */
  private initStorageListener() {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY && event.newValue) {
        console.log('🔄 WorkflowCacheManager: LocalStorage updated from another tab');
        this.loadCacheFromLocalStorage();
        
        // Notificar listeners com todos os dados em cache
        const allSessions: WorkflowSession[] = [];
        this.cache.forEach(entry => allSessions.push(...entry.sessions));
        this.notifyListeners(allSessions);
      }
    });
  }

  /**
   * Define o userId atual e tenta carregar cache do LocalStorage
   */
  setUserId(userId: string) {
    if (this.userId !== userId) {
      this.userId = userId;
      this.cache.clear();
      console.log('👤 WorkflowCacheManager: User changed, cache cleared');
      
      // Tentar carregar cache do LocalStorage para o novo usuário
      const loaded = this.loadCacheFromLocalStorage();
      if (loaded) {
        console.log('✅ WorkflowCacheManager: Cache loaded from LocalStorage for new user');
        
        // FASE 2: Notificar listeners que cache foi carregado
        const allSessions: WorkflowSession[] = [];
        this.cache.forEach(entry => allSessions.push(...entry.sessions));
        this.notifyListeners(allSessions);
        
        // Broadcast para outras tabs
        this.broadcastUpdate('cache-loaded-from-storage', { 
          monthsLoaded: this.cache.size 
        });
      }
    }
  }

  /**
   * Gera chave de cache para um mês
   */
  private getCacheKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  /**
   * Verifica se o cache está stale (desatualizado)
   */
  isCacheStale(year: number, month: number): boolean {
    const key = this.getCacheKey(year, month);
    const entry = this.cache.get(key);
    
    if (!entry) return true;
    
    const age = Date.now() - entry.lastUpdate;
    return age > this.CACHE_TTL;
  }

  /**
   * FASE 1: Retorna se há um preload em andamento
   */
  isPreloadInProgress(): boolean {
    return this.isPreloading;
  }
  
  /**
   * FASE 1: Aguarda preload completar (se estiver em andamento)
   */
  async waitForPreload(): Promise<void> {
    if (this.preloadPromise) {
      await this.preloadPromise;
    }
  }

  /**
   * Pré-carrega range de 4 meses: atual + 2 anteriores + 1 posterior
   * ✅ CORREÇÃO: Não sobrescreve cache existente do LocalStorage
   */
  async preloadWorkflowRange(): Promise<void> {
    // Se já está preloading, retornar a Promise existente
    if (this.preloadPromise) {
      console.log('⏳ WorkflowCacheManager: Preload already in progress, waiting...');
      return this.preloadPromise;
    }
    
    this.isPreloading = true;
    this.preloadPromise = (async () => {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Calcular range de 4 meses
        const months = [];
        
        // Adicionar 2 meses anteriores
        for (let i = 2; i >= 1; i--) {
          const date = new Date(currentYear, currentMonth - 1 - i, 1);
          months.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
        }
        
        // Adicionar mês atual
        months.push({ year: currentYear, month: currentMonth });
        
        // Adicionar 1 mês posterior
        const nextMonth = new Date(currentYear, currentMonth, 1);
        months.push({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 });

        console.log('🔄 WorkflowCacheManager: Preloading range:', months);

        // ✅ CORREÇÃO: Só carregar meses que NÃO estão em cache
        await Promise.all(
          months.map(({ year, month }) => {
            const cached = this.getSessionsForMonthSync(year, month);
            if (cached !== null) {
              console.log(`⚡ Skipping preload for ${year}-${month} (already cached)`);
              return Promise.resolve();
            }
            return this.fetchFromSupabaseAndCache(year, month);
          })
        );
        
        console.log('✅ WorkflowCacheManager: Preload completed (4 months cached)');
        
        // Salvar no LocalStorage após pré-carregamento
        this.saveCacheToLocalStorage();
      } catch (error) {
        console.error('❌ WorkflowCacheManager: Preload failed:', error);
        throw error;
      } finally {
        this.isPreloading = false;
        this.preloadPromise = null;
      }
    })();
    
    return this.preloadPromise;
  }

  /**
   * FASE 3: SÍNCRONO - Retorna cache se disponível, senão retorna null
   */
  getSessionsForMonthSync(year: number, month: number): WorkflowSession[] | null {
    const key = this.getCacheKey(year, month);
    const cached = this.cache.get(key);
    
    if (cached && !this.isCacheStale(year, month)) {
      console.log(`⚡ WorkflowCacheManager: Cache hit (sync) for ${key} (${cached.sessions.length} sessions)`);
      return cached.sessions;
    }
    
    console.log(`⏳ WorkflowCacheManager: No valid cache (sync) for ${key}`);
    return null; // Indica que não tem cache disponível
  }

  /**
   * FASE 3: ASSÍNCRONO - Retorna cache OU busca do Supabase
   */
  async getSessionsForMonth(
    year: number, 
    month: number,
    forceRefresh: boolean = false
  ): Promise<WorkflowSession[]> {
    // Se tem cache válido e não força refresh, retorna
    if (!forceRefresh) {
      const cached = this.getSessionsForMonthSync(year, month);
      if (cached !== null) {
        return cached;
      }
    }
    
    // Senão, buscar do Supabase (com await)
    console.log(`🔄 WorkflowCacheManager: Fetching from Supabase for ${year}-${month}`);
    return await this.fetchFromSupabaseAndCache(year, month);
  }

  /**
   * Versão assíncrona pública para carregar do Supabase
   */
  async fetchFromSupabaseAndCache(year: number, month: number): Promise<WorkflowSession[]> {
    console.log(`🔄 WorkflowCacheManager: Fetching from Supabase for ${year}-${month}`);
    const sessions = await this.fetchFromSupabase(year, month);
    this.updateCache(year, month, sessions, true);
    return sessions;
  }

  /**
   * ✅ FASE 1: Busca sessões do Supabase com BATCH query para transações
   */
  private async fetchFromSupabase(year: number, month: number): Promise<WorkflowSession[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      console.error('❌ WorkflowCacheManager: User not authenticated');
      return [];
    }

    // Calcular range de datas do mês
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const { data, error } = await supabase
      .from('clientes_sessoes')
      .select(`
        *,
        clientes (
          nome,
          email,
          telefone,
          whatsapp
        )
      `)
      .eq('user_id', user.user.id)
      .gte('data_sessao', startDate)
      .lte('data_sessao', endDate)
      .neq('status', 'historico')
      .eq('tipo_registro', 'workflow')
      .order('data_sessao', { ascending: true })
      .order('hora_sessao', { ascending: true });

    if (error) {
      console.error('❌ WorkflowCacheManager: Error fetching sessions:', error);
      throw error;
    }

    console.log(`✅ WorkflowCacheManager: Fetched ${data?.length || 0} sessions for ${year}-${month}`);
    
    // ✅ FASE 1: BATCH QUERY chunked (paridade com transactionsRepo).
    const sessionIds = (data || []).map(s => s.session_id);
    const { transactionsRepo } = await import('@/features/workflow/data');
    const allTransacoes = await transactionsRepo.listBySessionIds(user.user.id, sessionIds);

    console.log(`✅ BATCH: Loaded ${allTransacoes?.length || 0} transactions for ${sessionIds.length} sessions`);

    // Agrupar transações por session_id em memória
    const transacoesPorSessao = (allTransacoes || []).reduce((acc, t) => {
      if (!acc[t.session_id]) acc[t.session_id] = [];
      acc[t.session_id].push(t);
      return acc;
    }, {} as Record<string, any[]>);

    // Mapear sessões com pagamentos anexados
    const sessionsWithPayments = (data || []).map(session => {
      const transacoesData = transacoesPorSessao[session.session_id] || [];
      
      const pagamentos = transacoesData.map((t: any) => {
        const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
        const paymentId = match ? match[1] : t.id;
        
        const isPaid = t.tipo === 'pagamento';
        const isPending = t.tipo === 'ajuste';
        
        const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
        const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
        const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;
        
        let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
        if (isPending) {
          tipo = totalParcelas ? 'parcelado' : 'agendado';
        }
        
        let statusPagamento: 'pago' | 'pendente' | 'atrasado' = 'pago';
        if (isPending) {
          statusPagamento = 'pendente';
          if (t.data_vencimento && new Date(t.data_vencimento) < new Date()) {
            statusPagamento = 'atrasado';
          }
        }
        
        return {
          id: paymentId,
          valor: Number(t.valor) || 0,
          data: isPaid ? t.data_transacao : '',
          dataVencimento: t.data_vencimento || undefined,
          observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
          tipo,
          statusPagamento,
          numeroParcela,
          totalParcelas,
          origem: 'manual' as const,
          editavel: true
        };
      });
      
      return {
        ...session,
        pagamentos
      };
    });
    
    return sessionsWithPayments as WorkflowSession[];
  }

  /**
   * Atualiza cache para um mês
   */
  updateCache(year: number, month: number, sessions: WorkflowSession[], isPreloaded: boolean = false) {
    const key = this.getCacheKey(year, month);
    
    this.cache.set(key, {
      sessions,
      lastUpdate: Date.now(),
      isPreloaded
    });

    console.log(`💾 WorkflowCacheManager: Cache updated for ${key} (${sessions.length} sessions)`);

    // Salvar no LocalStorage
    this.saveCacheToLocalStorage();

    // Broadcast para outras tabs
    this.broadcastUpdate('cache-updated', { year, month, sessionsCount: sessions.length });
  }

  /**
   * Adiciona uma sessão ao cache
   */
  addSession(session: WorkflowSession) {
    // CORREÇÃO: Parse direto da string para evitar bug de timezone
    const [year, month] = (session.data_sessao || '').split('-').map(Number);
    if (!year || !month) {
      console.warn('⚠️ addSession: data_sessao inválida:', session.data_sessao);
      return;
    }
    const key = this.getCacheKey(year, month);
    
    const cached = this.cache.get(key);
    if (cached) {
      // Verificar se sessão já existe
      const exists = cached.sessions.some(s => s.id === session.id || s.session_id === session.session_id);
      
      if (!exists) {
        cached.sessions.unshift(session); // Adicionar no início
        cached.lastUpdate = Date.now();
        console.log(`➕ WorkflowCacheManager: Session added to cache ${key}`);
        
        // Salvar no LocalStorage
        this.saveCacheToLocalStorage();
        
        // Notificar listeners
        this.notifyListeners(cached.sessions);
        
        // Broadcast
        this.broadcastUpdate('session-added', { session, year, month });
      }
    }
  }

  /**
   * Atualiza uma sessão no cache
   */
  updateSession(sessionId: string, updates: Partial<WorkflowSession>) {
    let updated = false;
    
    this.cache.forEach((entry, key) => {
      const index = entry.sessions.findIndex(
        s => s.id === sessionId || s.session_id === sessionId
      );
      
      if (index !== -1) {
        entry.sessions[index] = { ...entry.sessions[index], ...updates };
        entry.lastUpdate = Date.now();
        updated = true;
        
        console.log(`📝 WorkflowCacheManager: Session updated in cache ${key}`);
        
        // Salvar no LocalStorage
        this.saveCacheToLocalStorage();
        
        // Notificar listeners
        this.notifyListeners(entry.sessions);
        
        // Broadcast
        this.broadcastUpdate('session-updated', { sessionId, updates, cacheKey: key });
      }
    });
    
    if (!updated) {
      console.warn(`⚠️ WorkflowCacheManager: Session ${sessionId} not found in cache for update`);
    }
  }

  /**
   * Remove uma sessão do cache
   */
  removeSession(sessionId: string) {
    let removed = false;
    
    this.cache.forEach((entry, key) => {
      const index = entry.sessions.findIndex(
        s => s.id === sessionId || s.session_id === sessionId
      );
      
      if (index !== -1) {
        entry.sessions.splice(index, 1);
        entry.lastUpdate = Date.now();
        removed = true;
        
        console.log(`🗑️ WorkflowCacheManager: Session removed from cache ${key}`);
        
        // Salvar no LocalStorage
        this.saveCacheToLocalStorage();
        
        // Notificar listeners
        this.notifyListeners(entry.sessions);
        
        // Broadcast
        this.broadcastUpdate('session-removed', { sessionId, cacheKey: key });
      }
    });
    
    if (!removed) {
      console.warn(`⚠️ WorkflowCacheManager: Session ${sessionId} not found in cache for removal`);
    }
  }

  /**
   * Invalida cache de um mês específico
   */
  invalidateMonth(year: number, month: number) {
    const key = this.getCacheKey(year, month);
    this.cache.delete(key);
    console.log(`🗑️ WorkflowCacheManager: Cache invalidated for ${key}`);
    
    // Broadcast
    this.broadcastUpdate('cache-invalidated', { year, month });
  }

  /**
   * Limpa todo o cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ WorkflowCacheManager: All cache cleared');
    
    // Broadcast
    this.broadcastUpdate('cache-cleared', {});
  }

  /**
   * ✅ FASE 6: Limpa completamente todo o cache (alias para clearCache)
   */
  clearAllCache() {
    this.clearCache();
  }

  /**
   * Salva cache no LocalStorage
   * ✅ CORREÇÃO: Salva TODOS os campos necessários para edição
   */
  private saveCacheToLocalStorage() {
    if (!this.userId) return;
    
    try {
      // ✅ CORREÇÃO: Salvar dados COMPLETOS (todos os campos críticos)
      const cacheEntries = Array.from(this.cache.entries()).map(([key, entry]) => {
        return [
          key,
          {
            sessions: entry.sessions.map(s => ({
              // ✅ Manter TODOS os campos da sessão para permitir edição
              ...s,
              // Otimizar apenas o objeto clientes (manter campos principais)
              clientes: s.clientes ? {
                nome: s.clientes.nome,
                email: s.clientes.email,
                telefone: s.clientes.telefone,
                whatsapp: s.clientes.whatsapp
              } : undefined
            })),
            lastUpdate: entry.lastUpdate,
            isPreloaded: entry.isPreloaded
          }
        ];
      });
      
      const cacheData = {
        userId: this.userId,
        cache: cacheEntries,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheData));
      
      // ✅ LOGGING DETALHADO
      const firstEntry = Array.from(this.cache.values())[0];
      console.log('💾 Cache saved to LocalStorage:', {
        months: this.cache.size,
        totalSessions: Array.from(this.cache.values()).reduce((sum, e) => sum + e.sessions.length, 0),
        sampleSession: firstEntry?.sessions[0] ? {
          id: firstEntry.sessions[0].id,
          hasRegrasCongeladas: !!firstEntry.sessions[0].regras_congeladas,
          hasDescricao: !!firstEntry.sessions[0].descricao,
          hasProdutosIncluidos: Array.isArray(firstEntry.sessions[0].produtos_incluidos),
          hasValorBasePackote: !!firstEntry.sessions[0].valor_base_pacote
        } : null
      });
    } catch (error) {
      console.error('❌ WorkflowCacheManager: Failed to save cache:', error);
      // Se falhar por quota excedida, tentar limpar cache antigo
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('⚠️ LocalStorage quota exceeded, clearing old cache');
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  /**
   * Carrega cache do LocalStorage
   * ✅ CORREÇÃO: Garante hydration completa com valores padrão
   */
  private loadCacheFromLocalStorage(): boolean {
    if (!this.userId) return false;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return false;
      
      const { userId, cache: cacheEntries, timestamp } = JSON.parse(stored);
      
      // Validar userId
      if (userId !== this.userId) {
        console.log('⚠️ WorkflowCacheManager: Cache userId mismatch, clearing');
        localStorage.removeItem(this.STORAGE_KEY);
        return false;
      }
      
      // Validar idade (máximo configurado em STORAGE_MAX_AGE)
      const age = Date.now() - timestamp;
      if (age > this.STORAGE_MAX_AGE) {
        console.log('⚠️ WorkflowCacheManager: Cache too old, clearing');
        localStorage.removeItem(this.STORAGE_KEY);
        return false;
      }
      
      // ✅ CORREÇÃO: Restaurar cache com hydration completa
      const restoredCache = new Map<string, CacheEntry>(
        cacheEntries.map(([key, entry]: [string, CacheEntry]) => [
          key,
          {
            ...entry,
            sessions: entry.sessions.map(s => ({
              ...s,
              // ✅ Garantir campos com valores padrão se faltarem
              descricao: s.descricao ?? '',
              status: s.status ?? 'agendado',
              qtd_fotos_extra: s.qtd_fotos_extra ?? 0,
              valor_foto_extra: s.valor_foto_extra ?? 0,
              valor_total_foto_extra: s.valor_total_foto_extra ?? 0,
              valor_adicional: s.valor_adicional ?? 0,
              desconto: s.desconto ?? 0,
              observacoes: s.observacoes ?? '',
              detalhes: s.detalhes ?? '',
              produtos_incluidos: s.produtos_incluidos ?? [],
              regras_congeladas: s.regras_congeladas ?? null
            }))
          }
        ])
      );
      
      this.cache = restoredCache;
      
      // ✅ LOGGING DETALHADO
      const firstEntry = Array.from(this.cache.values())[0];
      console.log('📂 Cache loaded from LocalStorage:', {
        months: this.cache.size,
        ageSeconds: Math.round(age / 1000),
        totalSessions: Array.from(this.cache.values()).reduce((sum, e) => sum + e.sessions.length, 0),
        sampleSession: firstEntry?.sessions[0] ? {
          id: firstEntry.sessions[0].id,
          hasRegrasCongeladas: !!firstEntry.sessions[0].regras_congeladas,
          hasDescricao: !!firstEntry.sessions[0].descricao,
          hasProdutosIncluidos: Array.isArray(firstEntry.sessions[0].produtos_incluidos)
        } : null
      });
      
      return true;
    } catch (error) {
      console.error('❌ WorkflowCacheManager: Failed to load cache:', error);
      return false;
    }
  }

  /**
   * Subscribe para mudanças no cache
   */
  subscribe(listener: CacheUpdateListener): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifica todos os listeners
   */
  private notifyListeners(sessions: WorkflowSession[]) {
    this.listeners.forEach(listener => {
      try {
        listener(sessions);
      } catch (error) {
        console.error('❌ WorkflowCacheManager: Error notifying listener:', error);
      }
    });
  }

  /**
   * Broadcast de atualização para outras tabs
   */
  private broadcastUpdate(action: string, data: any) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          action,
          data,
          timestamp: Date.now(),
          userId: this.userId
        });
      } catch (error) {
        console.error('❌ WorkflowCacheManager: Error broadcasting:', error);
      }
    }
  }

  /**
   * Handler de mensagens do BroadcastChannel
   */
  private handleBroadcastMessage(event: MessageEvent) {
    const { action, data, userId } = event.data;
    
    // Ignorar mensagens do próprio userId
    if (userId === this.userId) return;
    
    console.log(`📨 WorkflowCacheManager: Received broadcast - ${action}`);
    
    switch (action) {
      case 'cache-updated':
        // Recarregar cache se necessário
        this.getSessionsForMonth(data.year, data.month, true);
        break;
        
      case 'session-added':
        this.addSession(data.session);
        break;
        
      case 'session-updated':
        this.updateSession(data.sessionId, data.updates);
        break;
        
      case 'session-removed':
        this.removeSession(data.sessionId);
        break;
        
      case 'cache-invalidated':
        this.invalidateMonth(data.year, data.month);
        break;
        
      case 'cache-cleared':
        this.clearCache();
        break;
    }
  }

  /**
   * Cleanup ao deslogar
   */
  cleanup() {
    this.clearCache();
    this.listeners.clear();
    this.userId = null;
    console.log('🧹 WorkflowCacheManager: Cleanup completed');
  }

  /**
   * Destroy (fechar BroadcastChannel)
   */
  destroy() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.cleanup();
  }
}

export const workflowCacheManager = WorkflowCacheManager.getInstance();
