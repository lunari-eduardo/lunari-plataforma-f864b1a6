import React from "react";
import { WorkflowCardCollapsed } from "./WorkflowCardCollapsed";
import { WorkflowCardExpanded } from "./WorkflowCardExpanded";
import type { SessionData } from "@/types/workflow";
import { cn } from "@/lib/utils";

interface WorkflowCardProps {
  session: SessionData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  statusOptions: string[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  onDeleteSession?: (id: string, sessionTitle: string, paymentCount: number) => void;
}

export function WorkflowCard({
  session,
  isExpanded,
  onToggleExpand,
  statusOptions,
  packageOptions,
  productOptions,
  onStatusChange,
  onFieldUpdate,
  onDeleteSession,
}: WorkflowCardProps) {
  return (
    <div
      data-card-id={session.id}
      onClick={onToggleExpand}
      className={cn(
        // Base styles - mais arredondado e premium
        "rounded-2xl transition-all duration-200 ease-in-out cursor-pointer",
        // Background sólido
        "bg-[#fdfdfd]",
        // Sombra mais presente
        "shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        // Width: 70% no desktop, 100% no mobile
        "w-full lg:w-[70%]",
        // Alinhado à esquerda
        "ml-0",
        // Hover state - sombra mais forte
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
        // Expanded state - destaque premium
        isExpanded && "shadow-[0_6px_16px_rgba(0,0,0,0.1)] ring-1 ring-primary/5"
      )}
    >
      {/* Collapsed row - sempre visível */}
      <WorkflowCardCollapsed
        session={session}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        statusOptions={statusOptions}
        packageOptions={packageOptions}
        productOptions={productOptions}
        onStatusChange={onStatusChange}
        onFieldUpdate={onFieldUpdate}
        onDeleteSession={onDeleteSession}
      />
      
      {/* Expanded content - só visível quando expandido */}
      {isExpanded && (
        <WorkflowCardExpanded
          session={session}
          packageOptions={packageOptions}
          productOptions={productOptions}
          onFieldUpdate={onFieldUpdate}
        />
      )}
    </div>
  );
}
