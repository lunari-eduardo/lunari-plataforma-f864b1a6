/**
 * Singleton manager for Supabase real-time subscriptions
 * Ensures only one active subscription per table
 * Manages multiple listeners for the same subscription
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'categorias' | 'pacotes' | 'produtos' | 'etapas_trabalho' | 'clientes' | 'clientes_familia' | 'clientes_documentos' | 'appointments' | 'clientes_sessoes' | 'clientes_transacoes';

interface SubscriptionCallbacks {
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

interface Subscription {
  channel: RealtimeChannel;
  listeners: Map<string, SubscriptionCallbacks>;
  retryCount: number;
  retryTimeout?: NodeJS.Timeout;
  isConnecting: boolean;
}

class RealtimeSubscriptionManager {
  private static instance: RealtimeSubscriptionManager;
  private subscriptions: Map<TableName, Subscription> = new Map();
  private maxRetries = 3;
  private baseRetryDelay = 1000; // 1 second
  private userId: string | null = null;

  private constructor() {}

  static getInstance(): RealtimeSubscriptionManager {
    if (!RealtimeSubscriptionManager.instance) {
      RealtimeSubscriptionManager.instance = new RealtimeSubscriptionManager();
    }
    return RealtimeSubscriptionManager.instance;
  }

  /**
   * Subscribe to a table with callbacks
   * Returns a listener ID that can be used to unsubscribe
   */
  async subscribe(
    tableName: TableName,
    callbacks: SubscriptionCallbacks,
    listenerId: string
  ): Promise<string> {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log(`🔄 User not authenticated, skipping realtime for ${tableName}`);
        return '';
      }

      this.userId = user.id;

      // Get or create subscription
      let subscription = this.subscriptions.get(tableName);

      if (!subscription) {
        // Create new subscription
        subscription = await this.createSubscription(tableName, user.id);
        this.subscriptions.set(tableName, subscription);
      }

      // Add listener
      subscription.listeners.set(listenerId, callbacks);
      console.log(`✅ Listener ${listenerId} added to ${tableName} (total: ${subscription.listeners.size})`);

      return listenerId;
    } catch (error) {
      console.error(`❌ Error subscribing to ${tableName}:`, error);
      return '';
    }
  }

  /**
   * Unsubscribe a specific listener from a table
   */
  async unsubscribe(tableName: TableName, listenerId: string): Promise<void> {
    const subscription = this.subscriptions.get(tableName);
    if (!subscription) return;

    subscription.listeners.delete(listenerId);
    console.log(`🧹 Listener ${listenerId} removed from ${tableName} (remaining: ${subscription.listeners.size})`);

    // If no more listeners, cleanup the subscription
    if (subscription.listeners.size === 0) {
      await this.cleanupSubscription(tableName);
    }
  }

  /**
   * Create a new subscription for a table
   */
  private async createSubscription(tableName: TableName, userId: string): Promise<Subscription> {
    const channel = supabase
      .channel(`realtime_${tableName}_singleton`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => this.handleEvent(tableName, 'INSERT', payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => this.handleEvent(tableName, 'UPDATE', payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: tableName,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => this.handleEvent(tableName, 'DELETE', payload)
      );

    const subscription: Subscription = {
      channel,
      listeners: new Map(),
      retryCount: 0,
      isConnecting: true,
    };

    // Subscribe with retry logic
    await this.subscribeWithRetry(tableName, subscription);

    return subscription;
  }

  /**
   * Subscribe with exponential backoff retry
   */
  private async subscribeWithRetry(tableName: TableName, subscription: Subscription): Promise<void> {
    return new Promise((resolve, reject) => {
      subscription.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscribed to ${tableName} (singleton)`);
          subscription.isConnecting = false;
          subscription.retryCount = 0;
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`❌ Failed to subscribe to ${tableName}: ${status}`);
          subscription.isConnecting = false;
          
          // Retry with exponential backoff
          if (subscription.retryCount < this.maxRetries) {
            subscription.retryCount++;
            const delay = this.baseRetryDelay * Math.pow(2, subscription.retryCount - 1);
            console.log(`🔄 Retrying ${tableName} in ${delay}ms (attempt ${subscription.retryCount}/${this.maxRetries})`);
            
            subscription.retryTimeout = setTimeout(async () => {
              await this.reconnect(tableName);
            }, delay);
          } else {
            console.error(`❌ Max retries reached for ${tableName}`);
            reject(new Error(`Failed to subscribe to ${tableName} after ${this.maxRetries} attempts`));
          }
        } else if (status === 'CLOSED') {
          console.log(`🔌 Connection closed for ${tableName}`);
          subscription.isConnecting = false;
        }
      });
    });
  }

  /**
   * Reconnect to a table subscription
   */
  private async reconnect(tableName: TableName): Promise<void> {
    const subscription = this.subscriptions.get(tableName);
    if (!subscription || !this.userId) return;

    // Remove old channel
    await supabase.removeChannel(subscription.channel);

    // Create new subscription
    const newSubscription = await this.createSubscription(tableName, this.userId);
    
    // Transfer listeners
    newSubscription.listeners = subscription.listeners;
    
    // Update subscription
    this.subscriptions.set(tableName, newSubscription);
  }

  /**
   * Handle events and notify all listeners
   */
  private handleEvent(tableName: TableName, event: 'INSERT' | 'UPDATE' | 'DELETE', payload: any): void {
    const subscription = this.subscriptions.get(tableName);
    if (!subscription) return;

    console.log(`🔄 ${event} on ${tableName} (notifying ${subscription.listeners.size} listeners)`);

    // Notify all listeners
    subscription.listeners.forEach((callbacks, listenerId) => {
      try {
        switch (event) {
          case 'INSERT':
            callbacks.onInsert?.(payload);
            break;
          case 'UPDATE':
            callbacks.onUpdate?.(payload);
            break;
          case 'DELETE':
            callbacks.onDelete?.(payload);
            break;
        }
      } catch (error) {
        console.error(`❌ Error in listener ${listenerId} for ${tableName}:`, error);
      }
    });
  }

  /**
   * Cleanup a subscription
   */
  private async cleanupSubscription(tableName: TableName): Promise<void> {
    const subscription = this.subscriptions.get(tableName);
    if (!subscription) return;

    console.log(`🧹 Cleaning up subscription for ${tableName}`);

    // Clear retry timeout
    if (subscription.retryTimeout) {
      clearTimeout(subscription.retryTimeout);
    }

    // Remove channel
    await supabase.removeChannel(subscription.channel);

    // Remove from map
    this.subscriptions.delete(tableName);
  }

  /**
   * Cleanup all subscriptions (for logout or cleanup)
   */
  async cleanupAll(): Promise<void> {
    console.log('🧹 Cleaning up all realtime subscriptions');
    
    const cleanupPromises = Array.from(this.subscriptions.keys()).map(tableName =>
      this.cleanupSubscription(tableName)
    );
    
    await Promise.all(cleanupPromises);
    this.userId = null;
  }
}

export const realtimeSubscriptionManager = RealtimeSubscriptionManager.getInstance();
