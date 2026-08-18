import {
  MoreVertical,
  Clock,
  Ban,
  Trash2,
  Unlock,
  Camera,
  Video,
  User,
  CheckSquare,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TimeSlotOptionsMenuProps {
  onCreateSession?: () => void;
  onCreateMeeting?: () => void;
  onCreatePersonalEvent?: () => void;
  onCreateTask?: () => void;
  onAvailable: () => void;
  onBlock: () => void;
  onRemove: () => void;
  isBlocked?: boolean;
  onUnblock?: () => void;
}

export default function TimeSlotOptionsMenu({
  onCreateSession,
  onCreateMeeting,
  onCreatePersonalEvent,
  onCreateTask,
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
          className="p-1 rounded-md opacity-50 hover:opacity-100 hover:bg-accent/50 transition-all focus:opacity-100"
          aria-label="Opções do horário"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[190px]">
        {/* Criação de itens */}
        {onCreateSession && (
          <DropdownMenuItem
            className="text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCreateSession();
            }}
          >
            <Camera className="h-3.5 w-3.5 mr-2 text-blue-500" />
            Nova sessão
          </DropdownMenuItem>
        )}

        {onCreateMeeting && (
          <DropdownMenuItem
            className="text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCreateMeeting();
            }}
          >
            <Video className="h-3.5 w-3.5 mr-2 text-cyan-500" />
            Nova reunião
          </DropdownMenuItem>
        )}

        {onCreatePersonalEvent && (
          <DropdownMenuItem
            className="text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCreatePersonalEvent();
            }}
          >
            <User className="h-3.5 w-3.5 mr-2 text-purple-500" />
            Evento pessoal
          </DropdownMenuItem>
        )}

        {onCreateTask && (
          <DropdownMenuItem
            className="text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCreateTask();
            }}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-2 text-amber-500" />
            Nova tarefa
          </DropdownMenuItem>
        )}

        {(onCreateSession || onCreateMeeting || onCreatePersonalEvent || onCreateTask) && (
          <DropdownMenuSeparator />
        )}

        {/* Disponibilidade e Bloqueio */}
        <DropdownMenuItem
          className="text-xs h-8 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onAvailable();
          }}
        >
          <Clock className="h-3.5 w-3.5 mr-2 text-lunar-success" />
          Marcar disponível
        </DropdownMenuItem>

        {isBlocked && onUnblock ? (
          <DropdownMenuItem
            className="text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onUnblock();
            }}
          >
            <Unlock className="h-3.5 w-3.5 mr-2 text-primary" />
            Desbloquear
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onBlock();
            }}
          >
            <Ban className="h-3.5 w-3.5 mr-2 text-destructive" />
            Bloquear horário
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-xs h-8 text-destructive focus:text-destructive cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Excluir horário
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
