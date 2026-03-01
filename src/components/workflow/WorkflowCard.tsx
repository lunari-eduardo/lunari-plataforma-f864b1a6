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
        // Base styles
        "rounded-2xl transition-all duration-200 ease-in-out",
        // Gradient background - light mode (neutral white/gray)
        "bg-gradient-to-br from-white via-gray-50/50 to-stone-50/30",
        // Gradient background - dark mode (warm grays, no blue)
        "dark:from-[#1a1a1a] dark:via-[#1f1f1f] dark:to-[#1a1a1a]",
        // Minimal base shadow
        "shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.2)]",
        // Width: 70% no desktop, 100% no mobile
        "w-full lg:w-[70%]",
        "ml-0",
        // Hover state - adds shadow
        "hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)]",
        // Expanded state
        isExpanded && [
          "shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
          "from-white via-gray-50/70 to-stone-50/40",
          "dark:from-[#1c1c1c] dark:via-[#222] dark:to-[#1c1c1c]"
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
