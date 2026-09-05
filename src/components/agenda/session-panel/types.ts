import type { Appointment, AppointmentStatus } from "@/modules/agenda/presentation";

export interface SessionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo edição quando presente; modo criação quando ausente. */
  appointment?: Appointment | null;
  initialDate?: Date;
  initialTime?: string;
  preselectedClienteId?: string;
  onSave: (data: any) => any | Promise<any>;
  /** Persistência silenciosa (não fecha o painel) antes de gerar cobrança. */
  onPersist?: (data: any) => void | Promise<void>;
  onDelete?: (id: string, action?: "preserve" | "refund" | "remove") => void;
}

export interface PanelFormState {
  date: Date;
  time: string;
  clienteId: string;
  clientName: string;
  status: AppointmentStatus;
  description: string;
  packageId: string;
  categoria: string;
  paidAmount: number;
}

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; dot: string; chip: string }
> = {
  "a confirmar": {
    label: "Pendente",
    dot: "bg-lunar-warning",
    chip: "bg-lunar-warning/15 text-lunar-warning border-lunar-warning/30",
  },
  confirmado: {
    label: "Confirmado",
    dot: "bg-lunar-success",
    chip: "bg-lunar-success/15 text-lunar-success border-lunar-success/30",
  },
};
