import React, { useState, useMemo, useEffect, useRef } from "react";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";

/**
 * Input de quantidade de fotos extras com debounce + flag de "unsaved".
 * Extraído de WorkflowCardCollapsed (Onda 5c).
 */
export const ExtraPhotoQtyInput = React.memo(
  ({
    sessionId,
    initialValue,
    onUpdate,
  }: {
    sessionId: string;
    initialValue: number;
    onUpdate: (sessionId: string, field: string, value: any, silent?: boolean) => void;
  }) => {
    const [localValue, setLocalValue] = useState(String(initialValue || ""));
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const initialValueRef = useRef(initialValue);
    const isEditingRef = useRef(false);

    useEffect(() => {
      if (!isEditingRef.current && initialValue !== initialValueRef.current) {
        setLocalValue(String(initialValue || ""));
        initialValueRef.current = initialValue;
        setHasUnsavedChanges(false);
      }
    }, [initialValue, sessionId]);

    const debouncedSave = useMemo(
      () =>
        debounce((qtd: number) => {
          onUpdate(sessionId, "qtdFotosExtra", qtd);
          initialValueRef.current = qtd;
          setHasUnsavedChanges(false);
          isEditingRef.current = false;
        }, 800),
      [sessionId, onUpdate],
    );

    useEffect(() => {
      return () => debouncedSave.cancel();
    }, [debouncedSave]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      isEditingRef.current = true;
      setLocalValue(value);
      setHasUnsavedChanges(true);
      debouncedSave(parseInt(value) || 0);
    };

    const handleBlur = () => {
      if (hasUnsavedChanges) {
        debouncedSave.cancel();
        const qtd = parseInt(localValue) || 0;
        onUpdate(sessionId, "qtdFotosExtra", qtd);
        initialValueRef.current = qtd;
        setHasUnsavedChanges(false);
      }
      isEditingRef.current = false;
    };

    return (
      <Input
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`h-7 text-xs p-1 w-14 text-center border border-border/40 rounded-md bg-transparent focus:bg-card/60 dark:focus:bg-card/10 transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${hasUnsavedChanges ? "bg-yellow-50" : ""}`}
        placeholder="0"
        autoComplete="off"
      />
    );
  },
);
ExtraPhotoQtyInput.displayName = "ExtraPhotoQtyInput";
