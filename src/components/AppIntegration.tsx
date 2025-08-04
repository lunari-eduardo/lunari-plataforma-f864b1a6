import { useEffect } from 'react';
import { useIntegration } from '@/hooks/useIntegration';

// Component to safely initialize integration hooks after AppProvider is ready
export function AppIntegration() {
  // Sempre chamar o hook - sem estado condicional
  useIntegration(true);
  
  return null;
}