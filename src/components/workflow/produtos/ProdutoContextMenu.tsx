import { MoreVertical, Copy, Trash2, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  showEditCustom: boolean;
  onDuplicate: () => void;
  onEditCustom: () => void;
  onRemove: () => void;
}

export function ProdutoContextMenu({
  showEditCustom,
  onDuplicate,
  onEditCustom,
  onRemove,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
          aria-label="Ações do produto"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Duplicar
        </DropdownMenuItem>
        {showEditCustom && (
          <DropdownMenuItem onClick={onEditCustom}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Editar etapas personalizadas
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onRemove}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
