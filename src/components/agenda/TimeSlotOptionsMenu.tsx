import { MoreVertical, Clock, Ban, Trash2, Unlock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TimeSlotOptionsMenuProps {
  onAvailable: () => void;
  onBlock: () => void;
  onRemove: () => void;
  isBlocked?: boolean;
  onUnblock?: () => void;
}

export default function TimeSlotOptionsMenu({
  onAvailable,
  onBlock,
  onRemove,
  isBlocked,
  onUnblock,
}: TimeSlotOptionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md opacity-40 hover:opacity-100 hover:bg-accent/50 transition-all focus:opacity-100"
          aria-label="Opções do horário"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAvailable(); }}>
          <Clock className="h-4 w-4 mr-2 text-emerald-500" />
          Disponível
        </DropdownMenuItem>
        {isBlocked && onUnblock ? (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnblock(); }}>
            <Unlock className="h-4 w-4 mr-2 text-blue-500" />
            Desbloquear
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onBlock(); }}>
            <Ban className="h-4 w-4 mr-2 text-destructive" />
            Bloquear
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir horário
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
