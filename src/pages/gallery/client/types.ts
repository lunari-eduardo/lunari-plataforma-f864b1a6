export type SelectionStep = 'gallery' | 'confirmation' | 'pre_checkout_contact' | 'payment' | 'confirmed';

export const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsbmpzcHN5d3ljYnVkaGV3c2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjU1MDEsImV4cCI6MjA3MzA0MTUwMX0.LR_nMBh8cVY1SQS1TsB7RrGQ1zmCRm_bDvyfI5Dn1QI';

// Helper to convert HEX to HSL values for CSS variables
export function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Check if the param is a UUID (legacy) or token (new)
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export interface PendingConfirmPayload {
  selectedCount: number;
  extraCount: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface PaymentInfo {
  checkoutUrl: string;
  provedor: string;
  valorTotal: number;
}

export interface PixPaymentData {
  chavePix: string;
  nomeTitular: string;
  tipoChave?: string;
  valorTotal: number;
}
