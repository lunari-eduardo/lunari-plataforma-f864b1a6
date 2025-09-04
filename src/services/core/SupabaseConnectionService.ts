/**
 * Supabase Connection Service
 * Centralizes Supabase connection detection and validation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConnectionConfig {
  url?: string;
  anonKey?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  hasCredentials: boolean;
  isValid: boolean;
  error?: string;
}

export class SupabaseConnectionService {
  private static instance: SupabaseConnectionService;
  private supabaseClient: SupabaseClient | null = null;
  private connectionStatus: ConnectionStatus | null = null;

  private constructor() {}

  static getInstance(): SupabaseConnectionService {
    if (!SupabaseConnectionService.instance) {
      SupabaseConnectionService.instance = new SupabaseConnectionService();
    }
    return SupabaseConnectionService.instance;
  }

  /**
   * Check if Supabase credentials are available
   */
  hasCredentials(): boolean {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(url && anonKey);
  }

  /**
   * Get Supabase credentials from environment
   */
  getCredentials(): SupabaseConnectionConfig {
    return {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
    };
  }

  /**
   * Initialize Supabase client
   */
  initializeClient(): SupabaseClient | null {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }

    const credentials = this.getCredentials();
    
    if (!credentials.url || !credentials.anonKey) {
      console.warn('🔌 [SupabaseConnection] Missing Supabase credentials');
      return null;
    }

    try {
      this.supabaseClient = createClient(credentials.url, credentials.anonKey);
      console.log('🔌 [SupabaseConnection] Client initialized successfully');
      return this.supabaseClient;
    } catch (error) {
      console.error('🔌 [SupabaseConnection] Failed to initialize client:', error);
      return null;
    }
  }

  /**
   * Get Supabase client (creates if doesn't exist)
   */
  getClient(): SupabaseClient | null {
    return this.supabaseClient || this.initializeClient();
  }

  /**
   * Test connection to Supabase
   */
  async testConnection(): Promise<ConnectionStatus> {
    if (this.connectionStatus) {
      return this.connectionStatus;
    }

    const status: ConnectionStatus = {
      isConnected: false,
      hasCredentials: this.hasCredentials(),
      isValid: false
    };

    if (!status.hasCredentials) {
      status.error = 'Missing Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)';
      this.connectionStatus = status;
      return status;
    }

    const client = this.getClient();
    if (!client) {
      status.error = 'Failed to initialize Supabase client';
      this.connectionStatus = status;
      return status;
    }

    try {
      // Test basic connection with a simple query
      const { data, error } = await client.from('_lovable_connection_test').select('count').limit(1);
      
      if (error && !error.message.includes('relation "_lovable_connection_test" does not exist')) {
        status.error = `Connection test failed: ${error.message}`;
      } else {
        status.isConnected = true;
        status.isValid = true;
        console.log('🔌 [SupabaseConnection] Connection test successful');
      }
    } catch (error) {
      status.error = `Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    this.connectionStatus = status;
    return status;
  }

  /**
   * Check if Supabase is ready to use
   */
  async isReady(): Promise<boolean> {
    const status = await this.testConnection();
    return status.isConnected && status.isValid;
  }

  /**
   * Reset connection status (force recheck)
   */
  resetConnectionStatus(): void {
    this.connectionStatus = null;
  }

  /**
   * Get connection info for debugging
   */
  getConnectionInfo(): { hasCredentials: boolean; clientInitialized: boolean } {
    return {
      hasCredentials: this.hasCredentials(),
      clientInitialized: !!this.supabaseClient
    };
  }
}

// Export singleton instance
export const supabaseConnection = SupabaseConnectionService.getInstance();