import React, { useState } from "react";
import { WorkflowCardCollapsed } from "./WorkflowCardCollapsed";
import { WorkflowCardExpanded } from "./WorkflowCardExpanded";
import type { SessionData } from "@/types/workflow";
import type { DeleteAction } from "./WorkflowDeleteConfirmModal";
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
  onDeleteSession?: (id: string, sessionTitle: string, paymentCount: number, action: DeleteAction) => void;
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
  // `modalAberto` (Gerenciar Produtos) é hoisted para que o chip do colapsado
  // e o botão "Gerenciar" do bloco Produtos do expandido abram a MESMA
  // instância hospedada em `CardCollapsedModals`.
  const [modalAberto, setModalAberto] = useState(false);

  return (
    <div
      data-card-id={session.id}
      className={cn(
        "group relative rounded-xl transition-all duration-200 ease-in-out w-full",
        !isExpanded && [
          "bg-transparent",
          "border border-transparent",
          "hover:bg-card/55 hover:backdrop-blur-xl hover:backdrop-saturate-[1.8]",
          "hover:border-white/50 dark:hover:border-white/10",
          "hover:shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]",
          "dark:hover:bg-white/[0.06] dark:hover:backdrop-blur-xl dark:hover:backdrop-saturate-[1.6]",
          "dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
        ],
        isExpanded && [
          "bg-card/50 backdrop-blur-xl backdrop-saturate-[1.8]",
          "dark:bg-card/[0.06] dark:backdrop-blur-xl dark:backdrop-saturate-[1.6]",
          "border border-white/50 dark:border-white/10",
          "shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]",
          "dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
          "hover:bg-card/60 dark:hover:bg-white/[0.08]",
        ],
      )}
    >
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
        modalAberto={modalAberto}
        setModalAberto={setModalAberto}
      />

      {isExpanded && (
        <div className="mx-4 md:mx-6 border-b border-border/25 dark:border-border/20" />
      )}

      {isExpanded && (
        <WorkflowCardExpanded
          session={session}
          packageOptions={packageOptions}
          productOptions={productOptions}
          statusOptions={statusOptions}
          onFieldUpdate={onFieldUpdate}
          onStatusChange={onStatusChange}
          onOpenProdutos={() => setModalAberto(true)}
        />
      )}
    </div>
  );
}
