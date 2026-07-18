import { uiFont, displayFont } from "../primitives";

/**
 * Realistic Workflow-card mockup rendered in pure HTML/CSS
 * (no stock images). Mirrors the actual Lunari UI aesthetic.
 */
export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[1080px]">
      {/* Window shell */}
      <div
        className="overflow-hidden rounded-[16px] border border-[#0A0A0A]/10 bg-white"
        style={{
          boxShadow:
            "0 1px 0 rgba(10,10,10,0.04), 0 40px 80px -40px rgba(10,10,10,0.35)",
        }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-[#0A0A0A]/8 bg-[#FAFAF7]/60 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0A0A0A]/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#0A0A0A]/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#0A0A0A]/15" />
          <div
            className="mx-auto text-[11px] uppercase tracking-[0.18em] text-[#0A0A0A]/50"
            style={uiFont}
          >
            lunari · workflow · outubro 2026
          </div>
        </div>

        {/* Kanban strip */}
        <div className="grid grid-cols-4 gap-3 bg-white p-5" style={uiFont}>
          {[
            { name: "CRM", count: 12, color: "#0A0A0A" },
            { name: "Agenda", count: 8, color: "#0A0A0A" },
            { name: "Contrato", count: 5, color: "#FF5A1F", highlight: true },
            { name: "Financeiro", count: 3, color: "#0A0A0A" },
          ].map((c, i) => (
            <div
              key={c.name}
              className="rounded-[10px] border border-[#0A0A0A]/8 bg-[#FAFAF7]/50 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-[#0A0A0A]/55">
                  {c.name}
                </span>
                <span className="text-[11px] text-[#0A0A0A]/40">{c.count}</span>
              </div>

              <MockCard
                name={i === 2 ? "Ana Ribeiro" : ["João L.", "Marina C.", "Beatriz T."][i % 3]}
                sub={i === 2 ? "Ensaio Gestante · 18 Out" : "Ensaio · 24 Out"}
                accent={c.highlight}
              />
              <div className="mt-2">
                <MockCard
                  name={["Rafa Souza", "Camila V.", "Pedro L.", "Isis M."][i]}
                  sub="Família · 26 Out"
                />
              </div>
              {i === 0 && (
                <div className="mt-2">
                  <MockCard name="Lívia P." sub="Newborn · 28 Out" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between border-t border-[#0A0A0A]/8 bg-[#FAFAF7]/40 px-5 py-3" style={uiFont}>
          <div className="flex items-center gap-6 text-[12px]">
            <MetricInline label="Previsto" value="R$ 42.180" />
            <MetricInline label="Recebido" value="R$ 31.420" />
            <MetricInline label="A receber" value="R$ 10.760" amber />
          </div>
          <div className="hidden items-center gap-1.5 text-[11px] text-[#0A0A0A]/50 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Sincronizado agora
          </div>
        </div>
      </div>

      {/* Floating Lu chip */}
      <div
        className="absolute -bottom-6 right-4 hidden items-center gap-2.5 rounded-full border border-[#0A0A0A]/10 bg-white px-4 py-2.5 md:flex"
        style={{
          boxShadow: "0 12px 32px -12px rgba(10,10,10,0.25)",
          ...uiFont,
        }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0A0A0A] text-[11px] font-semibold text-[#FAFAF7]" style={displayFont}>
          Lu
        </span>
        <span className="text-[13px] text-[#0A0A0A]">
          3 clientes com galeria pendente há +15 dias
        </span>
      </div>
    </div>
  );
}

function MockCard({
  name,
  sub,
  accent,
}: {
  name: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[8px] border bg-white p-2.5 ${
        accent ? "border-[#FF5A1F]/50" : "border-[#0A0A0A]/8"
      }`}
    >
      <div className="text-[12px] font-medium text-[#0A0A0A]">{name}</div>
      <div className="mt-0.5 text-[11px] text-[#0A0A0A]/50">{sub}</div>
      {accent && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-[#FF5A1F]" />
          <span className="text-[10px] uppercase tracking-wider text-[#FF5A1F]">
            aguardando assinatura
          </span>
        </div>
      )}
    </div>
  );
}

function MetricInline({
  label,
  value,
  amber,
}: {
  label: string;
  value: string;
  amber?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#0A0A0A]/50">{label}</span>
      <span className={amber ? "font-semibold text-[#FF5A1F]" : "font-semibold text-[#0A0A0A]"}>
        {value}
      </span>
    </div>
  );
}
