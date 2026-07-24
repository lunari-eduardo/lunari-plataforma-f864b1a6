import React from "react";
import { GerenciarProdutosModal } from "../GerenciarProdutosModal";
import { WorkflowPaymentsModal } from "../WorkflowPaymentsModal";
import { GalleryUpgradeModal } from "../GalleryUpgradeModal";
import { WorkflowDeleteConfirmModal, type DeleteAction } from "../WorkflowDeleteConfirmModal";
import { formatToDayMonth } from "@/utils/dateUtils";
import type { SessionData } from "@/types/workflow";

interface Props {
  session: SessionData;
  productOptions: any[];
  // Gerenciar produtos
  modalAberto: boolean;
  setModalAberto: (v: boolean) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  formatCurrency: (v: any) => string;
  // Pagamentos
  workflowPaymentsOpen: boolean;
  setWorkflowPaymentsOpen: (v: boolean) => void;
  pendente: number;
  // Upgrade galeria
  galleryModalOpen: boolean;
  setGalleryModalOpen: (v: boolean) => void;
  // Excluir
  deleteModalOpen: boolean;
  setDeleteModalOpen: (v: boolean) => void;
  onDeleteSession?: (
    id: string,
    sessionTitle: string,
    paymentCount: number,
    action: DeleteAction,
  ) => void;
}

/**
 * Modais acionados a partir do card colapsado (Onda 5c).
 */
export function CardCollapsedModals({
  session,
  productOptions,
  modalAberto,
  setModalAberto,
  onFieldUpdate,
  formatCurrency,
  workflowPaymentsOpen,
  setWorkflowPaymentsOpen,
  pendente,
  galleryModalOpen,
  setGalleryModalOpen,
  deleteModalOpen,
  setDeleteModalOpen,
  onDeleteSession,
}: Props) {
  const valorPagoNum =
    parseFloat(String(session.valorPago || "0").replace(/[^\d,]/g, "").replace(",", ".")) || 0;

  return (
    <>
      {modalAberto && (
        <GerenciarProdutosModal
          open={modalAberto}
          onOpenChange={setModalAberto}
          sessionId={session.id}
          clienteName={session.nome}
          produtos={session.produtosList || []}
          productOptions={productOptions}
          onSave={async (novosProdutos) => {
            const produtosCorrigidos = novosProdutos.map((p) => ({
              ...p,
              valorUnitario: p.tipo === "incluso" ? 0 : p.valorUnitario,
            }));
            // Autosave: o modal chama `onSave` várias vezes (debounced) ao
            // longo da vida. Cada chamada é um replace completo de
            // `produtosList`; o reducer central em `useWorkflowSessionActions`
            // deriva `produto` / `qtdProduto` / `valorTotalProduto`.
            await onFieldUpdate(session.id, "produtosList", produtosCorrigidos);
          }}
        />
      )}

      {workflowPaymentsOpen && (
        <WorkflowPaymentsModal
          isOpen={workflowPaymentsOpen}
          onClose={() => {
            setWorkflowPaymentsOpen(false);
            window.dispatchEvent(
              new CustomEvent("payment-created", {
                detail: {
                  sessionId: session.sessionId ?? null,
                  sessionUuid: session.id,
                  source: "workflow-payments-modal",
                },
              }),
            );
          }}
          sessionData={session}
          valorTotalCalculado={pendente + valorPagoNum || 0}
          onPaymentUpdate={() => {
            /* DB trigger é fonte de verdade */
          }}
        />
      )}

      <GalleryUpgradeModal
        isOpen={galleryModalOpen}
        onClose={() => setGalleryModalOpen(false)}
      />

      <WorkflowDeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={(deleteAction) => {
          if (onDeleteSession) {
            const paymentCount = session.pagamentos?.length || 0;
            onDeleteSession(session.id, session.nome, paymentCount, deleteAction);
          }
        }}
        sessionData={{
          id: session.id,
          clientName: session.nome,
          date: formatToDayMonth(session.data),
          hasPayments: (session.pagamentos?.length || 0) > 0 || valorPagoNum > 0,
        }}
      />
    </>
  );
}
