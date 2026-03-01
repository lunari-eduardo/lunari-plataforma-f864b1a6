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
      className={cn(
        // Base styles - premium rounded
        "rounded-2xl transition-all duration-200 ease-in-out",
        // Gradient background - light mode
        "bg-gradient-to-br from-white via-orange-50/30 to-amber-50/20",
        // Gradient background - dark mode  
        "dark:from-gray-900 dark:via-gray-800/80 dark:to-gray-900",
        // Left accent border
        "border-l-[3px] border-l-primary/40",
        // Sombra premium
        "shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]",
        // Width: 70% no desktop, 100% no mobile
        "w-full lg:w-[70%]",
        // Alinhado à esquerda
        "ml-0",
        // Hover state
        "hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)]",
        "hover:border-l-primary/60",
        // Expanded state - stronger gradient
        isExpanded && [
          "shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
          "border-l-primary/80",
          "from-white via-orange-50/50 to-amber-50/30",
          "dark:from-gray-900 dark:via-gray-800 dark:to-gray-850"
        ]
      )}
    >
      {/* Collapsed row - sempre visível (clicável para expandir) */}
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
      
      {/* Separador visual elegante quando expandido */}
      {isExpanded && (
        <div className="mx-4 md:mx-6 border-b border-primary/20 dark:border-primary/30" />
      )}
      
      {/* Expanded content - só visível quando expandido */}
      {isExpanded && (
        <WorkflowCardExpanded
          session={session}
          packageOptions={packageOptions}
          productOptions={productOptions}
          statusOptions={statusOptions}
          onFieldUpdate={onFieldUpdate}
          onStatusChange={onStatusChange}
        />
      )}
    </div>
  );
}
