/**
 * Lista visual de anexos de uma tarefa.
 */
import React, { useState } from "react";
import { Download, FileText, Image as ImageIcon, Trash2, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TaskAttachment } from "../../../ports/attachmentsRepo";

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mime.includes("pdf") || mime.includes("word") || mime === "text/plain")
    return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  items: TaskAttachment[];
  onOpen: (storagePath: string) => void;
  onRemove?: (id: string) => Promise<boolean> | void;
  readOnly?: boolean;
}

export function AttachmentList({ items, onOpen, onRemove, readOnly }: Props) {
  const [pending, setPending] = useState<string | null>(null);

  if (!items.length) {
    return (
      <p className="text-xs text-lunar-textSecondary italic">Nenhum anexo.</p>
    );
  }

  return (
    <>
      <ul className="space-y-1.5">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-md border border-lunar-border/60 bg-lunar-background/30 px-3 py-2"
          >
            <span className="text-lunar-textSecondary">{iconFor(a.mimeType)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-lunar-text">{a.name}</p>
              <p className="text-xs text-lunar-textSecondary">
                {formatBytes(a.sizeBytes)}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onOpen(a.storagePath)}
              title="Abrir / baixar"
            >
              <Download className="h-4 w-4" />
            </Button>
            {!readOnly && onRemove && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setPending(a.id)}
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga o arquivo do armazenamento e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pending && onRemove) await onRemove(pending);
                setPending(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
