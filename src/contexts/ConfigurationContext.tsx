/**
 * Configuration Context - Cache global de configurações
 * Carrega dados uma única vez e compartilha com toda a aplicação
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';

type ConfigurationContextType = ReturnType<typeof useRealtimeConfiguration>;

const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

interface ConfigurationProviderProps {
  children: ReactNode;
}

export function ConfigurationProvider({ children }: ConfigurationProviderProps) {
  const configuration = useRealtimeConfiguration();

  return (
    <ConfigurationContext.Provider value={configuration}>
      {children}
    </ConfigurationContext.Provider>
  );
}

export function useConfigurationContext() {
  const context = useContext(ConfigurationContext);
  if (context === undefined) {
    throw new Error('useConfigurationContext must be used within a ConfigurationProvider');
  }
  return context;
}
