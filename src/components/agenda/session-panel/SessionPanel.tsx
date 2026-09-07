/**
 * SessionPanel — painel lateral único de gerenciamento da sessão da Agenda.
 *
 * Substitui `AppointmentForm` (nova sessão) e `AppointmentDetails` (edição).
 * Os três estados — nova, pendente e confirmada — usam exatamente o mesmo
 * layout, a mesma ordem de seções e os mesmos componentes.
 *
 * Ordem fixa: Cliente → Sessão → Financeiro → Cobrança → Informações → Status.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, History } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ClientEditModal } from "../ClientEditModal";
import { AppointmentDeleteConfirmModal } from "../AppointmentDeleteConfirmModal";
import { SlotConflictDialog } from "../SlotConflictDialog";
import { ChargeModal } from "@/components/cobranca/ChargeModal";
import { SendBriefingModal } from "@/components/formularios/SendBriefingModal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SessionTimeline } from "./SessionTimeline";

// Subcomponentes e hooks modulares
import { useSessionPanelForm } from "./hooks/useSessionPanelForm";
import { SessionPanelHeader } from "./sections/SessionPanelHeader";
import { ClientSection } from "./sections/ClientSection";
import { SessionDetailsSection } from "./sections/SessionDetailsSection";
import { FinancialSection } from "./sections/FinancialSection";
import { NotesSection } from "./sections/NotesSection";
import { StatusSection } from "./sections/StatusSection";
import { SessionPanelFooter } from "./sections/SessionPanelFooter";
import type { SessionPanelProps, PanelFormState } from "./types";
import { STATUS_META } from "./types";

export type { SessionPanelProps, PanelFormState };
export { STATUS_META };

export default function SessionPanel({
  open,
  onOpenChange,
  appointment = null,
  initialDate,
  initialTime,
  preselectedClienteId,
  onSave,
  onPersist,
  onDelete,
}: SessionPanelProps) {
  const {
    isEdit,
    pacotes,
    categorias,
    clientes,
    dialogProps,
    workflowInfo,
    showClientEdit,
    setShowClientEdit,
    showDelete,
    setShowDelete,
    showCharge,
    setShowCharge,
    showBriefing,
    setShowBriefing,
    newClientMode,
    setNewClientMode,
    newClient,
    setNewClient,
    saving,
    cobrarAoSalvar,
    chargeSessionId,
    showHistory,
    setShowHistory,
    form,
    setForm,
    dateInput,
    setDateInput,
    timeInput,
    setTimeInput,
    valorPacote,
    cliente,
    clientDisplayName,
    handleCobrarAoSalvarChange,
    paidInput,
    confirmDialogState,
    handleConfirmDialog,
    handleCancelDialog,
    handleCloseDialog,
    handleCancelCharge,
    pagoCobrancas,
    pendenteCobrancas,
    totalPagoCobrancas,
    isConfirmedWithDeposit,
    cobrancaPendente,
    cobrancaPendenteLink,
    cobranca,
    cobrancaLink,
    handlePackageSelect,
    commitDate,
    commitTime,
    handleSave,
    handleGerarCobranca,
    statusMeta,
    contextLine,
    overlayOpen,
  } = useSessionPanelForm({
    open,
    appointment,
    initialDate,
    initialTime,
    preselectedClienteId,
    onSave,
    onPersist,
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            "w-full sm:max-w-[520px] p-0 gap-0 flex flex-col",
            "h-dvh max-h-dvh bg-background backdrop-blur-none",
            overlayOpen && "opacity-40 blur-[2px] pointer-events-none",
          )}
        >
          {/* ============================ CABEÇALHO FIXO ============================ */}
          <SessionPanelHeader
            isEdit={isEdit}
            statusMeta={statusMeta}
            contextLine={contextLine}
            dateInput={dateInput}
            setDateInput={setDateInput}
            commitDate={commitDate}
            timeInput={timeInput}
            setTimeInput={setTimeInput}
            commitTime={commitTime}
          />

          {/* =========================== CONTEÚDO ROLÁVEL =========================== */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* 1. Cliente */}
            <ClientSection
              form={form}
              setForm={setForm}
              clientDisplayName={clientDisplayName}
              cliente={cliente}
              newClientMode={newClientMode}
              setNewClientMode={setNewClientMode}
              newClient={newClient}
              setNewClient={setNewClient}
              clientes={clientes}
              setShowClientEdit={setShowClientEdit}
            />

            {/* 2. Sessão */}
            <SessionDetailsSection
              form={form}
              setForm={setForm}
              categorias={categorias}
              handlePackageSelect={handlePackageSelect}
            />

            {/* 3. Financeiro */}
            <FinancialSection
              isEdit={isEdit}
              form={form}
              isConfirmedWithDeposit={isConfirmedWithDeposit}
              handleGerarCobranca={handleGerarCobranca}
              cobranca={cobranca}
              cobrarAoSalvar={cobrarAoSalvar}
              paidInput={paidInput}
              pagoCobrancas={pagoCobrancas}
              totalPagoCobrancas={totalPagoCobrancas}
              pendenteCobrancas={pendenteCobrancas}
              cobrancaPendente={cobrancaPendente}
              cobrancaPendenteLink={cobrancaPendenteLink}
              cobrancaLink={cobrancaLink}
              handleCobrarAoSalvarChange={handleCobrarAoSalvarChange}
              handleCancelCharge={handleCancelCharge}
              valorPacote={valorPacote}
            />

            {/* 4. Descrição / Briefing */}
            <NotesSection
              form={form}
              setForm={setForm}
              isEdit={isEdit}
              setShowBriefing={setShowBriefing}
            />

            {/* 5. Status da sessão */}
            <StatusSection form={form} setForm={setForm} isEdit={isEdit} />

            {/* 6. Histórico da sessão (colapsável) */}
            {isEdit && appointment?.sessionId && (
              <div className="rounded-xl border border-border/60 bg-card/80">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-sm font-medium text-foreground"
                  aria-expanded={showHistory}
                >
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4 text-accent-gold" />
                    Histórico da sessão
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      showHistory && "rotate-180",
                    )}
                  />
                </button>
                {showHistory && (
                  <div className="border-t border-border/60 px-3.5 py-3">
                    <SessionTimeline sessionId={appointment.sessionId} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================= RODAPÉ FIXO ============================== */}
          <SessionPanelFooter
            isEdit={isEdit}
            hasDeleteHandler={!!onDelete}
            setShowDelete={setShowDelete}
            onClose={() => onOpenChange(false)}
            handleSave={handleSave}
            saving={saving}
          />
        </SheetContent>
      </Sheet>

      {/* ------------------------------- Modais ---------------------------------- */}
      {form.clienteId && (
        <ClientEditModal
          open={showClientEdit}
          onOpenChange={setShowClientEdit}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          onSuccess={(novoNome) => {
            if (novoNome)
              setForm((prev) => ({ ...prev, clientName: novoNome }));
          }}
        />
      )}

      {isEdit && onDelete && (
        <AppointmentDeleteConfirmModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={(action) => onDelete(appointment!.id, action)}
          appointmentData={{
            id: appointment!.id,
            sessionId: appointment!.sessionId,
            title: appointment!.title,
            clientName: appointment!.client,
            date: format(appointment!.date, "dd/MM/yyyy", { locale: ptBR }),
            hasWorkflowSession: workflowInfo.hasSession,
            hasPayments: workflowInfo.hasPayments,
          }}
        />
      )}

      {showCharge && form.clienteId && (
        <ChargeModal
          isOpen={showCharge}
          onClose={() => {
            setShowCharge(false);
          }}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          clienteWhatsapp={cliente?.telefone}
          sessionId={chargeSessionId || appointment?.sessionId}
          valorSugerido={valorPacote > 0 ? valorPacote : form.paidAmount || 0}
          valorSinal={
            form.paidAmount > 0 && form.paidAmount < valorPacote
              ? form.paidAmount
              : undefined
          }
        />
      )}

      {showBriefing && form.clienteId && (
        <SendBriefingModal
          open={showBriefing}
          onOpenChange={setShowBriefing}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          clienteTelefone={cliente?.telefone}
          sessionId={appointment?.sessionId}
        />
      )}

      <SlotConflictDialog {...dialogProps} />

      <ConfirmDialog
        state={confirmDialogState}
        onConfirm={handleConfirmDialog}
        onCancel={handleCancelDialog}
        onClose={handleCloseDialog}
      />
    </>
  );
}
