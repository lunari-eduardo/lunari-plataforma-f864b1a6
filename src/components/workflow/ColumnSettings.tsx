import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
interface ColumnSettingsProps {
  visibleColumns: Record<string, boolean>;
  onColumnVisibilityChange: (columns: Record<string, boolean>) => void;
  availableColumns?: Record<string, string>;
}
export function ColumnSettings({
  visibleColumns,
  onColumnVisibilityChange,
  availableColumns = {
    date: "Data e Hora",
    client: "Cliente",
    description: "Descrição",
    status: "Status",
    package: "Pacote",
    extras: "Extras",
    discount: "Desconto",
    total: "Total",
    paid: "Pago",
    remaining: "Resta"
  }
}: ColumnSettingsProps) {
  const [localColumns, setLocalColumns] = useState<Record<string, boolean>>(visibleColumns);

  // Toggle a column's visibility
  const toggleColumn = (column: string) => {
    const updated = {
      ...localColumns,
      [column]: !localColumns[column]
    };
    setLocalColumns(updated);
  };

  // Apply changes
  const handleApply = () => {
    onColumnVisibilityChange(localColumns);
  };

  // Reset to all columns visible
  const handleShowAll = () => {
    const all = Object.keys(availableColumns).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setLocalColumns(all);
    onColumnVisibilityChange(all);
  };
  return <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-sm">
          <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
          <span className="text-xs">Colunas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Colunas visíveis</h4>
            <p className="text-xs text-muted-foreground">
              Selecione as colunas que serão exibidas na tabela.
            </p>
            <Separator />
          </div>
          
          <div className="grid gap-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-elegant">
            {Object.entries(availableColumns).map(([key, label]) => <div key={key} className="flex items-center space-x-2">
                <Checkbox id={`column-${key}`} checked={localColumns[key] !== false} onCheckedChange={() => toggleColumn(key)} />
                <Label htmlFor={`column-${key}`} className="text-xs cursor-pointer">
                  {label}
                </Label>
              </div>)}
          </div>
          
          <div className="flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={handleShowAll} className="text-xs h-7">
              Mostrar tudo
            </Button>
            <Button size="sm" onClick={handleApply} className="text-xs h-7 bg-violet-600 hover:bg-violet-700">
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>;
}