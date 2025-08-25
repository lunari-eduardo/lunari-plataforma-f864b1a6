import { useCallback } from 'react';

interface UseNumberInputProps {
  value: number | string | undefined;
  onChange: (value: string) => void;
}

/**
 * Hook for enhanced number input UX:
 * - Displays empty string instead of "0" when value is 0 or undefined
 * - Auto-selects all text when input is focused
 * - Properly handles number formatting
 */
export function useNumberInput({ value, onChange }: UseNumberInputProps) {
  // Convert value to display format (empty string instead of 0)
  const displayValue = value === 0 || value === undefined || value === null || value === '' 
    ? '' 
    : String(value);

  // Handle focus to auto-select all text
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Use setTimeout to ensure the selection happens after the focus event
    setTimeout(() => {
      e.target.select();
    }, 0);
  }, []);

  // Handle change with proper number parsing
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  }, [onChange]);

  return {
    displayValue,
    handleFocus,
    handleChange
  };
}