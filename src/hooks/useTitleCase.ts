import { useCallback } from 'react';

/**
 * Converts a string to Title Case (each word starts with uppercase)
 */
export function toTitleCase(value: string): string {
  if (!value) return value;
  
  return value
    .split(' ')
    .map(word => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Hook that provides a Title Case transformation for input onChange handlers
 */
export function useTitleCase() {
  const transformToTitleCase = useCallback((value: string): string => {
    return toTitleCase(value);
  }, []);

  return { transformToTitleCase, toTitleCase };
}
