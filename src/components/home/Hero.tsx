import { SiteH1, SiteLead, SiteReveal } from "../site/typography";

function StudioMockup() {
  const rows = [
    { cliente: "Maria & Pedro", etapa: "Seleção", valor: "R$ 2.400", cor: "bg-site-gold" },
    { cliente: "Ana Clara", etapa: "Edição", valor: "R$ 1.180", cor: "bg-site-gold/50" },
    { cliente: "Família Souza", etapa: "Entrega", valor: "R$ 3.900", cor: "bg-site-gold/25" },
  ];

  return (
    <div className="rounded-2xl border border-site-line-dark bg-site-graphiteSoft shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)] overflow-hidden">
      {/* Barra da janela */}
      <div className="flex items-center gap-2 border-b border-site-line-dark px-5 py-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-site-on-dark/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-site-on-dark/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-site-on-dark/20" />
        <p className="ml-3 text-[10px] font-mono uppercase tracking-[0.18em] text-site-on-dark-muted">
          lunari.studio / workflow
        </p>
      </div>

      <div className="p-5 md:p-7">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Sessões ativas", value: "12" },
            { label: "A receber", value: "R$ 18,4k" },
            { label: "Entregas na semana", value: "04" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-site-line-dark bg-site-graphite px-4 py-4">
              <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-site-on-dark-muted">{kpi.label}</p>
              <p className="mt-2 text-xl font-semibold text-site-on-dark">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2.5">
          {rows.map((r) => (
            <div
              key={r.cliente}
              className="flex items-center justify-between gap-4 rounded-xl border border-site-line-dark bg-site-graphite px-4 py-3.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.cor}`} />
                <p className="truncate text-sm font-medium text-site-on-dark">{r.cliente}</p>
              </div>
              <p className="hidden shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] text-site-on-dark-muted sm:block">
                {r.etapa}
              </p>
              <p className="shrink-0 text-sm font-semibold text-site-gold">{r.valor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      data-tone="dark"
      className="relative overflow-hidden bg-site-graphite pt-28 pb-20 md:pt-44 md:pb-32"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute top-0 right-0 h-[600px] w-[800px] translate-x-1/2 -translate-y-1/2 rounded-full bg-site-gold/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[600px] -translate-x-1/2 translate-y-1/2 rounded-full bg-site-gold/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-6 md:grid-cols-[1fr_1.05fr] md:gap-16 md:px-10">
        <div>
          <SiteReveal>
            <div className="mb-6 inline-flex items-center rounded-full border border-site-gold/20 bg-site-gold/5 px-3 py-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-site-gold">
                PLATAFORMA SAAS DE GESTÃO
              </span>
            </div>
            <SiteH1 tone="dark" emphasis="Não adaptado.">
              Lunari: O sistema de gestão completo para fotógrafos.
            </SiteH1>
          </SiteReveal>

          <SiteReveal delay={120}>
            <SiteLead tone="dark" className="mt-7 max-w-xl">
              CRM, agenda, contratos, financeiro, galeria e um assistente de IA — todos os módulos do
              seu estúdio, rodando em tempo real, na mesma base de dados.
            </SiteLead>
          </SiteReveal>

          <SiteReveal delay={220}>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="/auth"
                className="rounded-full bg-site-gold px-8 py-4 text-sm font-bold tracking-wide text-site-graphite transition-all hover:-translate-y-0.5 hover:bg-site-goldPale"
              >
                TESTAR GRÁTIS
              </a>
              <a
                href="#modulos"
                className="rounded-full border border-site-line-dark px-8 py-4 text-sm font-bold tracking-wide text-site-on-dark transition-all hover:-translate-y-0.5 hover:border-site-gold"
              >
                VER MÓDULOS
              </a>
            </div>
          </SiteReveal>
        </div>

        <SiteReveal delay={300} className="relative">
          <StudioMockup />

          <div className="absolute -bottom-10 -left-8 hidden rounded-2xl border border-site-line-dark bg-site-graphiteSoft/95 p-5 shadow-xl backdrop-blur lg:block">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-site-gold/20">
                <div className="h-2 w-2 animate-pulse rounded-full bg-site-gold" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-site-gold">Status</p>
                <p className="text-sm font-semibold text-site-on-dark">Estúdio em órbita</p>
              </div>
            </div>
          </div>
        </SiteReveal>
      </div>
    </section>
  );
}
