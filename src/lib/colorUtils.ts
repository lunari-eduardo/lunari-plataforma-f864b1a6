/**
 * Utilitários de Cor — Lunari Design System
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number; // 0 a 360
  s: number; // 0 a 100
  v: number; // 0 a 100
}

/**
 * Converte hex para RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

/**
 * Converte RGB para Hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (val: number) => clamp(val).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converte RGB para HSV
 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 100);
  const v = Math.round(max * 100);

  return { h, s, v };
}

/**
 * Converte HSV para RGB
 */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const sNorm = s / 100;
  const vNorm = v / 100;

  const c = vNorm * sNorm;
  const hPrime = (h % 360) / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = vNorm - c;

  let rNorm = 0;
  let gNorm = 0;
  let bNorm = 0;

  if (hPrime >= 0 && hPrime < 1) {
    rNorm = c; gNorm = x; bNorm = 0;
  } else if (hPrime >= 1 && hPrime < 2) {
    rNorm = x; gNorm = c; bNorm = 0;
  } else if (hPrime >= 2 && hPrime < 3) {
    rNorm = 0; gNorm = c; bNorm = x;
  } else if (hPrime >= 3 && hPrime < 4) {
    rNorm = 0; gNorm = x; bNorm = c;
  } else if (hPrime >= 4 && hPrime < 5) {
    rNorm = x; gNorm = 0; bNorm = c;
  } else if (hPrime >= 5 && hPrime < 6) {
    rNorm = c; gNorm = 0; bNorm = x;
  }

  return {
    r: Math.round((rNorm + m) * 255),
    g: Math.round((gNorm + m) * 255),
    b: Math.round((bNorm + m) * 255),
  };
}

/**
 * Converte HSV para Hex
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Converte Hex para HSV
 */
export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 36, s: 24, v: 82 }; // Padrão Dourado Lunari
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

/**
 * Calcula a luminância relativa de uma cor hex (WCAG 2.0)
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Retorna '#000000' ou '#FFFFFF' baseado no contraste
 */
export function getContrastColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  return luminance > 0.4 ? '#1A1614' : '#FAF9F7';
}
