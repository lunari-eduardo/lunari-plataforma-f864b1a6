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

const COLOR_MAP: Record<string, string> = {
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

    const baseHex = effective.temaCorHex || COLOR_MAP[effective.temaCor] || COLOR_MAP.azul
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

    // Gráficos
    root.style.setProperty('--chart-primary', hslStr)
    root.style.setProperty('--chart-revenue', hslStr)
  }, [effective.temaCor, effective.temaCorHex])

  return <>{children}</>
}
