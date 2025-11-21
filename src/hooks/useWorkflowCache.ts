/**
 * useWorkflowCache - Hook to consume WorkflowCacheContext
 * 
 * Provides simplified API for components to access workflow cache
 */

import { useWorkflowCacheContext } from '@/contexts/WorkflowCacheContext';

export const useWorkflowCache = () => {
  return useWorkflowCacheContext();
};
