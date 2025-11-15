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
   * Pré-carrega range de 4 meses: atual + 2 anteriores + 1 posterior
   */
  async preloadWorkflowRange(): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Calcular range: 2 meses anteriores + atual + 1 posterior
    const months = [];
    
    // 2 meses anteriores
    for (let i = 2; i >= 1; i--) {
      let month = currentMonth - i;
      let year = currentYear;
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      months.push({ year, month });
    }
    
    // Mês atual
    months.push({ year: currentYear, month: currentMonth });
    
    // 1 mês posterior
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    months.push({ year: nextYear, month: nextMonth });

    console.log('🔄 WorkflowCacheManager: Preloading 4 months:', months);
    
    try {
      // Carregar todos os meses em paralelo
      await Promise.all(
        months.map(({ year, month }) => 
          this.fetchFromSupabaseAndCache(year, month)
        )
      );
      
      console.log('✅ WorkflowCacheManager: Preload completed (4 months cached)');
      
      // Salvar no LocalStorage após pré-carregamento
      this.saveCacheToLocalStorage();
    } catch (error) {
      console.error('❌ WorkflowCacheManager: Preload failed:', error);
    }
  }

  /**
   * Obtém sessões para um mês (com cache) - VERSÃO SÍNCRONA
   */
  getSessionsForMonth(
    year: number, 
    month: number,
    forceRefresh: boolean = false
  ): WorkflowSession[] {
    const key = this.getCacheKey(year, month);
    const cached = this.cache.get(key);

    // Retornar cache se válido e não forçar refresh
    if (cached && !forceRefresh && !this.isCacheStale(year, month)) {
      console.log(`⚡ WorkflowCacheManager: Cache hit for ${key}`);
      return cached.sessions;
    }

    // Se não tem cache, retornar array vazio e carregar em background
    console.log(`🔄 WorkflowCacheManager: Cache miss for ${key}, loading in background`);
    this.fetchFromSupabaseAndCache(year, month);
    return [];
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
   * Busca sessões do Supabase com filtros otimizados
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
      .order('data_sessao', { ascending: false })
      .order('hora_sessao', { ascending: true });

    if (error) {
      console.error('❌ WorkflowCacheManager: Error fetching sessions:', error);
      throw error;
    }

    console.log(`✅ WorkflowCacheManager: Fetched ${data?.length || 0} sessions for ${year}-${month}`);
    
    // ✅ FASE 2: Cast explícito para preservar dados do JOIN (incluindo clientes)
    return (data || []) as WorkflowSession[];
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
    const sessionDate = new Date(session.data_sessao);
    const year = sessionDate.getFullYear();
    const month = sessionDate.getMonth() + 1;
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
   */
  private saveCacheToLocalStorage() {
    if (!this.userId) return;
    
    try {
      const cacheData = {
        userId: this.userId,
        cache: Array.from(this.cache.entries()),
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheData));
      console.log('💾 WorkflowCacheManager: Cache saved to LocalStorage');
    } catch (error) {
      console.error('❌ WorkflowCacheManager: Failed to save cache:', error);
    }
  }

  /**
   * Carrega cache do LocalStorage
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
      
      // Restaurar cache
      this.cache = new Map(cacheEntries);
      console.log(`✅ WorkflowCacheManager: Cache loaded from LocalStorage (${this.cache.size} months, age: ${Math.round(age / 1000)}s)`);
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
