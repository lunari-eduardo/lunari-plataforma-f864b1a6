
export const SITE_COLORS = {
  // Brand
  gold: "#C9A87C",
  goldPale: "#E4CFA8",
  goldDeep: "#9A7F52",

  // Dark Surface (Remix Graphite)
  graphite: "#262421",
  graphiteSoft: "#2E2B27",
  lineDark: "rgba(255,255,255,0.10)",
  onDark: "#F2EDE4",
  onDarkMuted: "#B9B1A4",

  // Light Surface (Remix Offwhite/Warmwhite)
  offwhite: "#F4F1EA",
  warmwhite: "#FBFAF7",
  lineLight: "rgba(10,10,10,0.10)",
  ink: "#2A2724",
  inkMuted: "#7C766D",
} as const;

export const SITE_THEME = {
  ease: [0.16, 1, 0.3, 1] as const,
  fonts: {
    display: '"Instrument Serif", serif',
    ui: '"Geist", "Inter Tight", sans-serif',
    mono: '"Geist Mono", monospace',
  }
};
