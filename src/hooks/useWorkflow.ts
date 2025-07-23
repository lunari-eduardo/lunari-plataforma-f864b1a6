
import { useAppContext } from '@/contexts/AppContext';

export const useWorkflow = () => {
  const context = useAppContext();
  
  return {
    workflowItems: context.workflowItems,
    summary: context.workflowSummary,
    filters: context.workflowFilters,
    visibleColumns: context.visibleColumns,
    updateWorkflowItem: context.updateWorkflowItem,
    addPayment: context.addPayment,
    toggleColumnVisibility: context.toggleColumnVisibility,
    updateFilters: context.updateWorkflowFilters,
    navigateMonth: context.navigateMonth
  };
};
