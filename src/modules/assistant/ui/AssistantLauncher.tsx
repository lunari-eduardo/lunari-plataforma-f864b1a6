import { useState } from "react";
import { Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { AssistantChat } from "./AssistantChat";
import { useAssistantAccess } from "../runtime/useAssistantAccess";

/**
 * Onda E.3 — Launcher flutuante da Lunari.
 *
 * Renderizado uma vez pelo Layout autenticado. Abre um Sheet lateral
 * com o chat da assistente. Só aparece quando o rollout permite
 * (Admin → Beta → Geral, via `assistant_access_allowed`).
 */
export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const { allowed } = useAssistantAccess();
  if (!allowed) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Abrir assistente Lunari"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all",
          "hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <SheetTitle className="text-base font-medium">Lunari · Assistente</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <AssistantChat />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
