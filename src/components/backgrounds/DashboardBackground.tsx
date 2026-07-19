import { useIsDarkMode } from '@/hooks/useIsDarkMode';

/**
 * Dashboard background — degradê sólido tokenizado.
 * Substitui o antigo canvas 3D (three.js) por um fundo estático leve,
 * coerente com a identidade Lunari em light e dark mode.
 */
export default function DashboardBackground() {
  const isDark = useIsDarkMode();

  const background = isDark
    ? `radial-gradient(1000px 700px at 15% 110%,
         hsl(var(--brand-h) var(--brand-s) var(--brand-glow-l) / 0.08),
         transparent 65%),
       linear-gradient(135deg,
         hsl(var(--surface-0)) 0%,
         hsl(var(--surface-1)) 50%,
         hsl(var(--surface-0)) 100%)`
    : `radial-gradient(1200px 800px at 85% -10%,
         hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.10),
         transparent 60%),
       linear-gradient(135deg,
         hsl(var(--surface-2)) 0%,
         hsl(var(--surface-1)) 55%,
         hsl(var(--surface-2)) 100%)`;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{ background }}
      />
      <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
        <filter id="dashboard-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dashboard-noise)" />
      </svg>
    </div>
  );
}
