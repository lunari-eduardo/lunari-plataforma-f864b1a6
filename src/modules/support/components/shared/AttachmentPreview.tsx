import { useEffect, useState } from "react";
import { useSupportHost } from "../../SupportHostProvider";
import type { SupportAttachment } from "../../types";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function AttachmentPreview({ attachment }: { attachment: SupportAttachment }) {
  const host = useSupportHost();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    host.storage.getSignedUrl(attachment.r2_key).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [host, attachment.r2_key]);

  if (!url) {
    return (
      <div className="flex aspect-square w-24 items-center justify-center rounded-md border border-border bg-muted/30 text-[10px] text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (attachment.kind === "image") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block aspect-square w-24 overflow-hidden rounded-md border border-border bg-muted/30 transition hover:opacity-90"
        >
          <img
            src={url}
            alt={attachment.file_name ?? ""}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl p-2">
            <img src={url} alt={attachment.file_name ?? ""} className="max-h-[80vh] w-full object-contain" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <video
      src={url}
      controls
      preload="metadata"
      className="aspect-video w-64 rounded-md border border-border bg-black"
    />
  );
}
