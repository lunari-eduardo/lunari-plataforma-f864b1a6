/**
 * Dropzone para upload imediato de anexos em uma tarefa.
 * Requer `taskId` salvo — sem ele, mostra hint.
 */
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Loader2, Upload } from "lucide-react";
import { useTaskAttachmentsV2 } from "../../hooks/useTaskAttachmentsV2";

interface Props {
  taskId: string | null | undefined;
}

export function AttachmentDropzone({ taskId }: Props) {
  const { upload } = useTaskAttachmentsV2(taskId);
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length || !taskId) return;
      setBusy(true);
      try {
        for (const f of files) await upload(f);
      } finally {
        setBusy(false);
      }
    },
    [taskId, upload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 10 * 1024 * 1024,
    disabled: !taskId || busy,
  });

  if (!taskId) {
    return (
      <div className="rounded-md border border-dashed border-lunar-border/60 p-4 text-center text-xs text-lunar-textSecondary">
        Salve a tarefa para anexar arquivos.
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-md border-2 border-dashed p-4 text-center transition ${
        isDragActive
          ? "border-lunar-accent bg-lunar-accent/10"
          : "border-lunar-border/60 hover:bg-lunar-background/40"
      } ${busy ? "opacity-60 pointer-events-none" : ""}`}
    >
      <input {...getInputProps()} />
      <div className="flex items-center justify-center gap-2 text-sm text-lunar-text">
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {isDragActive ? "Solte aqui" : "Clique ou arraste arquivos (até 10MB)"}
          </>
        )}
      </div>
    </div>
  );
}
