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

const COLOR_MAP: Record<string, string> = {
  marrom: '#5F3624',
  azul: '#1c4274',
  verde: '#98b281',
  terracota: '#893806',
  rosa: '#d8a4ce',
  cinza: '#494949',
  lilas: '#beb7fb',
  bege: '#dbbd96',
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { preferences, getPreferencesOrDefault } = useUserPreferences()

  const effective = useMemo(() => preferences ?? getPreferencesOrDefault(), [preferences, getPreferencesOrDefault])

  useEffect(() => {
    const root = document.documentElement

    const baseHex = effective.temaCorHex || COLOR_MAP[effective.temaCor] || COLOR_MAP.marrom
    const baseHsl = hexToHsl(baseHex)
    const hoverHsl = darkenHsl(baseHsl, 8)
    const foregroundHsl = readableForegroundHslFromHex(baseHex)

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

    // Gráficos (paleta fixa com cores marrons)
    const chartPalette = [
      '#5F3624', // Principal
      '#784A2B', // Secundária
      '#442F21', // Terciária
      '#7A4430', // Quaternária
      '#834A2F', // Quinária
      '#965D38', // Senária
      '#B48260', // Sétima
      '#E1C7AC', // Oitava
      '#D0C8B8', // Nona
      '#F6F0EC'  // Décima
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
  }, [effective.temaCor, effective.temaCorHex])

  // Apply dark mode class based on preferences.tema ('claro' | 'escuro' | 'sistema')
  useEffect(() => {
    const root = document.documentElement
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const isDark = effective.tema === 'escuro' || (effective.tema === 'sistema' && !!mql?.matches)
      root.classList.toggle('dark', isDark)
    }
    apply()
    if (effective.tema === 'sistema' && mql) {
      const listener = () => apply()
      mql.addEventListener?.('change', listener)
      return () => mql.removeEventListener?.('change', listener)
    }
  }, [effective.tema])

  return <>{children}</>
}
