import { Button } from "@/components/ui/button";
import { PanelRightOpen } from "lucide-react";
import { WorkflowTasksPanel } from "@/components/workflow/WorkflowTasksPanel";

interface Props {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  currentMonth: { month: number; year: number };
}

/**
 * Onda 5a — docks (desktop fixo + mobile empilhado) do painel de tarefas.
 */
export function WorkflowTasksDock({ isOpen, onOpen, onClose, currentMonth }: Props) {
  return (
    <>
      {/* Desktop dock */}
      <div className="hidden lg:block fixed right-0 top-[60px] bottom-0 z-30">
        {isOpen ? (
          <div className="h-full w-[320px] transition-transform duration-200 ease-out animate-in slide-in-from-right">
            <WorkflowTasksPanel currentMonth={currentMonth} onCollapse={onClose} />
          </div>
        ) : (
          <button
            onClick={onOpen}
            className="h-full w-10 flex flex-col items-center justify-center gap-3 border-l border-border/60 bg-card/60 backdrop-blur-xl backdrop-saturate-[1.8] hover:bg-card/80 transition-colors cursor-pointer"
            title="Abrir painel de tarefas"
          >
            <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground [writing-mode:vertical-lr] rotate-180 tracking-wider">
              TAREFAS
            </span>
          </button>
        )}
      </div>

      {/* Mobile dock */}
      <div className="lg:hidden">
        {isOpen && (
          <div className="w-full">
            <WorkflowTasksPanel currentMonth={currentMonth} onCollapse={onClose} />
          </div>
        )}
        {!isOpen && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs text-muted-foreground gap-1.5"
            onClick={onOpen}
          >
            <PanelRightOpen className="h-3.5 w-3.5" />
            Abrir tarefas
          </Button>
        )}
      </div>
    </>
  );
}
