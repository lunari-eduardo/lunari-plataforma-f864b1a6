import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AppModule = 'studio' | 'gallery';

interface ModuleContextData {
  activeModule: AppModule;
  setActiveModule: (module: AppModule) => void;
}

const ModuleContext = createContext<ModuleContextData | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModule] = useState<AppModule>('studio');

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useActiveModule() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useActiveModule must be used within a ModuleProvider');
  }
  return context;
}
