import { useRef, useMemo, Suspense, lazy } from 'react';
import { useTheme } from '@/hooks/useTheme';

// Lazy load Three.js canvas to avoid blocking initial render
const ThreeCanvas = lazy(() => import('./DashboardThreeCanvas'));

export default function DashboardBackground() {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  // Detect reduced motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0D0A08 0%, #141010 50%, #0D0A08 100%)'
            : '#FFFFFF',
        }}
      />

      {/* Three.js Canvas */}
      {!prefersReducedMotion && (
        <Suspense fallback={null}>
          <ThreeCanvas isDark={isDark} />
        </Suspense>
      )}

      {/* Aurora gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ animation: 'aurora 20s ease-in-out infinite' }}
      >
        {isDark ? (
          <>
            <div
              className="absolute top-0 right-0 w-[60%] h-[50%]"
              style={{
                background: 'radial-gradient(ellipse at 70% 20%, rgba(242, 140, 82, 0.04) 0%, transparent 70%)',
                filter: 'blur(60px)',
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-[50%] h-[40%]"
              style={{
                background: 'radial-gradient(ellipse at 30% 80%, rgba(194, 149, 106, 0.03) 0%, transparent 70%)',
                filter: 'blur(60px)',
              }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute top-0 right-0 w-[60%] h-[50%]"
              style={{
                background: 'radial-gradient(ellipse at 70% 20%, rgba(172, 94, 58, 0.15) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-[50%] h-[40%]"
              style={{
                background: 'radial-gradient(ellipse at 30% 80%, rgba(194, 149, 106, 0.20) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
          </>
        )}
      </div>

      {/* Noise overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02]" aria-hidden="true">
        <filter id="dashboard-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dashboard-noise)" />
      </svg>
    </div>
  );
}
