import type { ComponentType } from 'react';

type Props = { className?: string };

const Frame: ComponentType<Props & { children: React.ReactNode }> = ({ className, children }) => (
  <svg viewBox="0 0 160 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="160" height="100" fill="hsl(var(--muted))" />
    {children}
  </svg>
);

export const FullscreenThumbnail: ComponentType<Props> = ({ className }) => (
  <Frame className={className}>
    <rect x="0" y="0" width="160" height="100" fill="hsl(var(--foreground))" opacity="0.15" />
    <rect x="40" y="44" width="80" height="6" fill="hsl(var(--foreground))" opacity="0.55" />
    <rect x="55" y="56" width="50" height="3" fill="hsl(var(--foreground))" opacity="0.35" />
  </Frame>
);

export const FloatingFrameThumbnail: ComponentType<Props> = ({ className }) => (
  <Frame className={className}>
    <rect x="14" y="12" width="132" height="58" fill="hsl(var(--foreground))" opacity="0.18" />
    <rect x="50" y="78" width="60" height="5" fill="hsl(var(--foreground))" opacity="0.55" />
    <rect x="62" y="88" width="36" height="3" fill="hsl(var(--foreground))" opacity="0.35" />
  </Frame>
);

export const SplitThumbnail: ComponentType<Props> = ({ className }) => (
  <Frame className={className}>
    <rect x="0" y="0" width="100" height="100" fill="hsl(var(--foreground))" opacity="0.18" />
    <rect x="108" y="34" width="40" height="3" fill="hsl(var(--foreground))" opacity="0.35" />
    <rect x="108" y="44" width="44" height="6" fill="hsl(var(--foreground))" opacity="0.55" />
    <rect x="108" y="56" width="32" height="3" fill="hsl(var(--foreground))" opacity="0.35" />
    <rect x="108" y="70" width="24" height="6" fill="none" stroke="hsl(var(--foreground))" strokeOpacity="0.4" />
  </Frame>
);

export const EditorialThumbnail: ComponentType<Props> = ({ className }) => (
  <Frame className={className}>
    {/* Photo frame: x: 0.50, y: 0.10, w: 0.45, h: 0.74 */}
    <rect x="80" y="10" width="72" height="74" fill="hsl(var(--foreground))" opacity="0.22" rx="1" />

    {/* Big dominant typography crossing into the photo (total width ~93, x: 10, yCenter: 50) */}
    {/* Outside photo (from x=10 to x=80, width 70) */}
    <rect x="10" y="37" width="70" height="9" fill="hsl(var(--foreground))" opacity="0.85" />
    <rect x="10" y="49" width="70" height="9" fill="hsl(var(--foreground))" opacity="0.85" />
    
    {/* Inside photo (from x=80 to x=103, width 23) */}
    <rect x="80" y="37" width="23" height="9" fill="hsl(var(--background))" opacity="0.95" />
    <rect x="80" y="49" width="16" height="9" fill="hsl(var(--background))" opacity="0.95" />

    {/* Subtitle (anchored under title) */}
    <rect x="10" y="66" width="28" height="2" fill="hsl(var(--foreground))" opacity="0.4" />

    {/* Bottom date and minimal CTA */}
    <rect x="10" y="88" width="34" height="2" fill="hsl(var(--foreground))" opacity="0.35" />
    <rect x="122" y="88" width="30" height="2" fill="hsl(var(--foreground))" opacity="0.55" />
  </Frame>
);
