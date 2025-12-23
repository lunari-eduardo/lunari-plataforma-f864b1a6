import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ReactNode, createContext, useContext } from 'react';

interface SortableBlockContextValue {
  listeners: Record<string, any> | undefined;
  attributes: Record<string, any>;
}

const SortableBlockContext = createContext<SortableBlockContextValue | null>(null);

export function useDragHandle() {
  const context = useContext(SortableBlockContext);
  if (!context) {
    throw new Error('useDragHandle must be used within a SortableBlock');
  }
  return context;
}

interface SortableBlockProps {
  id: string;
  children: ReactNode;
}

export function SortableBlock({ id, children }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <SortableBlockContext.Provider value={{ listeners, attributes }}>
      <div ref={setNodeRef} style={style}>
        {children}
      </div>
    </SortableBlockContext.Provider>
  );
}
