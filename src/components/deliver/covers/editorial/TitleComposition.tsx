import React from 'react';

interface TitleCompositionProps {
  line1: string;
  line2: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
}

export function TitleComposition({
  line1,
  line2,
  fontSize,
  color,
  fontFamily,
  align = 'left',
}: TitleCompositionProps) {
  const alignClass = align === 'center' ? 'flex flex-col items-center text-center' : align === 'right' ? 'flex flex-col items-end text-right' : 'flex flex-col items-start text-left';
  
  const serifStyle = fontFamily
    ? { fontFamily }
    : { fontFamily: "'Bodoni Moda', 'Cormorant Garamond', 'Playfair Display', 'Instrument Serif', Didot, 'Times New Roman', serif" };

  return (
    <div
      className={`select-none pointer-events-none tracking-[-0.03em] leading-[0.84] uppercase transition-colors duration-500 ${alignClass}`}
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
