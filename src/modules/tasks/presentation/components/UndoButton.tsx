import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { UndoEntry } from '../store/undoStack';

interface UndoButtonProps {
  entries: UndoEntry[];
  onUndo: () => void;
}

export default function UndoButton({ entries, onUndo }: UndoButtonProps) {
  const disabled = entries.length === 0;
  const top = entries[0];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative inline-flex">
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              disabled={disabled}
              className="text-xs md:text-sm gap-1"
              aria-label="Desfazer última ação"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Desfazer</span>
            </Button>
            {entries.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-[16px] text-center font-medium pointer-events-none">
                {entries.length}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px]">
          {disabled ? (
            <span className="text-xs">Nenhuma ação para desfazer</span>
          ) : (
            <div className="text-xs space-y-1">
              <div className="font-medium">Próxima: {top?.label}</div>
              {entries.length > 1 && (
                <div className="opacity-70">
                  + {entries.length - 1} {entries.length - 1 === 1 ? 'ação anterior' : 'ações anteriores'}
                </div>
              )}
              <div className="opacity-60 pt-1">Atalho: Ctrl/Cmd + Z</div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
