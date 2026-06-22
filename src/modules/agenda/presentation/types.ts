/**
 * Tipos de UI da Agenda (shape consumido pelos componentes React).
 *
 * Diferente de `domain/types.ts` (datas como `yyyy-MM-dd`), a camada de
 * apresentação ainda trabalha com `Date` JS porque é o que as views legadas
 * (`DailyView`, `WeeklyView`, etc.) esperam. A normalização ISO ↔ Date
 * acontece nos adapters / hooks.
 *
 * Onda 6 (passo 1): centralizamos os tipos aqui e o hook legado
 * `@/hooks/useAgenda` passa a reexportá-los, para que todos os imports
 * de tipo possam apontar para `@/modules/agenda/presentation`.
 */

export type AppointmentStatus = "confirmado" | "a confirmar";

export interface ProdutoIncluido {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: "incluso" | "manual";
}

export interface Appointment {
  id: string;
  /** ID único universal: orçamento → agendamento → workflow. */
  sessionId?: string;
  title: string;
  date: Date;
  time: string;
  type: string;
  client: string;
  status: AppointmentStatus;
  description?: string;
  packageId?: string;
  produtosIncluidos?: ProdutoIncluido[];
  paidAmount?: number;
  email?: string;
  whatsapp?: string;
  orcamentoId?: string;
  origem?: "agenda" | "orcamento";
  /** Relaciona o appointment a um cliente do CRM. */
  clienteId?: string;
}
