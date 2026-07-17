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
          className="mx-auto mt-8 max-w-[860px] text-center text-[36px] leading-[1.05] tracking-[-0.025em] text-[#0B1B2B] md:text-[56px]"
          style={displayFont}
        >
          Onde seu cliente já está.{" "}
          <span className="italic text-[#C97B3A]">Sem trocar de app.</span>
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
              <li key={t} className="border-l-2 border-[#C97B3A] pl-4">
                <div className="text-[16px] font-semibold text-[#0B1B2B]">{t}</div>
                <div className="mt-1 text-[14px] text-[#0B1B2B]/55">{s}</div>
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
      className="mx-auto max-w-[380px] overflow-hidden rounded-[20px] border border-[#0B1B2B]/10 bg-[#ECE5DA]"
      style={{ boxShadow: "0 30px 60px -30px rgba(11,27,43,0.35)" }}
    >
      <div className="flex items-center gap-3 border-b border-[#0B1B2B]/8 bg-[#F5F1EA] px-4 py-3" style={uiFont}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B1B2B] text-[13px] font-semibold text-[#F5F1EA]"
          style={displayFont}
        >
          A
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[#0B1B2B]">Ateliê Aurora</div>
          <div className="text-[11px] text-emerald-600">online</div>
        </div>
      </div>

      <div className="space-y-2 px-4 py-5" style={uiFont}>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "studio" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-line rounded-[12px] px-3 py-2 text-[13px] leading-[1.4] ${
                m.from === "studio"
                  ? "bg-white text-[#0B1B2B]"
                  : "bg-[#D9EAD3] text-[#0B1B2B]"
              }`}
            >
              {m.text}
              {m.link && (
                <div className="mt-2 rounded-[8px] bg-[#F5F1EA] px-2.5 py-1.5 text-[11px] text-[#0B1B2B]/70">
                  ↗ Galeria protegida · 32 fotos
                </div>
              )}
              {m.pix && (
                <div className="mt-2 flex items-center gap-2 rounded-[8px] bg-[#C97B3A]/10 px-2.5 py-2 text-[11px] text-[#C97B3A]">
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
