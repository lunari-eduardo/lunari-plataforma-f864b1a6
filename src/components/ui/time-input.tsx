
import React, { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ value, onChange, onBlur, className, placeholder = "HH:MM", ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync with external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Format time as user types
    const formatTime = (input: string) => {
      // Remove all non-digits
      const digits = input.replace(/\D/g, '');
      
      if (digits.length === 0) return '';
      if (digits.length <= 2) return digits;
      if (digits.length <= 4) {
        return `${digits.slice(0, 2)}:${digits.slice(2)}`;
      }
      // Limit to 4 digits (HHMM)
      return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    };

    // Validate time format
    const isValidTime = (time: string) => {
      if (!time) return false;
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      return timeRegex.test(time);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const formattedValue = formatTime(rawValue);
      setInternalValue(formattedValue);
    };

    const handleBlur = () => {
      if (isValidTime(internalValue)) {
        onChange(internalValue);
      } else if (internalValue === '') {
        onChange('');
      } else {
        // Reset to original value if invalid
        setInternalValue(value);
      }
      onBlur?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow Enter to blur and save
      if (e.key === 'Enter') {
        inputRef.current?.blur();
      }
      // Allow Escape to cancel
      if (e.key === 'Escape') {
        setInternalValue(value);
        inputRef.current?.blur();
      }
    };

    // Focus and select all text when component mounts
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, []);

    return (
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={5}
        className={cn(
          "w-full text-xs bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500",
          className
        )}
        {...props}
      />
    );
  }
);

TimeInput.displayName = "TimeInput";

export { TimeInput };
