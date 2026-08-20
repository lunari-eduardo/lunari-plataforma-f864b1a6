import React from 'react';

interface TitleCompositionProps {
  line1: string;
  line2: string;
  fontSizePx: number;
  color: string;
  fontFamily: string;
}

/**
 * Componente puro que renderiza o bloco tipográfico do título.
 * Depende EXCLUSIVAMENTE das props recebidas (sem media queries ou hooks internos).
 * Garante que as camadas de fundo e de sobreposição renderizem os exatos mesmos pixels.
 */
export function TitleComposition({
  line1,
  line2,
  fontSizePx,
  color,
  fontFamily,
}: TitleCompositionProps) {
  return (
    <div
      className="font-normal tracking-[-0.04em] leading-[0.88] transition-colors duration-300 pointer-events-none select-none"
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
          style={{ marginTop: '0.12em' }} // Espaçamento estritamente proporcional
        >
          {line2}
        </h2>
      )}
    </div>
  );
}
