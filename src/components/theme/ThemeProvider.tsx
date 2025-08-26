import React, { useEffect, useMemo } from 'react'
import { useUserPreferences } from '@/hooks/useUserProfile'

// Util: HEX -> { h, s, l }
function hexToHsl(hex: string) {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(normalized, 16)
  const r = ((bigint >> 16) & 255) / 255
  const g = ((bigint >> 8) & 255) / 255
  const b = (bigint & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

// Util: escurece HSL pela porcentagem (0-100)
function darkenHsl(hsl: { h: number; s: number; l: number }, amount = 8) {
  const l = Math.max(0, hsl.l - amount)
  return { h: hsl.h, s: hsl.s, l }
}

// Util: cor de texto legível para o HEX (retorna HSL string)
function readableForegroundHslFromHex(hex: string) {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(normalized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  // Perceived brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  // Retorna branco para cores escuras e quase-preto para cores claras
  return brightness < 155 ? '0 0% 100%' : '0 0% 12%'
}

// Helpers para gerar paleta dinâmica baseada na cor base
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
function shiftHue(h: number, delta: number) {
  const v = (h + delta) % 360
  return v < 0 ? v + 360 : v
}
function toHslStr(hsl: { h: number; s: number; l: number }) {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`
}

const FIXED_COLOR = '#ac5e3a';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement

    const baseHsl = hexToHsl(FIXED_COLOR)
    const hoverHsl = darkenHsl(baseHsl, 8)
    const foregroundHsl = readableForegroundHslFromHex(FIXED_COLOR)

    const hslStr = `${baseHsl.h} ${baseHsl.s}% ${baseHsl.l}%`
    const hoverStr = `${hoverHsl.h} ${hoverHsl.s}% ${hoverHsl.l}%`

    root.style.setProperty('--lunar-accent', hslStr)
    root.style.setProperty('--lunar-accentHover', hoverStr)
    root.style.setProperty('--ring', hslStr)

    // shadcn primary tokens
    root.style.setProperty('--primary', hslStr)
    root.style.setProperty('--primary-foreground', foregroundHsl)

    // Foreground específico para o accent (botões customizados)
    root.style.setProperty('--lunar-accent-foreground', foregroundHsl)

    // Gráficos (paleta baseada na nova cor fixa)
    const chartPalette = [
      '#ac5e3a', // Principal (nova cor)
      '#bd6b42', // Secundária
      '#8b5232', // Terciária
      '#c17249', // Quaternária
      '#d47e51', // Quinária
      '#e68a59', // Senária
      '#f29661', // Sétima
      '#ffa269', // Oitava
      '#ffae71', // Nona
      '#ffba79'  // Décima
    ].map(hex => {
      const hsl = hexToHsl(hex)
      return toHslStr(hsl)
    })

    root.style.setProperty('--chart-primary', chartPalette[0])
    root.style.setProperty('--chart-secondary', chartPalette[1])
    root.style.setProperty('--chart-tertiary', chartPalette[2])
    root.style.setProperty('--chart-quaternary', chartPalette[3])
    root.style.setProperty('--chart-quinary', chartPalette[4])
    root.style.setProperty('--chart-senary', chartPalette[5])
    root.style.setProperty('--chart-revenue', chartPalette[0])
    root.style.setProperty('--chart-expense', chartPalette[2])
    root.style.setProperty('--chart-profit', chartPalette[0])
    root.style.setProperty('--chart-neutral', chartPalette[7])

    // Always use system theme preference (no user override)
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      root.classList.toggle('dark', !!mql?.matches)
    }
    apply()
    if (mql) {
      const listener = () => apply()
      mql.addEventListener?.('change', listener)
      return () => mql.removeEventListener?.('change', listener)
    }
  }, [])

  return <>{children}</>
}
