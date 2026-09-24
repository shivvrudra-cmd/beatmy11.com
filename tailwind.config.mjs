/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // BeatMy11 brand colors (existing scales — referenced across the codebase)
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        // BeatMy11 dark-first brand palette.
        // Mirrors the --bm11-* CSS custom properties in src/styles/globals.css.
        brand: {
          bg: '#070B14',
          surface: '#0D1424',
          elevated: '#141D33',
          border: 'rgba(148, 163, 184, 0.14)',
          text: '#F1F5F9',
          muted: '#94A3B8',
          primary: '#22C55E',
          'primary-strong': '#16A34A',
          ring: '#4ADE80',
          danger: '#EF4444',
          warning: '#F59E0B',
          success: '#22C55E',
        },
        // Championship gold
        gold: {
          DEFAULT: '#C9A227',
          soft: '#E2C15C',
          deep: '#8A6F1C',
        },
        // Era accents. Keys must be valid Tailwind identifiers, so the
        // decades use word forms (e.g. `bg-era-nineties`).
        // Mirrors the --era-* CSS custom properties and src/lib/design-tokens.ts.
        era: {
          legends: '#C9A227',
          seventies: '#C26936',
          eighties: '#D64045',
          nineties: '#2AA198',
          noughties: '#3B82F6',
          tens: '#8B5CF6',
          twenties: '#2DD4BF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
