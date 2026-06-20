import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileImage, FileVideo } from "lucide-react";
import { toast } from "sonner";
import { SUPPORT_LIMITS, kindForMime } from "../../config";
import { buildPendingAttachment } from "../../services/attachments.service";
import type { PendingAttachment } from "../../types";

export function AttachmentsUploader({
  pending,
  onChange,
  disabled,
}: {
  pending: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const next = [...pending];
    for (const f of arr) {
      if (next.length >= SUPPORT_LIMITS.maxFilesPerMessage) {
        toast.error(`Máximo de ${SUPPORT_LIMITS.maxFilesPerMessage} arquivos por mensagem`);
        break;
      }
      const kind = kindForMime(f.type);
      if (!kind) {
        toast.error(`Tipo não permitido: ${f.name}`);
        continue;
      }
      const maxBytes =
        kind === "image" ? SUPPORT_LIMITS.imageMaxBytes : SUPPORT_LIMITS.videoMaxBytes;
      if (f.size > maxBytes) {
        toast.error(`${f.name} excede ${(maxBytes / 1024 / 1024).toFixed(0)}MB`);
        continue;
      }
      const item = buildPendingAttachment(f);
      if (item) next.push(item);
    }
    onChange(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const remove = (id: string) => {
    const item = pending.find((p) => p.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    onChange(pending.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || pending.length >= SUPPORT_LIMITS.maxFilesPerMessage}
        >
          <Paperclip className="mr-2 h-3.5 w-3.5" />
          Anexar
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {pending.length}/{SUPPORT_LIMITS.maxFilesPerMessage} — imagens até 10MB, vídeos até 50MB
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={[
          ...SUPPORT_LIMITS.acceptedImageMimes,
          ...SUPPORT_LIMITS.acceptedVideoMimes,
        ].join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {pending.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {pending.map((p) => (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted/40"
            >
              {p.kind === "image" ? (
                <img src={p.previewUrl} alt={p.file.name} className="h-full w-full object-cover" />
              ) : (
                <video
                  src={p.previewUrl}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
              )}
              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-1">
                <span className="flex items-center text-[10px] text-white">
                  {p.kind === "image" ? (
                    <FileImage className="mr-1 h-3 w-3" />
                  ) : (
                    <FileVideo className="mr-1 h-3 w-3" />
                  )}
                  {(p.file.size / 1024 / 1024).toFixed(1)}MB
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={disabled}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
