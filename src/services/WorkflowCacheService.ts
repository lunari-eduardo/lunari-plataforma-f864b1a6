/**
 * WorkflowCacheService - Pure cache logic with IndexedDB
 * 
 * Single source of truth for workflow sessions cache:
 * - In-memory cache (Map) for instant access
 * - IndexedDB persistence via localForage
 * - Intelligent preload (4 months: current, -2, +1)
 * - TTL: 12 hours
 * - Supabase realtime subscriptions
 * - BroadcastChannel for cross-tab sync
 */

import localforage from 'localforage';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface WorkflowSession {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id: string;
  appointment_id?: string;
  data_sessao: string;
  hora_sessao: string;
  categoria: string;
  pacote?: string;
  descricao?: string;
  status: string;
  valor_total: number;
  valor_base_pacote?: number;
  valor_pago: number;
  produtos_incluidos: any;
  qtd_fotos_extra?: number;
  valor_foto_extra?: number;
  valor_total_foto_extra?: number;
  regras_congeladas?: any;
  desconto?: number;
  valor_adicional?: number;
  observacoes?: string | null;
  detalhes?: string | null;
  clientes?: {
    nome: string;
    email?: string;
    telefone?: string;
    whatsapp?: string;
  };
  pagamentos?: any[];
}

interface CacheEntry {
  sessions: WorkflowSession[];
  lastUpdate: number;
  version: string;
}

interface CacheStats {
  monthsCached: number;
  totalSessions: number;
  oldestCache: Date | null;
  newestCache: Date | null;
}

type CacheUpdateCallback = (year: number, month: number, sessions: WorkflowSession[]) => void;

export class WorkflowCacheService {
  private static instance: WorkflowCacheService | null = null;
  
  private cache: Map<string, CacheEntry> = new Map();
  private supabaseSubscriptions: Map<string, RealtimeChannel> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private updateCallbacks: Set<CacheUpdateCallback> = new Set();
  private userId: string | null = null;
  
  private readonly CACHE_VERSION = 'v1';
  private readonly CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
  private readonly DB_NAME = 'WorkflowCache';
  private readonly CHANNEL_NAME = 'workflow-cache-sync';
  
  private isPreloading = false;
  private preloadPromise: Promise<void> | null = null;

  private constructor() {
    this.initIndexedDB();
    this.initBroadcastChannel();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WorkflowCacheService {
    if (!WorkflowCacheService.instance) {
      WorkflowCacheService.instance = new WorkflowCacheService();
    }
    return WorkflowCacheService.instance;
  }

  /**
   * Configure localForage for IndexedDB
   */
  private initIndexedDB() {
    localforage.config({
      driver: localforage.INDEXEDDB,
      name: this.DB_NAME,
      storeName: 'sessions',
      description: 'Cache de sessões do workflow'
    });
    console.log('💾 WorkflowCacheService: IndexedDB initialized');
  }

  /**
   * Initialize BroadcastChannel for cross-tab sync
   */
  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(this.CHANNEL_NAME);
      this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
      console.log('📡 WorkflowCacheService: BroadcastChannel initialized');
    }
  }

  /**
   * Set user ID and load cache from IndexedDB
   */
  async setUserId(userId: string) {
    if (this.userId !== userId) {
      this.userId = userId;
      this.cache.clear();
      console.log('👤 WorkflowCacheService: User changed, loading cache...');
      await this.loadFromIndexedDB();
    }
  }

  /**
   * Generate cache key for a month
   */
  private getCacheKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  /**
   * Check if cache is stale (expired)
   */
  private isCacheStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    
    const age = Date.now() - entry.lastUpdate;
    const isStale = age > this.CACHE_TTL;
    
    if (isStale) {
      console.log(`⏰ WorkflowCacheService: Cache stale for ${key} (${(age / 1000 / 60 / 60).toFixed(1)}h old)`);
    }
    
    return isStale;
  }

  /**
   * SYNC: Get sessions from cache (instantaneous)
   */
  getCacheSync(year: number, month: number): WorkflowSession[] | null {
    const key = this.getCacheKey(year, month);
    const entry = this.cache.get(key);
    
    if (entry && !this.isCacheStale(key)) {
      console.log(`⚡ Cache HIT (sync): ${key} (${entry.sessions.length} sessions)`);
      return entry.sessions;
    }
    
    console.log(`⏳ Cache MISS (sync): ${key}`);
    return null;
  }

  /**
   * ASYNC: Fetch sessions from Supabase
   */
  async fetchFromSupabase(year: number, month: number): Promise<WorkflowSession[]> {
    if (!this.userId) {
      console.error('❌ WorkflowCacheService: No userId set');
      return [];
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    console.log(`🔄 Fetching from Supabase: ${year}-${month} (${startDate} to ${endDate})`);

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
      .eq('user_id', this.userId)
      .gte('data_sessao', startDate)
      .lte('data_sessao', endDate)
      .neq('status', 'historico')
      .order('data_sessao', { ascending: false })
      .order('hora_sessao', { ascending: true });

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      throw error;
    }

    // Load payments for each session
    const sessionsWithPayments = await Promise.all(
      (data || []).map(async (session) => {
        const { data: transacoesData } = await supabase
          .from('clientes_transacoes')
          .select('*')
          .eq('session_id', session.session_id)
          .eq('user_id', this.userId!)
          .in('tipo', ['pagamento', 'ajuste'])
          .order('data_transacao', { ascending: false });

        const pagamentos = (transacoesData || []).map(t => {
          const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
          const paymentId = match ? match[1] : t.id;
          const isPaid = t.tipo === 'pagamento';
          
          return {
            id: paymentId,
            valor: Number(t.valor) || 0,
            data: isPaid ? t.data_transacao : '',
            dataVencimento: t.data_vencimento || undefined,
            observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
            tipo: isPaid ? 'pago' : 'agendado',
            statusPagamento: isPaid ? 'pago' : 'pendente',
            origem: 'manual',
            editavel: true
          };
        });

        return {
          ...session,
          pagamentos
        } as WorkflowSession;
      })
    );

    console.log(`✅ Fetched ${sessionsWithPayments.length} sessions for ${year}-${month}`);
    return sessionsWithPayments;
  }

  /**
   * Update in-memory cache
   */
  setCacheSync(year: number, month: number, sessions: WorkflowSession[]) {
    const key = this.getCacheKey(year, month);
    
    this.cache.set(key, {
      sessions,
      lastUpdate: Date.now(),
      version: this.CACHE_VERSION
    });

    console.log(`💾 Cache updated: ${key} (${sessions.length} sessions)`);
  }

  /**
   * Save cache to IndexedDB
   */
  async saveToIndexedDB() {
    if (!this.userId) return;

    try {
      const cacheData = {
        userId: this.userId,
        cache: Array.from(this.cache.entries()),
        timestamp: Date.now()
      };

      await localforage.setItem(`cache:${this.userId}`, cacheData);
      console.log('💾 Cache saved to IndexedDB');
    } catch (error) {
      console.error('❌ Failed to save to IndexedDB:', error);
    }
  }

  /**
   * Load cache from IndexedDB
   */
  async loadFromIndexedDB() {
    if (!this.userId) return;

    try {
      const cacheData = await localforage.getItem<any>(`cache:${this.userId}`);
      
      if (!cacheData) {
        console.log('ℹ️ No cache found in IndexedDB');
        return;
      }

      // Validate user
      if (cacheData.userId !== this.userId) {
        console.warn('⚠️ Cache userId mismatch, clearing');
        await localforage.removeItem(`cache:${this.userId}`);
        return;
      }

      // Restore cache
      this.cache = new Map(cacheData.cache);
      
      // Validate cache age
      let validMonths = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (this.isCacheStale(key)) {
          this.cache.delete(key);
          console.log(`🗑️ Removed stale cache: ${key}`);
        } else {
          validMonths++;
        }
      }

      console.log(`✅ Cache loaded from IndexedDB: ${validMonths} valid months`);
      
      // Notify callbacks
      this.cache.forEach((entry, key) => {
        const [year, month] = key.split('-').map(Number);
        this.notifyCallbacks(year, month, entry.sessions);
      });
    } catch (error) {
      console.error('❌ Failed to load from IndexedDB:', error);
    }
  }

  /**
   * Intelligent preload: current + 2 previous + 1 next month
   */
  async preloadMonths(baseYear: number, baseMonth: number): Promise<void> {
    if (this.preloadPromise) {
      console.log('⏳ Preload already in progress');
      return this.preloadPromise;
    }

    this.isPreloading = true;
    this.preloadPromise = (async () => {
      try {
        const months = [];

        // Add 2 previous months
        for (let i = 2; i >= 1; i--) {
          const date = new Date(baseYear, baseMonth - 1 - i, 1);
          months.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
        }

        // Add current month
        months.push({ year: baseYear, month: baseMonth });

        // Add 1 next month
        const nextMonth = new Date(baseYear, baseMonth, 1);
        months.push({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 });

        console.log('🔄 Preloading months:', months);

        // Parallel fetch (max 3 at a time)
        const chunks = this.chunkArray(months, 3);
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(async ({ year, month }) => {
              // Skip if already cached and not stale
              const cached = this.getCacheSync(year, month);
              if (cached !== null) {
                console.log(`⚡ Skip preload: ${year}-${month} (already cached)`);
                return;
              }

              const sessions = await this.fetchFromSupabase(year, month);
              this.setCacheSync(year, month, sessions);
              this.notifyCallbacks(year, month, sessions);
            })
          );
        }

        await this.saveToIndexedDB();
        console.log('✅ Preload completed');
      } catch (error) {
        console.error('❌ Preload failed:', error);
      } finally {
        this.isPreloading = false;
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Helper: split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Subscribe to realtime updates for a month
   */
  subscribeToRealtimeUpdates(year: number, month: number) {
    this.subscribeToSessionUpdates(year, month);
    this.subscribeToPaymentUpdates(year, month);
  }

  /**
   * Subscribe to session changes
   */
  private subscribeToSessionUpdates(year: number, month: number) {
    const key = this.getCacheKey(year, month);
    
    if (this.supabaseSubscriptions.has(`${key}-sessions`)) {
      console.log(`📡 Already subscribed to sessions: ${key}`);
      return;
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const channel = supabase
      .channel(`workflow-sessions-${key}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes',
          filter: `data_sessao=gte.${startDate},data_sessao=lte.${endDate}`
        },
        (payload) => {
          console.log('🔄 Session realtime update:', payload);
          this.handleRealtimeUpdate(year, month, payload);
        }
      )
      .subscribe();

    this.supabaseSubscriptions.set(`${key}-sessions`, channel);
    console.log(`📡 Subscribed to session updates: ${key}`);
  }

  /**
   * Subscribe to payment changes for realtime sync
   */
  private subscribeToPaymentUpdates(year: number, month: number) {
    const key = this.getCacheKey(year, month);
    
    if (this.supabaseSubscriptions.has(`${key}-payments`)) {
      console.log(`📡 Already subscribed to payments: ${key}`);
      return;
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    console.log(`📡 Subscribing to payment updates: ${key}`);

    const channel = supabase
      .channel(`workflow-payments-${key}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_transacoes',
          filter: `data_transacao=gte.${startDate},data_transacao=lte.${endDate}`
        },
        async (payload: any) => {
          console.log('💰 Payment realtime update:', payload);
          
          // Invalidate the session that received the payment
          const sessionId = (payload.new as any)?.session_id || (payload.old as any)?.session_id;
          if (sessionId) {
            await this.invalidateSessionById(sessionId);
          }
        }
      )
      .subscribe();

    this.supabaseSubscriptions.set(`${key}-payments`, channel);
    console.log(`✅ Subscribed to payment realtime: ${key}`);
  }

  /**
   * Handle realtime update
   */
  private handleRealtimeUpdate(year: number, month: number, payload: any) {
    const cached = this.getCacheSync(year, month);
    if (!cached) return;

    let updated = [...cached];

    if (payload.eventType === 'INSERT') {
      updated.unshift(payload.new as WorkflowSession);
    } else if (payload.eventType === 'UPDATE') {
      const index = updated.findIndex(s => s.id === payload.new.id);
      if (index !== -1) updated[index] = payload.new as WorkflowSession;
    } else if (payload.eventType === 'DELETE') {
      updated = updated.filter(s => s.id !== payload.old.id);
    }

    this.setCacheSync(year, month, updated);
    this.saveToIndexedDB();
    this.notifyCallbacks(year, month, updated);
    this.broadcastUpdate('cache-updated', { year, month });
  }

  /**
   * Unsubscribe from all realtime updates
   */
  unsubscribeFromRealtime() {
    this.supabaseSubscriptions.forEach((channel, key) => {
      supabase.removeChannel(channel);
      console.log(`📡 Unsubscribed from realtime: ${key}`);
    });
    this.supabaseSubscriptions.clear();
  }

  /**
   * Update a session in Supabase and cache
   */
  async updateSession(sessionId: string, updates: Partial<WorkflowSession>): Promise<void> {
    if (!this.userId) throw new Error('No userId set');

    // 1. Update in Supabase
    const { error } = await supabase
      .from('clientes_sessoes')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', this.userId);
    
    if (error) throw error;
    
    // 2. Update in cache
    this.updateSessionInCache(sessionId, updates);
    
    // 3. Persist to IndexedDB
    await this.saveToIndexedDB();
    
    // 4. Broadcast to other tabs
    this.broadcastUpdate('session-updated', { sessionId, updates });
    
    console.log(`✅ Session updated: ${sessionId}`);
  }

  /**
   * Delete a session from Supabase and cache
   */
  async deleteSession(sessionId: string, dataSessao: string): Promise<void> {
    if (!this.userId) throw new Error('No userId set');

    // 1. Delete from Supabase
    const { error } = await supabase
      .from('clientes_sessoes')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', this.userId);
    
    if (error) throw error;
    
    // 2. Remove from cache
    this.removeSessionFromCache(sessionId, dataSessao);
    
    // 3. Persist to IndexedDB
    await this.saveToIndexedDB();
    
    // 4. Broadcast to other tabs
    this.broadcastUpdate('session-deleted', { sessionId });
    
    console.log(`✅ Session deleted: ${sessionId}`);
  }

  /**
   * Helper: Update session in cache memory
   */
  private updateSessionInCache(sessionId: string, updates: Partial<WorkflowSession>): void {
    for (const [key, entry] of this.cache.entries()) {
      const sessionIndex = entry.sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        entry.sessions[sessionIndex] = {
          ...entry.sessions[sessionIndex],
          ...updates
        };
        
        const [year, month] = key.split('-').map(Number);
        this.notifyCallbacks(year, month, entry.sessions);
        console.log(`💾 Cache updated for session: ${sessionId} in ${key}`);
        break;
      }
    }
  }

  /**
   * Helper: Remove session from cache
   */
  private removeSessionFromCache(sessionId: string, dataSessao: string): void {
    const date = new Date(dataSessao);
    const key = this.getCacheKey(date.getFullYear(), date.getMonth() + 1);
    const entry = this.cache.get(key);
    
    if (entry) {
      entry.sessions = entry.sessions.filter(s => s.id !== sessionId);
      this.notifyCallbacks(
        date.getFullYear(),
        date.getMonth() + 1,
        entry.sessions
      );
      console.log(`🗑️ Session removed from cache: ${sessionId} from ${key}`);
    }
  }

  /**
   * Invalidate cache for a specific session (by fetching its date)
   */
  async invalidateSessionById(sessionId: string): Promise<void> {
    if (!this.userId) return;

    try {
      // Fetch session to discover its month
      const { data: session } = await supabase
        .from('clientes_sessoes')
        .select('data_sessao')
        .eq('id', sessionId)
        .eq('user_id', this.userId)
        .single();
      
      if (session) {
        const date = new Date(session.data_sessao);
        await this.invalidateMonth(date.getFullYear(), date.getMonth() + 1);
        console.log(`🗑️ Cache invalidated for session: ${sessionId}`);
      }
    } catch (error) {
      console.error('❌ Failed to invalidate session cache:', error);
    }
  }

  /**
   * Invalidate a month (force refresh)
   */
  async invalidateMonth(year: number, month: number) {
    const key = this.getCacheKey(year, month);
    this.cache.delete(key);
    console.log(`🗑️ Cache invalidated: ${key}`);
    
    await this.saveToIndexedDB();
    this.broadcastUpdate('cache-invalidated', { year, month });
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    this.cache.clear();
    if (this.userId) {
      await localforage.removeItem(`cache:${this.userId}`);
    }
    console.log('🗑️ All cache cleared');
    this.broadcastUpdate('cache-cleared', {});
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    let totalSessions = 0;
    let oldestCache: Date | null = null;
    let newestCache: Date | null = null;

    this.cache.forEach(entry => {
      totalSessions += entry.sessions.length;
      const date = new Date(entry.lastUpdate);
      
      if (!oldestCache || date < oldestCache) oldestCache = date;
      if (!newestCache || date > newestCache) newestCache = date;
    });

    return {
      monthsCached: this.cache.size,
      totalSessions,
      oldestCache,
      newestCache
    };
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: CacheUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /**
   * Notify callbacks
   */
  private notifyCallbacks(year: number, month: number, sessions: WorkflowSession[]) {
    this.updateCallbacks.forEach(cb => cb(year, month, sessions));
  }

  /**
   * Broadcast update to other tabs
   */
  private broadcastUpdate(action: string, data: any) {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ action, data, timestamp: Date.now() });
    }
  }

  /**
   * Handle broadcast message
   */
  private async handleBroadcastMessage(event: MessageEvent) {
    const { action, data } = event.data;
    
    console.log('📡 Received broadcast:', action, data);
    
    if (action === 'cache-updated' || action === 'cache-invalidated') {
      await this.loadFromIndexedDB();
    } else if (action === 'cache-cleared') {
      this.cache.clear();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.unsubscribeFromRealtime();
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.updateCallbacks.clear();
    console.log('🧹 WorkflowCacheService destroyed');
  }
}
