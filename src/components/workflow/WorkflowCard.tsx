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
        // Base styles — glassmorphism
        "rounded-2xl transition-all duration-200 ease-in-out w-full",
        // Frosted glass background
        "bg-white/40 backdrop-blur-xl backdrop-saturate-[1.8]",
        // Dark mode glass
        "dark:bg-white/[0.04] dark:backdrop-blur-xl dark:backdrop-saturate-[1.6]",
        // Glass border — light edge
        "border border-white/50 dark:border-white/10",
        // Minimal base shadow + inner glow
        "shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]",
        "dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]",
        // Hover — subtle gray only, no movement
        !isExpanded && [
          "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        ],
        // Expanded — moderate glass elevation, subtle hover
        isExpanded && [
          "bg-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]",
          "dark:bg-white/[0.06] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
          "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
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
