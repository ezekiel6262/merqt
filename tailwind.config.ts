import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plex-sans)', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        serif: ['var(--font-source-serif)', 'Source Serif 4', 'serif'],
        mono: ['var(--font-plex-mono)', 'IBM Plex Mono', 'monospace'],
      },
      colors: {
        // Merqt "Woven Ledger" design system - indigo/ochre, warm neutral base
        merqt: {
          bg: 'oklch(0.97 0.012 70)',
          surface: 'oklch(0.995 0.004 70)',
          border: 'oklch(0.85 0.015 70)',
          'border-strong': 'oklch(0.7 0.02 70)',
          text: 'oklch(0.22 0.015 70)',
          'text-muted': 'oklch(0.5 0.01 70)',
          indigo: 'oklch(0.4 0.1 265)',
          'indigo-dark': 'oklch(0.28 0.09 265)',
          'indigo-soft': 'oklch(0.92 0.03 265)',
          ochre: 'oklch(0.65 0.13 75)',
          'ochre-dark': 'oklch(0.42 0.11 75)',
          'ochre-soft': 'oklch(0.92 0.06 75)',
          success: 'oklch(0.5 0.12 150)',
          'success-dark': 'oklch(0.32 0.09 150)',
          'success-soft': 'oklch(0.9 0.045 150)',
        },
      },
      borderRadius: {
        card: '6px',
        pill: '4px',
      },
    },
  },
  plugins: [],
}

export default config