import React, { useState, useCallback, useRef, useEffect } from "react";
import { WorkflowCard } from "./WorkflowCard";
import type { SessionData } from "@/types/workflow";

interface WorkflowCardListProps {
  sessions: SessionData[];
  statusOptions: string[];
  categoryOptions: any[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onEditSession: (id: string) => void;
  onAddPayment: (id: string) => void;
  onDeleteSession?: (id: string, sessionTitle: string, paymentCount: number) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
}

export function WorkflowCardList({
  sessions,
  statusOptions,
  categoryOptions,
  packageOptions,
  productOptions,
  onStatusChange,
  onEditSession,
  onAddPayment,
  onDeleteSession,
  onFieldUpdate,
}: WorkflowCardListProps) {
  // Apenas 1 card pode ficar expandido por vez (modo solitário)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggleExpand = useCallback((cardId: string) => {
    setExpandedCardId(prev => prev === cardId ? null : cardId);
  }, []);

  // Scroll para o card expandido quando mudar
  useEffect(() => {
    if (expandedCardId && containerRef.current) {
      const cardElement = containerRef.current.querySelector(`[data-card-id="${expandedCardId}"]`);
      if (cardElement) {
        setTimeout(() => {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
  }, [expandedCardId]);

  return (
    <div 
      ref={containerRef}
      className="h-full w-full overflow-auto p-4 md:p-6 bg-gradient-to-b from-gray-100/80 via-gray-50 to-gray-100/60 dark:bg-gradient-to-b dark:from-[#0e0e0e] dark:via-[#131313] dark:to-[#0e0e0e]"
      style={{ 
        height: 'calc(100vh - 280px)'
      }}
    >
      <div className="flex flex-col gap-3 md:gap-4 overflow-x-auto">
        {sessions.map(session => (
          <div key={session.id} className="w-full lg:min-w-0 min-w-[900px] flex-shrink-0">
          <WorkflowCard
            session={session}
            isExpanded={expandedCardId === session.id}
            onToggleExpand={() => handleToggleExpand(session.id)}
            statusOptions={statusOptions}
            packageOptions={packageOptions}
            productOptions={productOptions}
            onStatusChange={onStatusChange}
            onFieldUpdate={onFieldUpdate}
            onDeleteSession={onDeleteSession}
          />
          </div>
        ))}
        
        {sessions.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <p>Nenhuma sessão encontrada para este mês.</p>
          </div>
        )}
      </div>
    </div>
  );
}
