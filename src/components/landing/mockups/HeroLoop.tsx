import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE, TOKENS, monoFont, uiFont } from "../primitives";

/**
 * HeroLoop — composição da interface do Lunari renderizada em HTML/CSS.
 * Usada como fallback (e poster vivo) enquanto o vídeo cinematográfico
 * da interface não estiver disponível em /public/media.
 *
 * Micro-narrativa em loop lento (~14s), 5 momentos:
 *  1. cliente muda de etapa no workflow
 *  2. contrato passa a assinado
 *  3. pagamento muda de status
 *  4. galeria aparece vinculada ao atendimento
 *  5. card discreto da Lu surge
 */

const STEP_MS = 2800;
const STEPS = 5;

export function HeroLoop() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 4 : 0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(
      () => setStep((s) => (s + 1) % STEPS),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, [reduce]);

  const fade = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.6, ease: EASE },
  };

  return (
    <div className="relative w-full" style={uiFont}>
      <div
        className="overflow-hidden rounded-[16px] border bg-white"
        style={{
          borderColor: TOKENS.hair,
          boxShadow: "0 40px 80px -48px rgba(10,10,10,0.28)",
        }}
      >
        {/* barra superior */}
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: TOKENS.hair, background: "rgba(250,250,247,0.7)" }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: "rgba(10,10,10,0.14)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "rgba(10,10,10,0.14)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "rgba(10,10,10,0.14)" }} />
          <span
            className="mx-auto text-[10px] uppercase tracking-[0.2em]"
            style={{ ...monoFont, color: "rgba(10,10,10,0.42)" }}
          >
            lunari · estúdio
          </span>
        </div>

        {/* corpo */}
        <div className="grid gap-3 p-4 md:grid-cols-[1.35fr_1fr] md:gap-4 md:p-5">
          {/* coluna workflow */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Agendado", n: 4 },
              { label: "Em edição", n: 3 },
              { label: "Entrega", n: 2 },
            ].map((col, ci) => (
              <div
                key={col.label}
                className="rounded-[10px] border p-2.5"
                style={{ borderColor: TOKENS.hair, background: "rgba(250,250,247,0.5)" }}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span
                    className="text-[9px] uppercase tracking-[0.14em]"
                    style={{ ...monoFont, color: "rgba(10,10,10,0.5)" }}
                  >
                    {col.label}
                  </span>
                  <span className="text-[10px]" style={{ color: "rgba(10,10,10,0.35)" }}>
                    {col.n}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* card que migra de coluna no passo 0 */}
                  {((step >= 1 && ci === 1) || (step === 0 && ci === 0)) && (
                    <motion.div
                      layout
                      layoutId="moving-card"
                      transition={{ duration: 0.9, ease: EASE }}
                      className="rounded-[8px] border bg-white p-2.5"
                      style={{ borderColor: "rgba(176,99,47,0.45)" }}
                    >
                      <div className="text-[11.5px] font-medium">Ana Ribeiro</div>
                      <div className="mt-0.5 text-[10.5px]" style={{ color: "rgba(10,10,10,0.5)" }}>
                        Ensaio Gestante · 18 out
                      </div>
                    </motion.div>
                  )}

                  <MiniCard name={["João L.", "Marina C.", "Beatriz T."][ci]} sub="Ensaio · 24 out" />
                  {ci === 0 && <MiniCard name="Lívia P." sub="Newborn · 28 out" />}
                </div>
              </div>
            ))}
          </div>

          {/* coluna lateral: contrato / pagamento / galeria */}
          <div className="flex flex-col gap-2.5">
            <Panel title="Contrato">
              <AnimatePresence mode="wait">
                {step >= 1 ? (
                  <motion.div key="ok" {...fade}>
                    <Status tone="ok" label="Assinado · 18 out" />
                  </motion.div>
                ) : (
                  <motion.div key="wait" {...fade}>
                    <Status tone="wait" label="Aguardando assinatura" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>

            <Panel title="Financeiro">
              <AnimatePresence mode="wait">
                {step >= 2 ? (
                  <motion.div key="paid" {...fade}>
                    <Status tone="ok" label="Pago · R$ 1.480,00" />
                  </motion.div>
                ) : (
                  <motion.div key="pend" {...fade}>
                    <Status tone="wait" label="Pendente · R$ 1.480,00" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>

            <Panel title="Galeria">
              <AnimatePresence mode="wait">
                {step >= 3 ? (
                  <motion.div key="gal" {...fade} className="flex items-center gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="h-7 w-7 rounded-[5px]"
                        style={{ background: `rgba(10,10,10,${0.06 + i * 0.03})` }}
                      />
                    ))}
                    <span className="ml-1 text-[10.5px]" style={{ color: "rgba(10,10,10,0.5)" }}>
                      42 fotos · vinculada
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    {...fade}
                    className="text-[10.5px]"
                    style={{ color: "rgba(10,10,10,0.35)" }}
                  >
                    Nenhuma galeria vinculada
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          </div>
        </div>
      </div>

      {/* card discreto da Lu */}
      <AnimatePresence>
        {step >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="absolute -bottom-5 right-5 hidden items-center gap-2.5 rounded-full border bg-white px-4 py-2.5 md:flex"
            style={{
              borderColor: TOKENS.hair,
              boxShadow: "0 14px 34px -18px rgba(10,10,10,0.3)",
            }}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10.5px] font-semibold"
              style={{ background: TOKENS.ink, color: TOKENS.paper }}
            >
              Lu
            </span>
            <span className="text-[12.5px]">Tudo pronto para a entrega de Ana Ribeiro.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniCard({ name, sub }: { name: string; sub: string }) {
  return (
    <div className="rounded-[8px] border bg-white p-2.5" style={{ borderColor: TOKENS.hair }}>
      <div className="text-[11.5px] font-medium">{name}</div>
      <div className="mt-0.5 text-[10.5px]" style={{ color: "rgba(10,10,10,0.5)" }}>
        {sub}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[10px] border p-3"
      style={{ borderColor: TOKENS.hair, background: "rgba(250,250,247,0.5)" }}
    >
      <div
        className="mb-2 text-[9px] uppercase tracking-[0.14em]"
        style={{ ...monoFont, color: "rgba(10,10,10,0.5)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Status({ tone, label }: { tone: "ok" | "wait"; label: string }) {
  const color = tone === "ok" ? "#3f7d5a" : TOKENS.ember;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span style={{ color: "rgba(10,10,10,0.82)" }}>{label}</span>
    </div>
  );
}
