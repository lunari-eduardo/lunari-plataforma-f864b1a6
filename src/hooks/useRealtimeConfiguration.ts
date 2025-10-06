/**
 * Hook wrapper for Configuration Context
 * 
 * This hook provides backward compatibility by wrapping the ConfigurationContext.
 * All components using this hook will share the same configuration instance,
 * preventing duplicate subscriptions and improving performance.
 * 
 * @deprecated Direct usage - prefer useConfigurationContext() for new code
 */
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
import type { ConfigurationState, ConfigurationActions } from '@/types/configuration';

/**
 * Provides access to the centralized configuration context.
 * All components using this hook share the same configuration instance.
 * 
 * @returns Configuration state and operations
 * @throws Error if used outside ConfigurationProvider
 */
export function useRealtimeConfiguration(): ConfigurationState & ConfigurationActions {
  const context = useConfigurationContext();
  
  if (!context) {
    throw new Error('useRealtimeConfiguration must be used within ConfigurationProvider');
  }

  return context;
}
