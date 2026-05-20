export default function InternalBackground() {
  // Cor derivada do brand token — segue tema light/dark e mudanças de identidade.
  const blob = 'radial-gradient(circle, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.22) 0%, transparent 75%)';
  const glowStrong = 'radial-gradient(circle, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.05) 0%, transparent 70%)';
  const glowSoft = 'radial-gradient(circle, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.03) 0%, transparent 70%)';

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      <div className="w-full h-full opacity-90 dark:opacity-25">
        <div
          className="absolute animate-eclipse-float"
          style={{
            top: '20%',
            right: '-5%',
            width: 'min(50vw, 800px)',
            height: 'min(50vw, 800px)',
            background: blob,
            filter: 'blur(22px)',
            borderRadius: '50%',
          }}
        />

        <div
          className="absolute animate-eclipse-float-reverse"
          style={{
            top: '40%',
            left: '-5%',
            width: 'min(35vw, 550px)',
            height: 'min(35vw, 550px)',
            background: blob,
            filter: 'blur(20px)',
            borderRadius: '50%',
          }}
        />

        <div
          className="absolute"
          style={{
            top: '15%',
            right: '-10%',
            width: 'min(60vw, 1000px)',
            height: 'min(60vw, 1000px)',
            background: glowStrong,
            filter: 'blur(45px)',
            borderRadius: '50%',
          }}
        />

        <div
          className="absolute"
          style={{
            top: '35%',
            left: '-10%',
            width: 'min(45vw, 700px)',
            height: 'min(45vw, 700px)',
            background: glowSoft,
            filter: 'blur(40px)',
            borderRadius: '50%',
          }}
        />
      </div>

      <svg className="absolute inset-0 w-full h-full opacity-[0.045]" aria-hidden="true">
        <filter id="internal-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#internal-noise)" />
      </svg>
    </div>
  );
}
