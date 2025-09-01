// Centralized exports for Leads feature
// This ensures backward compatibility during refactoring

// Components
export { default as LeadCard } from './components/cards/LeadCard';
export { default as DraggableLeadCard } from './components/cards/DraggableLeadCard';
export { default as LeadActionButtons } from './components/cards/LeadActionButtons';

export { default as LeadFormModal } from './components/modals/LeadFormModal';
export { default as LeadDetailsModal } from './components/modals/LeadDetailsModal';
export { default as LeadSchedulingModal } from './components/modals/LeadSchedulingModal';
export { default as LeadLossReasonModal } from './components/modals/LeadLossReasonModal';
export { default as SchedulingConfirmationModal } from './components/modals/SchedulingConfirmationModal';
export { default as FollowUpConfigModal } from './components/modals/FollowUpConfigModal';

export { default as UnifiedLeadFilters } from './components/filters/UnifiedLeadFilters';
export { default as LeadPeriodFilter } from './components/filters/LeadPeriodFilter';
export { default as LeadStatusSelector } from './components/filters/LeadStatusSelector';

export { default as LeadMetricsCards } from './components/metrics/LeadMetricsCards';

export { default as LeadsKanban } from './components/kanban/LeadsKanban';

export { default as FollowUpCounter } from './components/ui/FollowUpCounter';
export { default as LeadActionsPopover } from './components/ui/LeadActionsPopover';
export { default as FollowUpNotificationCard } from './components/ui/FollowUpNotificationCard';
export { default as LeadHistoryPanel } from './components/ui/LeadHistoryPanel';

// Hooks
export { useLeads } from './hooks/core/useLeads';
export { useLeadStorage } from './hooks/core/useLeadStorage';
export { useLeadStatuses } from './hooks/core/useLeadStatuses';

export { useLeadInteractions } from './hooks/features/useLeadInteractions';
export { useLeadMetrics } from './hooks/features/useLeadMetrics';
export { useFollowUpSystem } from './hooks/features/useFollowUpSystem';
export { useLeadLossReasons } from './hooks/features/useLeadLossReasons';

// Services
export { LeadStorageService } from './services/LeadStorageService';
export { LeadSyncService } from './services/LeadSyncService';
export { LeadValidationService } from './services/LeadValidationService';

// Types
export type * from './types';

// Utils
export * from './utils';