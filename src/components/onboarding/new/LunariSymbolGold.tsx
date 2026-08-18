import React from 'react';

interface LunariSymbolGoldProps {
  className?: string;
  size?: number;
}

export function LunariSymbolGold({ className = '', size = 72 }: LunariSymbolGoldProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Gradiente Metálico Topo (Champagne/Ouro Claro) */}
        <linearGradient id="lunariGoldTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EADBCE" />
          <stop offset="40%" stopColor="#D8BE9B" />
          <stop offset="100%" stopColor="#B38D56" />
        </linearGradient>

        {/* Gradiente Metálico Inferior Esquerdo (Ouro Quente) */}
        <linearGradient id="lunariGoldBottomLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#CFA468" />
          <stop offset="60%" stopColor="#C49757" />
          <stop offset="100%" stopColor="#A87A3D" />
        </linearGradient>

        {/* Gradiente Metálico Inferior Direito (Ouro Médio / Reflexo) */}
        <linearGradient id="lunariGoldBottomRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4A86C" />
          <stop offset="50%" stopColor="#C29452" />
          <stop offset="100%" stopColor="#9E7238" />
        </linearGradient>

        {/* Filtro de Glow Suave */}
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Triângulo Superior Esquerdo */}
      <polygon
        points="0,0 50,0 0,50"
        fill="url(#lunariGoldTop)"
      />

      {/* 2. Triângulo Inferior Esquerdo */}
      <polygon
        points="0,50 0,100 50,100"
        fill="url(#lunariGoldBottomLeft)"
      />

      {/* 3. Triângulo Inferior Direito */}
      <polygon
        points="50,100 100,50 100,100"
        fill="url(#lunariGoldBottomRight)"
      />
    </svg>
  );
}
