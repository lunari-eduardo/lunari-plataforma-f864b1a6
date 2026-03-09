import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COPPER = '#F28C52';

interface RingProps {
  tube: number;
  initialRotation: [number, number, number];
  speed: number;
  opacityLight: number;
  opacityDark: number;
  isDark: boolean;
  showSphere?: boolean;
}

function OrbitalRing({ tube, initialRotation, speed, opacityLight, opacityDark, isDark, showSphere }: RingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() * speed;
    groupRef.current.rotation.x = initialRotation[0] + t * 0.3;
    groupRef.current.rotation.y = initialRotation[1] + t;
    groupRef.current.rotation.z = initialRotation[2] + t * 0.15;

    if (sphereRef.current) {
      const angle = t * 2;
      sphereRef.current.position.set(
        Math.cos(angle) * 6.0,
        Math.sin(angle) * 6.0,
        0
      );
    }
  });

  const opacity = isDark ? opacityDark : opacityLight;
  const sphereOpacity = isDark ? 0.25 : 0.6;

  return (
    <group ref={groupRef}>
      <mesh>
        <torusGeometry args={[6.0, tube, 16, 120]} />
        <meshBasicMaterial color={COPPER} transparent opacity={opacity} />
      </mesh>
      {showSphere && (
        <mesh ref={sphereRef}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={COPPER} transparent opacity={sphereOpacity} />
        </mesh>
      )}
    </group>
  );
}

interface Props {
  isDark: boolean;
}

export default function DashboardThreeCanvas({ isDark }: Props) {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
      >
        {/* Ring 1: diagonal */}
        <OrbitalRing
          tube={0.02}
          initialRotation={[0.8, 0.3, 0.1]}
          speed={2 * Math.PI / 72}
          opacityLight={0.25}
          opacityDark={0.08}
          isDark={isDark}
          showSphere
        />
        {/* Ring 2: vertical */}
        <OrbitalRing
          tube={0.018}
          initialRotation={[1.5, 0.7, 0.4]}
          speed={2 * Math.PI / 96}
          opacityLight={0.18}
          opacityDark={0.06}
          isDark={isDark}
          showSphere
        />
        {/* Ring 3: horizontal */}
        <OrbitalRing
          tube={0.025}
          initialRotation={[0.2, 1.2, 0.8]}
          speed={2 * Math.PI / 120}
          opacityLight={0.35}
          opacityDark={0.12}
          isDark={isDark}
        />
        {/* Ring 4: tilted */}
        <OrbitalRing
          tube={0.012}
          initialRotation={[1.0, 0.5, 1.3]}
          speed={2 * Math.PI / 144}
          opacityLight={0.12}
          opacityDark={0.06}
          isDark={isDark}
        />
      </Canvas>
    </div>
  );
}
