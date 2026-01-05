/**
 * Utility function for debouncing
 * Useful for throttling real-time updates and cache invalidations
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a debounced version of a function that can be cancelled
 */
export function createDebouncedFn<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): { fn: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const fn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
  
  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return { fn, cancel };
}
