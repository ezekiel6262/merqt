import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        li: {
          blue: '#0A66C2',
          'blue-dark': '#004182',
          'blue-bg': '#EEF3FB',
          green: '#057642',
          'green-bg': '#F0FAF5',
          gold: '#915907',
          red: '#CC1016',
          'red-bg': '#FDF2F2',
          page: '#F3F2EE',
          border: '#E0DFDC',
          'text-1': 'rgba(0,0,0,0.9)',
          'text-2': 'rgba(0,0,0,0.6)',
          'text-3': 'rgba(0,0,0,0.5)',
        },
      },
      borderRadius: {
        card: '8px',
        pill: '16px',
      },
    },
  },
  plugins: [],
}

export default config