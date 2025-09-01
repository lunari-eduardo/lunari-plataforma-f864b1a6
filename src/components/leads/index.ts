// Backward compatibility exports
// This file maintains compatibility with existing imports during refactoring

// Re-export everything from the new feature structure
export * from '@/features/leads';

// Specific component exports for backward compatibility
export { default as LeadsKanban } from '@/features/leads/components/kanban/LeadsKanban';
export { default as LeadMetricsCards } from '@/features/leads/components/metrics/LeadMetricsCards';
export { default as UnifiedLeadFilters } from '@/features/leads/components/filters/UnifiedLeadFilters';
export { default as LeadCard } from '@/features/leads/components/cards/LeadCard';
export { default as DraggableLeadCard } from '@/features/leads/components/cards/DraggableLeadCard';
export { default as LeadFormModal } from '@/features/leads/components/modals/LeadFormModal';
export { default as LeadDetailsModal } from '@/features/leads/components/modals/LeadDetailsModal';
export { default as LeadActionsPopover } from '@/features/leads/components/ui/LeadActionsPopover';
export { default as LeadHistoryPanel } from '@/features/leads/components/ui/LeadHistoryPanel';