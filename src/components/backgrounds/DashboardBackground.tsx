import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ─── 3D Orbital Scene — Premium Orbital Field ─── */
const COPPER = '#F28C52';

const RING_CONFIGS = [
  { initialRotation: [65 * Math.PI / 180, 0, 0] as [number, number, number], axis: 'y' as const, period: 72, direction: 1, tube: 0.025, opacityLight: 0.35, opacityDark: 0.12 },
  { initialRotation: [0, 45 * Math.PI / 180, 0] as [number, number, number], axis: 'x' as const, period: 96, direction: -1, tube: 0.015, opacityLight: 0.20, opacityDark: 0.08 },
  { initialRotation: [-40 * Math.PI / 180, 0, 0] as [number, number, number], axis: 'y' as const, period: 120, direction: 1, tube: 0.020, opacityLight: 0.25, opacityDark: 0.10 },
  { initialRotation: [0, 0, 30 * Math.PI / 180] as [number, number, number], axis: 'x' as const, period: 144, direction: -1, tube: 0.012, opacityLight: 0.12, opacityDark: 0.06 },
];

const SPHERE_CONFIGS = [
  { ringIndex: 0, offset: 0, size: 0.08 },
  { ringIndex: 2, offset: Math.PI, size: 0.08 },
];

function TorusRing({ index, isDark, children }: { index: number; isDark: boolean; children?: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  const cfg = RING_CONFIGS[index];
  const speed = (2 * Math.PI / cfg.period) * cfg.direction;

  useFrame((_, delta) => {
    if (cfg.axis === 'y') {
      ref.current.rotation.y += speed * delta;
    } else {
      ref.current.rotation.x += speed * delta;
    }
  });

  const opacity = isDark ? cfg.opacityDark : cfg.opacityLight;

  return (
    <group ref={ref} rotation={cfg.initialRotation}>
      <mesh>
        <torusGeometry args={[6.0, cfg.tube, 16, 120]} />
        <meshBasicMaterial color={COPPER} transparent opacity={opacity} />
      </mesh>
      {children}
    </group>
  );
}

function OrbitingSphere({ index, isDark }: { index: number; isDark: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const cfg = SPHERE_CONFIGS[index];
  const ringCfg = RING_CONFIGS[cfg.ringIndex];
  const orbitSpeed = (2 * Math.PI / ringCfg.period) * ringCfg.direction;
  const timeRef = useRef(cfg.offset);

  useFrame((_, delta) => {
    timeRef.current += delta * orbitSpeed;
    const angle = timeRef.current;
    ref.current.position.set(Math.cos(angle) * 6, Math.sin(angle) * 6, 0);
  });

  const opacity = isDark ? 0.25 : 0.6;

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[cfg.size, 16, 16]} />
      <meshBasicMaterial color={COPPER} transparent opacity={opacity} />
    </mesh>
  );
}

function OrbitalScene({ isDark }: { isDark: boolean }) {
  return (
    <group>
      <TorusRing index={0} isDark={isDark}>
        <OrbitingSphere index={0} isDark={isDark} />
      </TorusRing>
      <TorusRing index={1} isDark={isDark} />
      <TorusRing index={2} isDark={isDark}>
        <OrbitingSphere index={1} isDark={isDark} />
      </TorusRing>
      <TorusRing index={3} isDark={isDark} />
    </group>
  );
}

/* ─── Background with 3D orbits + glow + noise ─── */
export default function DashboardBackground() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Base gradient */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0D0A08 0%, #141010 50%, #0D0A08 100%)'
            : '#FFFFFF',
        }}
      />

      {/* 3D Canvas */}
      {!reducedMotion && (
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 10], fov: 60 }}
            gl={{ alpha: true, antialias: true }}
            style={{ background: 'transparent' }}
            dpr={[1, 1.5]}
          >
            <OrbitalScene isDark={isDark} />
          </Canvas>
        </div>
      )}

      {/* Aurora gradient */}
      <div
        className="absolute inset-[-20%] aurora-animate"
        style={{
          background: isDark
            ? `linear-gradient(120deg, rgba(242,170,100,0.05), transparent 50%),
               linear-gradient(240deg, rgba(255,200,140,0.04), transparent 50%),
               linear-gradient(0deg, rgba(230,180,130,0.03), transparent 60%)`
            : `linear-gradient(120deg, rgba(172,94,58,0.25), transparent 50%),
               linear-gradient(240deg, rgba(194,149,106,0.20), transparent 50%),
               linear-gradient(0deg, rgba(172,94,58,0.15), transparent 60%)`,
          filter: isDark ? 'blur(60px)' : 'blur(40px)',
        }}
      />

      {/* Noise overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
        <filter id="dashboard-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dashboard-noise)" />
      </svg>
    </div>
  );
}
