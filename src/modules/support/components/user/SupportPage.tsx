import { useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { LifeBuoy } from "lucide-react";
import { FAQSearch } from "./FAQSearch";
import { FAQList } from "./FAQList";
import { TicketForm } from "./TicketForm";
import { WhatsAppCTA } from "./WhatsAppCTA";
import { TicketHistoryTable } from "./TicketHistoryTable";
import { useFAQList, useFAQSearch } from "../../hooks/useFAQ";
import { useMyTickets } from "../../hooks/useTickets";

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const { articles, loading: loadingAll } = useFAQList(false);
  const { results, loading: loadingSearch } = useFAQSearch(trimmed);
  const { tickets, loading: loadingTickets } = useMyTickets();

  const list = useMemo(() => (trimmed ? results : articles), [trimmed, results, articles]);
  const flat = !!trimmed;

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <LifeBuoy className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Central de Suporte</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Como podemos ajudar?</h1>
        <p className="text-sm text-muted-foreground">
          Encontre respostas rápidas na nossa base de conhecimento ou abra um chamado para a equipe.
        </p>
      </header>

      <section className="space-y-4">
        <FAQSearch
          value={query}
          onChange={setQuery}
          resultsCount={results.length}
          loading={loadingSearch}
        />
        {(loadingAll && !articles.length) ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Carregando…
          </div>
        ) : (
          <FAQList articles={list} flat={flat} />
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <TicketForm />
      </section>

      <section>
        <WhatsAppCTA />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Meus chamados</h2>
        {loadingTickets ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Carregando…
          </div>
        ) : (
          <TicketHistoryTable tickets={tickets} />
        )}
      </section>
    </div>
  );
}
