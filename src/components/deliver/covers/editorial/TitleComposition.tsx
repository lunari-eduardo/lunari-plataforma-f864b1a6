import React from 'react';

interface TitleCompositionProps {
  line1: string;
  line2: string;
  subtitle?: string;
  fontSizePx: number;
  color: string;
  fontFamily: string;
}

/**
 * Componente puro que renderiza o bloco tipográfico do título e subtítulo.
 * Garante que tanto a camada base quanto a camada recortada (clip-path)
 * renderizem exatamente os mesmos elementos na mesma posição.
 */
export function TitleComposition({
  line1,
  line2,
  subtitle,
  fontSizePx,
  color,
  fontFamily,
}: TitleCompositionProps) {
  return (
    <div
      className="font-normal tracking-[-0.015em] leading-[0.94] transition-colors duration-300 pointer-events-none select-none"
      style={{
        fontFamily,
        color,
        fontSize: `${fontSizePx}px`,
      }}
    >
      <h1 className="block m-0 p-0 whitespace-nowrap">{line1}</h1>
      {line2 && (
        <h2 
          className="block m-0 p-0 whitespace-nowrap" 
          style={{ marginTop: '0.1em' }}
        >
          {line2}
        </h2>
      )}

      {subtitle && (
        <div style={{ marginTop: `${Math.max(16, fontSizePx * 0.28)}px` }}>
          <p 
            className="text-[10px] md:text-xs font-sans tracking-[0.32em] font-light uppercase opacity-75 transition-colors duration-300"
            style={{ color }}
          >
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
}
