/**
 * Environment Variables Type Definitions
 * Centralized types for all environment variables used in the application
 */

export interface EnvironmentVariables {
  // Supabase Configuration
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  
  // Feature Flags
  VITE_USE_REFACTORED_SALES?: string;
  VITE_DEBUG_SALES?: string;
  VITE_SALES_DATA_SOURCE?: 'localStorage' | 'supabase';
  
  // Development
  NODE_ENV?: 'development' | 'production' | 'test';
  DEV?: boolean;
  PROD?: boolean;
  
  // Build Info
  VITE_APP_VERSION?: string;
}

/**
 * Type-safe environment variable getter
 */
export function getEnvVar(key: keyof EnvironmentVariables): string | undefined {
  return import.meta.env[key] as string | undefined;
}

/**
 * Get environment variable with default value
 */
export function getEnvVarWithDefault(key: keyof EnvironmentVariables, defaultValue: string): string {
  return getEnvVar(key) ?? defaultValue;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV || import.meta.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD || import.meta.env.NODE_ENV === 'production';
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(requiredVars: (keyof EnvironmentVariables)[]): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!getEnvVar(varName)) {
      missing.push(varName);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  const { valid } = validateEnvironment(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
  return valid;
}

/**
 * Get feature flag value as boolean
 */
export function getFeatureFlag(flagName: keyof EnvironmentVariables): boolean {
  return getEnvVar(flagName) === 'true';
}

// Global type augmentation for better IDE support
declare global {
  interface ImportMetaEnv extends EnvironmentVariables {}
}