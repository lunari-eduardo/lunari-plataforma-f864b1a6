import { useReducedMotion } from "framer-motion";
import { TOKENS, monoFont } from "./primitives";

/**
 * HeroMedia — moldura do vídeo em loop do hero (tema dark "silent luxury").
 *
 * Sem `src`, mostra um placeholder escuro com selo mono. O layout não muda
 * quando o vídeo for apontado: basta passar `src` (e opcionalmente `poster`).
 */
export function HeroMedia({
  src,
  poster,
}: {
  src?: string;
  poster?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-full">
      {/* halo dourado difuso atrás da moldura */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-[320px] w-[420px] opacity-[0.22] blur-3xl"
        style={{
          background: `radial-gradient(closest-side, ${TOKENS.gold}, transparent 70%)`,
        }}
      />

      <div
        className="relative overflow-hidden rounded-[18px] border"
        style={{
          borderColor: TOKENS.hairDarkStrong,
          background: TOKENS.obsidianSoft,
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.05) inset, 0 60px 120px -60px rgba(0,0,0,0.9)",
        }}
      >
        <div className="relative aspect-[16/10] w-full">
          {src ? (
            <video
              className="h-full w-full object-cover"
              src={src}
              poster={poster}
              autoPlay={!reduce}
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background:
                  "linear-gradient(140deg, #131313 0%, #0C0C0C 55%, #151312 100%)",
              }}
            >
              <span
                className="rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.22em]"
                style={{
                  ...monoFont,
                  borderColor: TOKENS.hairDarkStrong,
                  color: TOKENS.onDarkFaint,
                }}
              >
                vídeo em loop
              </span>
            </div>
          )}
        </div>
      </div>

      {/* reflexo suave abaixo da moldura */}
      <div
        aria-hidden
        className="pointer-events-none mx-auto h-16 w-[85%] rounded-b-[40px] opacity-40 blur-2xl"
        style={{
          background: `linear-gradient(to bottom, rgba(201,168,124,0.18), transparent)`,
        }}
      />
    </div>
  );
}
