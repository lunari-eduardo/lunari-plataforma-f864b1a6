import { useEffect, useState } from "react";
import { useSupportHost } from "../../SupportHostProvider";
import type { FAQMediaItem } from "../../types";

export function FAQMedia({ item }: { item: FAQMediaItem }) {
  const host = useSupportHost();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(host.storage.publicUrl(item.r2_key));
  }, [host, item.r2_key]);

  if (!url) return null;
  if (item.kind === "image") {
    return (
      <img
        src={url}
        alt={item.alt ?? ""}
        loading="lazy"
        className="my-3 max-h-96 w-full rounded-md border border-border object-contain"
      />
    );
  }
  return (
    <video
      src={url}
      controls
      preload="metadata"
      className="my-3 aspect-video w-full rounded-md border border-border bg-black"
    />
  );
}
