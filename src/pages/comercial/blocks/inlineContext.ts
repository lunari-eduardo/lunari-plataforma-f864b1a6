import React, { createContext, useContext } from 'react';

// Handle de edição inline fornecido pelo VisualRenderer para cada bloco
export interface InlineEditHandle {
  editable: boolean;
  set: (path: string, value: any) => void;
}

export const InlineEditContext = createContext<InlineEditHandle | null>(null);

export function useInlineEdit(): InlineEditHandle | null {
  return useContext(InlineEditContext);
}
