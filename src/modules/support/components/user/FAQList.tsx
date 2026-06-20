import { useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_CATEGORY_LABEL } from "../../utils/labels";
import { FAQItem } from "./FAQItem";
import type { FAQArticle, FAQCategory } from "../../types";

export function FAQList({
  articles,
  flat,
}: {
  articles: FAQArticle[];
  flat?: boolean;
}) {
  const grouped = useMemo(() => {
    if (flat) return null;
    const m: Record<string, FAQArticle[]> = {};
    for (const a of articles) {
      (m[a.category] ??= []).push(a);
    }
    return m;
  }, [articles, flat]);

  if (!articles.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhum artigo encontrado.
      </div>
    );
  }

  if (flat) {
    return (
      <Accordion type="multiple" className="space-y-2">
        {articles.map((a) => (
          <AccordionItem
            key={a.id}
            value={a.id}
            className="rounded-lg border border-border/60 bg-card/40 px-4"
          >
            <AccordionTrigger className="text-left text-sm hover:no-underline">
              {a.pergunta}
            </AccordionTrigger>
            <AccordionContent>
              <FAQItem article={a} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  const cats = Object.keys(grouped!) as FAQCategory[];
  return (
    <div className="space-y-6">
      {cats.map((cat) => (
        <div key={cat}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {FAQ_CATEGORY_LABEL[cat]}
          </h3>
          <Accordion type="multiple" className="space-y-2">
            {grouped![cat].map((a) => (
              <AccordionItem
                key={a.id}
                value={a.id}
                className="rounded-lg border border-border/60 bg-card/40 px-4"
              >
                <AccordionTrigger className="text-left text-sm hover:no-underline">
                  {a.pergunta}
                </AccordionTrigger>
                <AccordionContent>
                  <FAQItem article={a} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}
