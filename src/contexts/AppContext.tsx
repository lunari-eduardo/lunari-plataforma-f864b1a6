/**
 * Contexto Global da Aplicação (AppContext)
 *
 * Refatorado: Orquestrador raiz delegando para submódulos desacoplados (< 500 linhas):
 *  - app/useAppCrm.ts (templates, origens, clientes e pontes de categorias)
 *  - app/useAppAgenda.ts (agendamentos, disponibilidade e pré-seleção)
 *  - app/useAppWorkflow.ts (projetos, sessões, filtros e pagamentos rápidos)
 *  - app/useAppCreditCardsAndEngine.ts (cartões de crédito e motor financeiro)
 */

import React, { createContext, useContext, useMemo } from "react";
import { useConfigurationContext } from "@/contexts/ConfigurationContext";
import { useAuthUser } from "@/shared/capability";
import type {
  ProdutoWorkflow,
  RegrasPrecoFotoExtraCongeladas,
  WorkflowItem,
  WorkflowFilters,
  AppContextType,
} from "./app/types";
import { useAppCrm } from "./app/useAppCrm";
import { useAppAgenda } from "./app/useAppAgenda";
import { useAppWorkflow } from "./app/useAppWorkflow";
import { useAppCreditCardsAndEngine } from "./app/useAppCreditCardsAndEngine";

export type {
  ProdutoWorkflow,
  RegrasPrecoFotoExtraCongeladas,
  WorkflowItem,
  WorkflowFilters,
  AppContextType,
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Configuração global em tempo real
  const realtimeConfig = useConfigurationContext();
  const capabilityUser = useAuthUser();

  // Submódulos desacoplados
  const crm = useAppCrm(realtimeConfig);
  const agenda = useAppAgenda();
  const workflow = useAppWorkflow({
    pacotes: crm.pacotes,
    produtos: crm.produtos,
    capabilityUser,
  });
  const cards = useAppCreditCardsAndEngine();

  // Itens filtrados para o Workflow
  const filteredWorkflowItems = useMemo(() => {
    return workflow.workflowItems.filter((item) => {
      const itemDate = new Date(item.data);
      const itemMonth = itemDate.getMonth() + 1;
      const itemYear = itemDate.getFullYear();

      const [filterYear, filterMonth] = workflow.workflowFilters.mes.split("-").map(Number);

      const matchesMonth = itemYear === filterYear && itemMonth === filterMonth;
      const matchesSearch =
        !workflow.workflowFilters.busca ||
        item.nome.toLowerCase().includes(workflow.workflowFilters.busca.toLowerCase()) ||
        item.categoria.toLowerCase().includes(workflow.workflowFilters.busca.toLowerCase()) ||
        item.pacote.toLowerCase().includes(workflow.workflowFilters.busca.toLowerCase());

      return matchesMonth && matchesSearch;
    });
  }, [workflow.workflowItems, workflow.workflowFilters]);

  const contextValue: AppContextType = {
    // CRM
    templates: crm.templates,
    origens: crm.origens,
    clientes: crm.clientes,
    categorias: crm.categorias,
    categoriasFull: crm.categoriasFull,
    produtos: crm.produtos,
    pacotes: crm.pacotes,
    adicionarTemplate: crm.adicionarTemplate,
    atualizarTemplate: crm.atualizarTemplate,
    excluirTemplate: crm.excluirTemplate,
    definirTemplatePadrao: crm.definirTemplatePadrao,
    adicionarOrigem: crm.adicionarOrigem,
    atualizarOrigem: crm.atualizarOrigem,
    excluirOrigem: crm.excluirOrigem,
    adicionarCliente: crm.adicionarCliente,
    atualizarCliente: crm.atualizarCliente,
    removerCliente: crm.removerCliente,
    adicionarCategoria: crm.adicionarCategoria,
    removerCategoria: crm.removerCategoria,

    // Agenda
    appointments: agenda.appointments,
    availability: agenda.availability,
    availabilityTypes: agenda.availabilityTypes,
    selectedClientForScheduling: agenda.selectedClientForScheduling,
    setSelectedClientForScheduling: agenda.setSelectedClientForScheduling,
    clearSelectedClientForScheduling: agenda.clearSelectedClientForScheduling,
    isFromBudget: agenda.isFromBudget,
    getBudgetId: agenda.getBudgetId,
    canEditFully: agenda.canEditFully,
    addAppointment: agenda.addAppointment,
    updateAppointment: agenda.updateAppointment,
    deleteAppointment: agenda.deleteAppointment,
    addAvailabilitySlots: agenda.addAvailabilitySlots,
    clearAvailabilityForDate: agenda.clearAvailabilityForDate,
    deleteAvailabilitySlot: agenda.deleteAvailabilitySlot,
    addAvailabilityType: agenda.addAvailabilityType,
    updateAvailabilityType: agenda.updateAvailabilityType,
    deleteAvailabilityType: agenda.deleteAvailabilityType,

    // Workflow
    workflowItemsAll: workflow.workflowItems,
    workflowItems: filteredWorkflowItems,
    workflowSummary: workflow.workflowSummary,
    workflowFilters: workflow.workflowFilters,
    visibleColumns: workflow.visibleColumns,
    updateWorkflowItem: workflow.updateWorkflowItem,
    addPayment: workflow.addPayment,
    toggleColumnVisibility: workflow.toggleColumnVisibility,
    updateWorkflowFilters: workflow.updateWorkflowFilters,
    navigateMonth: workflow.navigateMonth,

    // Cartões & Motor Financeiro
    cartoes: cards.cartoes,
    adicionarCartao: cards.adicionarCartao,
    atualizarCartao: cards.atualizarCartao,
    removerCartao: cards.removerCartao,
    createTransactionEngine: cards.createTransactionEngine,
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};
