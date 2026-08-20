import React from 'react';

interface TitleCompositionProps {
  line1: string;
  line2: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
}

export function TitleComposition({
  line1,
  line2,
  fontSize,
  color,
  fontFamily,
}: TitleCompositionProps) {
  const serifStyle = fontFamily
    ? { fontFamily }
    : { fontFamily: "'Bodoni Moda', 'Cormorant Garamond', 'Playfair Display', 'Instrument Serif', Didot, 'Times New Roman', serif" };

  return (
    <div
      className="select-none pointer-events-none tracking-[-0.03em] leading-[0.84] uppercase transition-colors duration-500"
      style={{
        ...serifStyle,
        fontSize: `${fontSize}px`,
        color,
      }}
    >
      <div className="block whitespace-nowrap">{line1}</div>
      {line2 && <div className="block mt-[0.05em] whitespace-nowrap">{line2}</div>}
    </div>
  );
}
