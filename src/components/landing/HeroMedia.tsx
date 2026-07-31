import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { TOKENS } from "./primitives";

/**
 * HeroBackgroundVideo — vídeo em loop como FUNDO da hero (full-bleed).
 *
 * Camadas: vídeo → overlay de legibilidade → (conteúdo fica acima, z-10).
 *
 * Performance:
 * - `poster` é o LCP; o vídeo só entra depois do primeiro paint (idle).
 * - Fonte separada para mobile (720p leve) e desktop (1080p).
 * - Respeita `prefers-reduced-motion` e `saveData`/2g-3g → só poster.
 *
 * Arquivos esperados em /public/media (opcionais — sem eles fica só o fundo):
 *   hero-1080.mp4 · hero-720.mp4 · hero-poster.jpg
 */
export function HeroBackgroundVideo({
  srcDesktop = "/media/hero-1080.mp4",
  srcMobile = "/media/hero-720.mp4",
  poster = "/media/hero-poster.jpg",
}: {
  srcDesktop?: string;
  srcMobile?: string;
  poster?: string;
}) {
  const reduce = useReducedMotion();
  const [allowVideo, setAllowVideo] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const conn = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /2g|3g/.test(conn.effectiveType)) return;

    const idle =
      (window as Window & { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    const id = idle(() => setAllowVideo(true));
    return () => {
      if (typeof id === "number") window.clearTimeout(id);
    };
  }, [reduce]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base sólida — garante contraste mesmo sem mídia */}
      <div className="absolute inset-0" style={{ background: TOKENS.obsidian }} />

      {allowVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
        >
          <source src={srcDesktop} media="(min-width: 768px)" type="video/mp4" />
          <source src={srcMobile} type="video/mp4" />
        </video>
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${poster})` }}
        />
      )}

      {/* overlay de legibilidade (vertical + lateral esquerda) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.58) 45%, rgba(10,10,10,0.94) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.55) 45%, rgba(10,10,10,0.25) 100%)",
        }}
      />

      {/* feixe dourado difuso */}
      <div
        className="absolute -top-40 right-[-10%] h-[520px] w-[720px] opacity-[0.16] blur-3xl"
        style={{
          background: `radial-gradient(closest-side, ${TOKENS.gold}, transparent 70%)`,
        }}
      />
    </div>
  );
}

/** Compat: nome antigo usado por imports existentes. */
export const HeroMedia = HeroBackgroundVideo;
