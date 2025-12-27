/**
 * Context para compartilhar estado único de Pricing entre componentes
 * Evita múltiplas instâncias do hook e race conditions
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { usePricingSupabaseData } from '@/hooks/pricing/usePricingSupabaseData';

// Tipo do retorno do hook
type PricingContextType = ReturnType<typeof usePricingSupabaseData>;

// Context com valor null como padrão
const PricingContext = createContext<PricingContextType | null>(null);

interface PricingProviderProps {
  children: ReactNode;
}

/**
 * Provider que encapsula o hook usePricingSupabaseData
 * Garante uma única instância compartilhada entre todos os componentes filhos
 */
export function PricingProvider({ children }: PricingProviderProps) {
  const pricingData = usePricingSupabaseData();
  
  return (
    <PricingContext.Provider value={pricingData}>
      {children}
    </PricingContext.Provider>
  );
}

/**
 * Hook para consumir o contexto de pricing
 * Deve ser usado dentro de um PricingProvider
 */
export function usePricing(): PricingContextType {
  const context = useContext(PricingContext);
  
  if (!context) {
    throw new Error(
      'usePricing deve ser usado dentro de um PricingProvider. ' +
      'Certifique-se de que o componente está dentro da árvore do PricingProvider.'
    );
  }
  
  return context;
}

export { PricingContext };
