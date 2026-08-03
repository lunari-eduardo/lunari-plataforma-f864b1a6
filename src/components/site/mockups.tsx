import { monoFont, uiFont, TechLabel } from "@/components/landing/primitives";

/**
 * Mockup unificado — moldura estilo macOS + conteúdo variável.
 * Todos os mocks das páginas de produto reusam essa moldura.
 */
export function WindowFrame({
  title,
  children,
  tone = "light",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      className="relative overflow-hidden rounded-[14px] border shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]"
      style={{
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.1)",
        background: dark ? "#0F0F10" : "#FFFFFF",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)",
          background: dark ? "#141416" : "#F5F5F0",
        }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span
          className="ml-3 text-[10px] uppercase tracking-[0.18em]"
          style={{ ...monoFont, color: dark ? "rgba(255,255,255,0.4)" : "rgba(10,10,10,0.4)" }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ---------- Studio Workflow (kanban compacto) ---------- */
export function StudioWorkflowMock() {
  const cols = [
    { label: "Lead", count: 8, color: "#0A0A0A/70" },
    { label: "Sessão", count: 3, color: "#C9A87C" },
    { label: "Edição", count: 5 },
    { label: "Entrega", count: 2 },
  ];
  return (
    <WindowFrame title="lunari.studio / workflow">
      <div className="grid grid-cols-4 gap-2 p-4">
        {cols.map((c, i) => (
          <div key={i} className="rounded-[8px] border border-[rgba(10,10,10,0.08)] bg-[#FAFAF7] p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] text-[#0A0A0A]/55" style={monoFont}>
                {c.label}
              </span>
              <span className="text-[10px] tabular-nums text-[#0A0A0A]/45" style={monoFont}>
                {c.count}
              </span>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: Math.min(c.count, 3) }).map((_, k) => (
                <div
                  key={k}
                  className="rounded-[5px] border border-[rgba(10,10,10,0.06)] bg-white p-1.5"
                >
                  <div className="mb-0.5 h-1.5 w-3/4 rounded bg-[#0A0A0A]/12" />
                  <div className="h-1 w-1/2 rounded bg-[#0A0A0A]/8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}

/* ---------- Studio Agenda ---------- */
export function StudioAgendaMock() {
  const hours = ["09h", "11h", "14h", "16h"];
  const events = [
    { row: 0, label: "Ensaio Maria", color: "#C9A87C" },
    { row: 2, label: "Casamento", color: "#0A0A0A" },
    { row: 3, label: "Newborn", color: "#0A0A0A" },
  ];
  return (
    <WindowFrame title="lunari.studio / agenda">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between" style={uiFont}>
          <span className="text-[13px] font-medium">Quinta, 24 out</span>
          <span className="text-[11px] text-[#0A0A0A]/45" style={monoFont}>
            SYNC · GOOGLE CAL
          </span>
        </div>
        <div className="space-y-1">
          {hours.map((h, i) => {
            const ev = events.find((e) => e.row === i);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-10 text-[10px] tabular-nums text-[#0A0A0A]/40" style={monoFont}>
                  {h}
                </span>
                <div className="flex-1 rounded-[5px] border border-dashed border-[rgba(10,10,10,0.1)] p-1.5">
                  {ev ? (
                    <div
                      className="flex items-center gap-2 rounded-[3px] px-2 py-1 text-[11px] text-white"
                      style={{ background: ev.color, ...uiFont }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.7)" }}
                      />
                      {ev.label}
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WindowFrame>
  );
}

/* ---------- Studio Finance ---------- */
export function StudioFinanceMock() {
  const rows = [
    { date: "22/10", desc: "Ensaio · Maria", value: "+ R$ 1.200", tag: "PIX", ok: true },
    { date: "20/10", desc: "Casamento · João", value: "+ R$ 4.500", tag: "Asaas", ok: true },
    { date: "18/10", desc: "Extras galeria", value: "+ R$ 320", tag: "InfinitePay", ok: true },
    { date: "15/10", desc: "Newborn · Ana", value: "R$ 900", tag: "Pendente", ok: false },
  ];
  return (
    <WindowFrame title="lunari.studio / financeiro">
      <div className="p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-[#0A0A0A]/45" style={monoFont}>
            Recebido em outubro
          </span>
          <span className="text-[22px] tabular-nums" style={uiFont}>
            R$ 12.480
          </span>
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-[6px] border border-[rgba(10,10,10,0.06)] bg-white px-3 py-2"
              style={uiFont}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] tabular-nums text-[#0A0A0A]/45 w-10" style={monoFont}>
                  {r.date}
                </span>
                <span className="text-[12px]">{r.desc}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                    r.ok
                      ? "bg-[#C9A87C]/12 text-[#C9A87C]"
                      : "bg-[#0A0A0A]/8 text-[#0A0A0A]/60"
                  }`}
                  style={monoFont}
                >
                  {r.tag}
                </span>
                <span className={`text-[12px] tabular-nums ${r.ok ? "text-[#0A0A0A]" : "text-[#0A0A0A]/50"}`}>
                  {r.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </WindowFrame>
  );
}

/* ---------- Gallery Select ---------- */
export function GallerySelectMock() {
  return (
    <WindowFrame title="gallery.select / maria & pedro">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between" style={uiFont}>
          <span className="text-[13px] font-medium">Selecione até 10 fotos</span>
          <span className="rounded-full bg-[#C9A87C]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C9A87C]" style={monoFont}>
            12 · R$ 25 em extras
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 15 }).map((_, i) => {
            const selected = [0, 2, 3, 5, 7, 8, 10, 11, 12, 13, 14, 6].includes(i);
            return (
              <div
                key={i}
                className={`aspect-square rounded-[4px] border ${
                  selected
                    ? "border-[#C9A87C] bg-gradient-to-br from-[#C9A87C]/15 to-[#C9A87C]/30"
                    : "border-[rgba(10,10,10,0.08)] bg-gradient-to-br from-[#0A0A0A]/5 to-[#0A0A0A]/15"
                }`}
              >
                {selected && (
                  <div className="flex h-full items-end justify-end p-1">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#C9A87C] text-[8px] font-semibold text-white">
                      ✓
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[6px] border border-[rgba(10,10,10,0.08)] bg-[#FAFAF7] px-3 py-2.5" style={uiFont}>
          <span className="text-[11px] text-[#0A0A0A]/60" style={monoFont}>
            TOTAL · SESSÃO + EXTRAS
          </span>
          <span className="text-[14px] tabular-nums">R$ 800 + R$ 25</span>
        </div>
      </div>
    </WindowFrame>
  );
}

/* ---------- Gallery Transfer ---------- */
export function GalleryTransferMock() {
  return (
    <WindowFrame title="gallery.transfer / entrega final" tone="dark">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between" style={uiFont}>
          <span className="text-[13px] font-medium text-[#FAFAF7]">248 fotos · Ana & Carlos</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70" style={monoFont}>
            Expira em 15 dias
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-[3px] bg-gradient-to-br from-white/8 to-white/15"
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[6px] border border-white/10 bg-white/5 px-3 py-2.5" style={uiFont}>
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C9A87C]" />
            <span className="text-[11px] text-white/60" style={monoFont}>
              Protegido por senha · Marca d'água
            </span>
          </div>
          <button className="rounded-[4px] bg-[#C9A87C] px-3 py-1 text-[11px] font-medium text-white" style={uiFont}>
            Baixar tudo (ZIP)
          </button>
        </div>
      </div>
    </WindowFrame>
  );
}
