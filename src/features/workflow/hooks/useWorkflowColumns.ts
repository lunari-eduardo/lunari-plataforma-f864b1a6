import { useCallback, useState } from "react";

const DEFAULT_VISIBLE_COLUMNS = {
  date: true,
  client: true,
  galeria: true,
  description: true,
  email: true,
  status: true,
  category: true,
  package: true,
  packageValue: true,
  discount: true,
  extraPhotoValue: true,
  extraPhotoQty: true,
  extraPhotoTotal: true,
  product: true,
  productTotal: true,
  additionalValue: true,
  details: true,
  total: true,
  paid: true,
  remaining: true,
  payment: true,
};

const COLUMNS_KEY = "workflow_visible_columns";
const WIDTHS_KEY = "workflow_column_widths";

/**
 * Onda 5a — gerencia visibleColumns + columnWidths persistidos em localStorage.
 * Comportamento idêntico ao original (mesmas keys, mesmos defaults).
 */
export function useWorkflowColumns() {
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = window.localStorage.getItem(COLUMNS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS;
    } catch (err) {
      console.error("Erro ao carregar colunas visíveis", err);
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = window.localStorage.getItem(WIDTHS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.error("Erro ao carregar larguras das colunas", err);
      return {};
    }
  });

  const handleColumnVisibilityChange = useCallback((columnKey: string, visible: boolean) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [columnKey]: visible };
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleColumnWidthChange = useCallback((widths: Record<string, number>) => {
    setColumnWidths(widths);
    window.localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths));
  }, []);

  return {
    visibleColumns,
    columnWidths,
    handleColumnVisibilityChange,
    handleColumnWidthChange,
  };
}
