import { SectionShell, EyebrowTag, Reveal, displayFont, uiFont } from "./primitives";

export function WhatsAppSection() {
  return (
    <SectionShell className="bg-white">
      <Reveal>
        <div className="flex justify-center">
          <EyebrowTag>WhatsApp nativo</EyebrowTag>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <h2
          className="mx-auto mt-8 max-w-[860px] text-center text-[36px] leading-[1.05] tracking-[-0.025em] text-[#0A0A0A] md:text-[56px]"
          style={displayFont}
        >
          Onde seu cliente já está.{" "}
          <span className="italic text-[#FF5A1F]">Sem trocar de app.</span>
        </h2>
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-[1000px] grid-cols-1 items-center gap-12 md:grid-cols-2">
        <Reveal delay={0.15}>
          <ChatMockup />
        </Reveal>

        <Reveal delay={0.25}>
          <ul className="space-y-6" style={uiFont}>
            {[
              ["Confirmação de sessão", "cliente confirma sem sair da conversa"],
              ["Link de galeria", "com senha, expiração e leitura"],
              ["Cobrança e comprovante", "PIX gerado direto do chat"],
              ["Régua automática", "mensagem certa, na hora certa, sem robô"],
            ].map(([t, s]) => (
              <li key={t} className="border-l-2 border-[#FF5A1F] pl-4">
                <div className="text-[16px] font-semibold text-[#0A0A0A]">{t}</div>
                <div className="mt-1 text-[14px] text-[#0A0A0A]/55">{s}</div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </SectionShell>
  );
}

function ChatMockup() {
  const msgs = [
    { from: "studio", text: "Oi Marina! Sua sessão está confirmada para sábado, 14h ☺️" },
    { from: "client", text: "Perfeito! E a galeria da anterior?" },
    { from: "studio", text: "Prontinha 👇\nlunari.gallery/marina-c", link: true },
    { from: "client", text: "Amei! Vou escolher hoje" },
    { from: "studio", text: "Selecionou 3 extras. Segue o PIX: R$ 90,00 💫", pix: true },
  ];

  return (
    <div
      className="mx-auto max-w-[380px] overflow-hidden rounded-[20px] border border-[#0A0A0A]/10 bg-[#ECE5DA]"
      style={{ boxShadow: "0 30px 60px -30px rgba(10,10,10,0.35)" }}
    >
      <div className="flex items-center gap-3 border-b border-[#0A0A0A]/8 bg-[#FAFAF7] px-4 py-3" style={uiFont}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A0A0A] text-[13px] font-semibold text-[#FAFAF7]"
          style={displayFont}
        >
          A
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[#0A0A0A]">Ateliê Aurora</div>
          <div className="text-[11px] text-emerald-600">online</div>
        </div>
      </div>

      <div className="space-y-2 px-4 py-5" style={uiFont}>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "studio" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-line rounded-[12px] px-3 py-2 text-[13px] leading-[1.4] ${
                m.from === "studio"
                  ? "bg-white text-[#0A0A0A]"
                  : "bg-[#D9EAD3] text-[#0A0A0A]"
              }`}
            >
              {m.text}
              {m.link && (
                <div className="mt-2 rounded-[8px] bg-[#FAFAF7] px-2.5 py-1.5 text-[11px] text-[#0A0A0A]/70">
                  ↗ Galeria protegida · 32 fotos
                </div>
              )}
              {m.pix && (
                <div className="mt-2 flex items-center gap-2 rounded-[8px] bg-[#FF5A1F]/10 px-2.5 py-2 text-[11px] text-[#FF5A1F]">
                  <span className="font-semibold">PIX</span>
                  <span>copiar código</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
