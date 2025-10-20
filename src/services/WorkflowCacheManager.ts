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
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly CHANNEL_NAME = 'workflow-cache-sync';

  private constructor() {
    this.initBroadcastChannel();
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
   * Define o userId atual
   */
  setUserId(userId: string) {
    if (this.userId !== userId) {
      this.userId = userId;
      this.cache.clear();
      console.log('👤 WorkflowCacheManager: User changed, cache cleared');
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
   * Pré-carrega mês atual e anterior
   */
  async preloadCurrentAndPreviousMonth(): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Calcular mês anterior
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    console.log('🔄 WorkflowCacheManager: Preloading current and previous month...');
    
    try {
      await Promise.all([
        this.getSessionsForMonth(currentYear, currentMonth, true),
        this.getSessionsForMonth(prevYear, prevMonth, true)
      ]);
      
      console.log('✅ WorkflowCacheManager: Preload completed');
    } catch (error) {
      console.error('❌ WorkflowCacheManager: Preload failed:', error);
    }
  }

  /**
   * Obtém sessões para um mês (com cache)
   */
  async getSessionsForMonth(
    year: number, 
    month: number,
    forceRefresh: boolean = false
  ): Promise<WorkflowSession[]> {
    const key = this.getCacheKey(year, month);
    const cached = this.cache.get(key);

    // Retornar cache se válido e não forçar refresh
    if (cached && !forceRefresh && !this.isCacheStale(year, month)) {
      console.log(`⚡ WorkflowCacheManager: Cache hit for ${key}`);
      return cached.sessions;
    }

    // Buscar do Supabase
    console.log(`🔄 WorkflowCacheManager: Fetching from Supabase for ${key}`);
    const sessions = await this.fetchFromSupabase(year, month);
    
    // Atualizar cache
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
