
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CategoryComboboxProps {
  value?: string;
  disabled?: boolean;
}

export function CategoryCombobox({ value, disabled }: CategoryComboboxProps) {
  return (
    <Button
      variant="outline"
      disabled={true}
      className="w-full justify-start h-7 text-xs font-normal shadow-neumorphic-inset bg-gray-50 cursor-not-allowed"
    >
      {value || "Categoria"}
    </Button>
  );
}
