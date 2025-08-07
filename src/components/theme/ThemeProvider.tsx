import React, { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { useUserPreferences } from '@/hooks/useUserProfile'

function ThemeSync() {
  const { preferences } = useUserPreferences()
  const { setTheme } = useTheme()

  useEffect(() => {
    const pref = preferences?.tema
    if (pref === 'escuro') setTheme('dark')
    else if (pref === 'claro') setTheme('light')
  }, [preferences?.tema, setTheme])

  return null
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeSync />
      {children}
    </NextThemesProvider>
  )
}
