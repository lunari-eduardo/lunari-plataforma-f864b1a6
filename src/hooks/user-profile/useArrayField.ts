import { useState, useEffect, useCallback } from 'react';

export function useArrayField(
  initialItems: string[], 
  onChange: (items: string[]) => void
) {
  const [items, setItems] = useState<string[]>(initialItems);

  // Sincronizar com prop externa
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const addItem = useCallback(() => {
    const newItems = [...items, ''];
    setItems(newItems);
    onChange(newItems);
  }, [items, onChange]);

  const updateItem = useCallback((index: number, value: string) => {
    const newItems = items.map((item, i) => i === index ? value : item);
    setItems(newItems);
    onChange(newItems);
  }, [items, onChange]);

  const removeItem = useCallback((index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onChange(newItems);
  }, [items, onChange]);

  return {
    items,
    addItem,
    updateItem,
    removeItem
  };
}