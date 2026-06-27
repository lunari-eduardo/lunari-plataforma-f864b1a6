/**
 * WorkflowTable — shim fino sobre WorkflowCardList.
 *
 * Histórico: este arquivo tinha 825 linhas com uma tabela HTML completa
 * (inputs editáveis, redimensionamento de colunas, scroll horizontal contínuo,
 * cálculo client-side de total/restante, ExtraPhotoQtyInput local, etc.) —
 * tudo morto desde a migração para o layout de cards. O `return` real sempre
 * foi apenas `<WorkflowCardList ... />`, então toda a lógica acima nunca
 * era executada nem renderizada.
 *
 * Onda 5b: removida a tabela legada. A interface pública (props) é mantida
 * para evitar churn nos callers — `visibleColumns`, `columnWidths`,
 * `onColumnWidthChange`, `onScrollChange`, `sortField`, `sortDirection`,
 * `onSort` continuam aceitos mas são ignorados (o layout de cards não usa
 * coluna nem scroll horizontal controlado pelo pai).
 */
import { WorkflowCardList } from "./WorkflowCardList";
import type { SessionData } from "@/types/workflow";
import type { DeleteAction } from "./WorkflowDeleteConfirmModal";

interface WorkflowTableProps {
  sessions: SessionData[];
  statusOptions: string[];
  categoryOptions: any[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onEditSession: (id: string) => void;
  onAddPayment: (id: string) => void;
  onDeleteSession?: (
    id: string,
    sessionTitle: string,
    paymentCount: number,
    action: DeleteAction,
  ) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;

  // Props legadas — aceitas para compatibilidade, não utilizadas no layout de cards.
  visibleColumns?: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  onColumnWidthChange?: (widths: Record<string, number>) => void;
  onScrollChange?: (scrollLeft: number) => void;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
}

export function WorkflowTable({
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
}: WorkflowTableProps) {
  return (
    <WorkflowCardList
      sessions={sessions}
      statusOptions={statusOptions}
      categoryOptions={categoryOptions}
      packageOptions={packageOptions}
      productOptions={productOptions}
      onStatusChange={onStatusChange}
      onEditSession={onEditSession}
      onAddPayment={onAddPayment}
      onDeleteSession={onDeleteSession}
      onFieldUpdate={onFieldUpdate}
    />
  );
}
