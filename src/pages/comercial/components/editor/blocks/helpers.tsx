import React from 'react';
import { fontDisplayCss, fontBodyCss } from '../../../blocks/design';

export const fd = () => ({ fontFamily: fontDisplayCss() });
export const fb = () => ({ fontFamily: fontBodyCss() });

export type CtaHandler = (ctx: { blockType: string; label?: string }) => void;

// ---- Helpers de layout (props.align / props.background) ----

export const ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

export const alignClass = (align?: string, fallback = 'left') => ALIGN_CLASS[align ?? ''] ?? fallback;

export function sectionBg(bg: string | undefined, fallback: string): string {
  switch (bg ?? fallback) {
    case 'cream':
      return 'bg-[var(--pa-cream,#F3F0EA)]';
    case 'linen':
      return 'bg-[var(--pa-linen,#E8DCCB)]';
    case 'dark':
      return 'bg-[var(--pa-stone,#2C2825)]';
    case 'white':
    default:
      return 'bg-[var(--pa-white,#FDFBF7)]';
  }
}

export function textColorClass(textColor: string | undefined, bg: string | undefined, fallbackBg: string): string {
  if (textColor === 'dark') return 'text-neutral-900';
  if (textColor === 'black') return 'text-black';
  if (textColor === 'light') return 'text-white';
  if (textColor === 'warm') return 'text-[var(--pa-taupe,#8C7B6E)]';
  if (textColor === 'accent') return 'text-[var(--pa-accent,#7A5C42)]';

  // default / automatic:
  const resolvedBg = bg ?? fallbackBg;
  return resolvedBg === 'dark' ? 'text-white' : 'text-neutral-900';
}

// ---------------------------------------------------------
// Observer de Blocos para Rastreio
// ---------------------------------------------------------

export function BlockObserver({
  children,
  blockId,
  blockType,
  position,
  onView,
}: {
  children: React.ReactNode;
  blockId: string;
  blockType: string;
  position: number;
  onView?: (blockId: string, blockType: string, position: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [viewed, setViewed] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current || viewed || !onView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onView(blockId, blockType, position);
          setViewed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [viewed, onView, blockId, blockType, position]);

  return <div ref={ref} className="h-full w-full">{children}</div>;
}
