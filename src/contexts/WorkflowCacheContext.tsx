/**
 * WorkflowCacheContext - React Context for Workflow Cache
 * 
 * Provides:
 * - Single source of truth for workflow data
 * - Sync API for instant cache access
 * - Async API for Supabase fallback
 * - Realtime subscriptions
 * - Cross-tab synchronization
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { WorkflowCacheService, WorkflowSession } from '@/services/WorkflowCacheService';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowCacheContextType {
  // State
  isPreloading: boolean;
  lastUpdate: Date | null;
  
  // Sync methods (instantaneous)
  getSessionsForMonthSync: (year: number, month: number) => WorkflowSession[] | null;
  isMonthCached: (year: number, month: number) => boolean;
  
  // Async methods
  fetchMonth: (year: number, month: number) => Promise<WorkflowSession[]>;
  invalidateMonth: (year: number, month: number) => Promise<void>;
  
  // Mutation methods
  updateSession: (sessionId: string, updates: Partial<WorkflowSession>) => Promise<void>;
  deleteSession: (sessionId: string, dataSessao: string) => Promise<void>;
  invalidateSessionById: (sessionId: string) => Promise<void>;
  
  // Realtime
  subscribeToMonth: (year: number, month: number, callback: (sessions: WorkflowSession[]) => void) => () => void;
  
  // Cache management
  clearCache: () => Promise<void>;
  getCacheStats: () => {
    monthsCached: number;
    totalSessions: number;
    oldestCache: Date | null;
    newestCache: Date | null;
  };
}

const WorkflowCacheContext = createContext<WorkflowCacheContextType | undefined>(undefined);

export const WorkflowCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const serviceRef = useRef<WorkflowCacheService>(WorkflowCacheService.getInstance());
  const monthCallbacksRef = useRef<Map<string, Set<(sessions: WorkflowSession[]) => void>>>(new Map());

  // Initialize service
  useEffect(() => {
    console.log('🚀 WorkflowCacheProvider: Service initialized');

    // Setup global cache update listener
    const unsubscribe = serviceRef.current.onCacheUpdate((year, month, sessions) => {
      setLastUpdate(new Date());
      
      // Notify month-specific callbacks
      const key = `${year}-${month}`;
      const callbacks = monthCallbacksRef.current.get(key);
      if (callbacks) {
        callbacks.forEach(cb => cb(sessions));
      }
    });

    return () => {
      unsubscribe();
      if (serviceRef.current) {
        serviceRef.current.destroy();
      }
    };
  }, []);

  // Setup user and preload on login
  useEffect(() => {
    const setupUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && serviceRef.current) {
        console.log('👤 WorkflowCacheProvider: User detected, setting up cache');
        await serviceRef.current.setUserId(user.id);
        
        // Start preload in background (non-blocking)
        const now = new Date();
        setIsPreloading(true);
        serviceRef.current.preloadMonths(now.getFullYear(), now.getMonth() + 1)
          .finally(() => setIsPreloading(false));
      }
    };

    setupUser();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && serviceRef.current) {
        console.log('🔑 WorkflowCacheProvider: User signed in, setting up cache');
        setupUser();
      } else if (event === 'SIGNED_OUT' && serviceRef.current) {
        console.log('🚪 WorkflowCacheProvider: User signed out, clearing cache');
        serviceRef.current.clearCache();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync methods
  const getSessionsForMonthSync = useCallback((year: number, month: number): WorkflowSession[] | null => {
    if (!serviceRef.current) return null;
    return serviceRef.current.getCacheSync(year, month);
  }, []);

  const isMonthCached = useCallback((year: number, month: number): boolean => {
    const cached = getSessionsForMonthSync(year, month);
    return cached !== null;
  }, [getSessionsForMonthSync]);

  // Async methods
  const fetchMonth = useCallback(async (year: number, month: number): Promise<WorkflowSession[]> => {
    if (!serviceRef.current) return [];
    
    // Try sync first
    const cached = serviceRef.current.getCacheSync(year, month);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch from Supabase
    const sessions = await serviceRef.current.fetchFromSupabase(year, month);
    serviceRef.current.setCacheSync(year, month, sessions);
    await serviceRef.current.saveToIndexedDB();
    
    return sessions;
  }, []);

  const invalidateMonth = useCallback(async (year: number, month: number) => {
    if (!serviceRef.current) return;
    await serviceRef.current.invalidateMonth(year, month);
  }, []);

  // Mutation methods
  const updateSession = useCallback(async (sessionId: string, updates: Partial<WorkflowSession>) => {
    if (!serviceRef.current) return;
    await serviceRef.current.updateSession(sessionId, updates);
  }, []);

  const deleteSession = useCallback(async (sessionId: string, dataSessao: string) => {
    if (!serviceRef.current) return;
    await serviceRef.current.deleteSession(sessionId, dataSessao);
  }, []);

  const invalidateSessionById = useCallback(async (sessionId: string) => {
    if (!serviceRef.current) return;
    await serviceRef.current.invalidateSessionById(sessionId);
  }, []);

  // Realtime subscription
  const subscribeToMonth = useCallback((
    year: number, 
    month: number, 
    callback: (sessions: WorkflowSession[]) => void
  ): (() => void) => {
    const key = `${year}-${month}`;
    
    // Add callback
    if (!monthCallbacksRef.current.has(key)) {
      monthCallbacksRef.current.set(key, new Set());
    }
    monthCallbacksRef.current.get(key)!.add(callback);
    
    // Subscribe to realtime if not already subscribed
    if (serviceRef.current) {
      serviceRef.current.subscribeToRealtimeUpdates(year, month);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = monthCallbacksRef.current.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          monthCallbacksRef.current.delete(key);
        }
      }
    };
  }, []);

  // Cache management
  const clearCache = useCallback(async () => {
    if (!serviceRef.current) return;
    await serviceRef.current.clearCache();
  }, []);

  const getCacheStats = useCallback(() => {
    if (!serviceRef.current) {
      return {
        monthsCached: 0,
        totalSessions: 0,
        oldestCache: null,
        newestCache: null
      };
    }
    return serviceRef.current.getCacheStats();
  }, []);

  const value: WorkflowCacheContextType = {
    isPreloading,
    lastUpdate,
    getSessionsForMonthSync,
    isMonthCached,
    fetchMonth,
    invalidateMonth,
    updateSession,
    deleteSession,
    invalidateSessionById,
    subscribeToMonth,
    clearCache,
    getCacheStats
  };

  return (
    <WorkflowCacheContext.Provider value={value}>
      {children}
    </WorkflowCacheContext.Provider>
  );
};

export const useWorkflowCacheContext = () => {
  const context = useContext(WorkflowCacheContext);
  if (!context) {
    throw new Error('useWorkflowCacheContext must be used within WorkflowCacheProvider');
  }
  return context;
};
