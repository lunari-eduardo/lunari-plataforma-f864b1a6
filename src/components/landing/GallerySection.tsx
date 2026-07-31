import { Check } from "lucide-react";
import { SectionShell, EyebrowTag, Reveal, displayFont, uiFont } from "./primitives";

const points = [
  "Cliente seleciona. Você recebe a cobrança pronta.",
  "Fotos extras entram no financeiro sozinhas.",
  "Sem link separado. Sem outro login.",
  "Mesma sessão. Mesmo cliente. Mesmo cérebro.",
];

export function GallerySection() {
  return (
    <SectionShell tone="light">
      <Reveal>
        <div className="flex justify-center">
          <EyebrowTag>Galeria unificada</EyebrowTag>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <h2
          className="mx-auto mt-8 max-w-[900px] text-center text-[36px] leading-[1.05] tracking-[-0.025em] text-[#0A0A0A] md:text-[56px]"
          style={displayFont}
        >
          A galeria não é um produto separado.{" "}
          <span className="italic text-[#b0632f]">É o mesmo cérebro.</span>
        </h2>
      </Reveal>

      <div className="mt-16 grid grid-cols-1 items-center gap-12 md:grid-cols-[1.15fr_1fr] md:gap-16">
        {/* Mockup */}
        <Reveal delay={0.15}>
          <GalleryMockup />
        </Reveal>

        {/* Points */}
        <Reveal delay={0.25}>
          <div className="space-y-5" style={uiFont}>
            {points.map((p) => (
              <div key={p} className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#b0632f]/12">
                  <Check className="h-3 w-3 text-[#b0632f]" strokeWidth={2.5} />
                </div>
                <p className="text-[17px] leading-[1.5] text-[#0A0A0A]">{p}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

function GalleryMockup() {
  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[#0A0A0A]/10 bg-white"
      style={{ boxShadow: "0 30px 60px -30px rgba(10,10,10,0.28)" }}
    >
      <div className="flex items-center justify-between border-b border-[#0A0A0A]/8 bg-[#FAFAF7]/50 px-4 py-3" style={uiFont}>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#0A0A0A]/15" />
          <span className="h-2 w-2 rounded-full bg-[#0A0A0A]/15" />
          <span className="h-2 w-2 rounded-full bg-[#0A0A0A]/15" />
        </div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#0A0A0A]/50">
          lunari · galeria — Ana Ribeiro
        </div>
        <div className="text-[11px] text-[#0A0A0A]/45">32 fotos</div>
      </div>

      <div className="grid grid-cols-[1fr_180px]">
        <div className="grid grid-cols-3 gap-1.5 p-4">
          {Array.from({ length: 9 }).map((_, i) => {
            const selected = [1, 4, 7].includes(i);
            const tones = [
              "#E8DFCF", "#D9C8B4", "#E5D6C4",
              "#C9B99A", "#DECBB0", "#EFE3D0",
              "#D4C2A6", "#E8DDC7", "#C4B096",
            ];
            return (
              <div
                key={i}
                className="relative aspect-[4/5] rounded-[6px]"
                style={{ background: tones[i] }}
              >
                {selected && (
                  <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#b0632f] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-l border-[#0A0A0A]/8 bg-[#FAFAF7]/30 p-4" style={uiFont}>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#0A0A0A]/50">
            Progresso
          </div>
          <div className="mt-4 space-y-3 text-[12px]">
            <ProgressRow label="Seleção iniciada" done />
            <ProgressRow label="Extras adicionados" done />
            <ProgressRow label="Cobrança enviada" active />
            <ProgressRow label="Pagamento" />
            <ProgressRow label="Entrega" />
          </div>
          <div className="mt-6 rounded-[8px] border border-[#b0632f]/25 bg-[#b0632f]/8 p-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#b0632f]">
              +6 extras
            </div>
            <div className="mt-1 text-[15px] font-semibold text-[#0A0A0A]" style={displayFont}>
              R$ 150,00
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${
          done ? "bg-[#0A0A0A]" : active ? "bg-[#b0632f]" : "bg-[#0A0A0A]/15"
        }`}
      />
      <span className={done || active ? "text-[#0A0A0A]" : "text-[#0A0A0A]/40"}>
        {label}
      </span>
    </div>
  );
}
