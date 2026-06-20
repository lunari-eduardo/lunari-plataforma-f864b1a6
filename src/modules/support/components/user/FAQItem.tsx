import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { FAQMedia } from "../shared/FAQMedia";
import { useFAQFeedback } from "../../hooks/useFAQ";
import { useSupportHost } from "../../SupportHostProvider";
import * as svc from "../../services/faq.service";
import type { FAQArticle } from "../../types";

export function FAQItem({ article }: { article: FAQArticle }) {
  const host = useSupportHost();
  const { my, register } = useFAQFeedback();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    const key = "support:faq:viewed";
    try {
      const set = new Set<string>(JSON.parse(sessionStorage.getItem(key) || "[]"));
      if (!set.has(article.id)) {
        svc.incrementFAQView(host.supabase, article.id).catch(() => {});
        set.add(article.id);
        sessionStorage.setItem(key, JSON.stringify(Array.from(set)));
      }
    } catch {
      svc.incrementFAQView(host.supabase, article.id).catch(() => {});
    }
  }, [article.id, host]);

  const myVote = my[article.id];

  return (
    <div className="space-y-3 pt-2">
      <MarkdownRenderer source={article.resposta} />
      {article.media?.map((m, i) => (
        <FAQMedia key={`${article.id}-m-${i}`} item={m} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
        <span className="text-[11px] text-muted-foreground">
          Esta resposta resolveu sua dúvida?
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={myVote === true ? "default" : "outline"}
            onClick={() => register(article.id, true)}
            className={cn("h-7 px-2 text-xs", myVote === true && "bg-emerald-600 hover:bg-emerald-700")}
          >
            <ThumbsUp className="mr-1.5 h-3 w-3" />
            Sim
          </Button>
          <Button
            type="button"
            size="sm"
            variant={myVote === false ? "default" : "outline"}
            onClick={() => register(article.id, false)}
            className={cn("h-7 px-2 text-xs", myVote === false && "bg-red-600 hover:bg-red-700")}
          >
            <ThumbsDown className="mr-1.5 h-3 w-3" />
            Não
          </Button>
        </div>
      </div>
    </div>
  );
}
