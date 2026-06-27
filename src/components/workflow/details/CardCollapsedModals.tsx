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

            onFieldUpdate(session.id, "produtosList", produtosCorrigidos);

            const produtosManuais = produtosCorrigidos.filter((p) => p.tipo === "manual");
            const valorTotalManuais = produtosManuais.reduce(
              (total, p) => total + p.valorUnitario * p.quantidade,
              0,
            );

            if (produtosManuais.length > 0) {
              const nomesProdutos = produtosManuais.map((p) => p.nome).join(", ");
              const nomesInclusos = produtosCorrigidos
                .filter((p) => p.tipo === "incluso")
                .map((p) => p.nome);
              const nomeCompleto =
                nomesInclusos.length > 0
                  ? `${nomesProdutos} + ${nomesInclusos.length} incluso(s)`
                  : nomesProdutos;
              onFieldUpdate(session.id, "produto", nomeCompleto);
              onFieldUpdate(
                session.id,
                "qtdProduto",
                produtosManuais.reduce((total, p) => total + p.quantidade, 0),
              );
            } else if (produtosCorrigidos.filter((p) => p.tipo === "incluso").length > 0) {
              const produtosInclusos = produtosCorrigidos.filter((p) => p.tipo === "incluso");
              onFieldUpdate(session.id, "produto", `${produtosInclusos.length} produto(s) incluso(s)`);
              onFieldUpdate(session.id, "qtdProduto", 0);
            } else {
              onFieldUpdate(session.id, "produto", "");
              onFieldUpdate(session.id, "qtdProduto", 0);
            }

            await onFieldUpdate(
              session.id,
              "valorTotalProduto",
              formatCurrency(valorTotalManuais),
              true,
            );
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
                detail: { sessionId: session.sessionId || session.id },
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
