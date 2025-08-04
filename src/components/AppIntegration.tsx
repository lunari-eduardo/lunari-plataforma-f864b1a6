import { useState, useEffect } from 'react';
import { useIntegration } from '@/hooks/useIntegration';

// Component to safely initialize integration hooks after AppProvider is ready
export function AppIntegration() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Delay to ensure AppProvider is fully initialized
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);
  
  // Always call the hook (React hooks rule), but pass ready state
  useIntegration(isReady);
  
  return null;
}