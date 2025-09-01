// Centralized type exports
export * from './leads';
export * from './leadInteractions';

// Re-export from original location for backward compatibility
export type { Lead, LeadStatus, LeadStatusDef } from '@/types/leads';
export type { LeadInteraction, FollowUpConfig, FollowUpNotification } from '@/types/leadInteractions';