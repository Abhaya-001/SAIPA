import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: colors.neutral,
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        saipa: {
          void: '#030712',
          deep: '#0a0f1a',
          surface: '#0f172a',
          panel: '#111827',
          border: 'rgba(34, 211, 238, 0.12)',
          glow: 'rgba(34, 211, 238, 0.25)',
          core: '#22d3ee',
          orbit: 'rgba(148, 163, 184, 0.15)',
          star: 'rgba(226, 232, 240, 0.6)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.45s ease-out forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'orbit-slow': 'orbitRotate 120s linear infinite',
        'orbit-medium': 'orbitRotate 80s linear infinite reverse',
        'orbit-fast': 'orbitRotate 50s linear infinite',
        'core-pulse': 'corePulse 4s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        orbitRotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        corePulse: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        saipa: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      boxShadow: {
        'saipa': '0 0 0 1px rgba(34, 211, 238, 0.08), 0 4px 24px -4px rgba(0, 0, 0, 0.4)',
        'saipa-hover': '0 0 0 1px rgba(34, 211, 238, 0.18), 0 8px 32px -4px rgba(34, 211, 238, 0.08), 0 4px 24px -4px rgba(0, 0, 0, 0.5)',
        'saipa-glow': '0 0 20px rgba(34, 211, 238, 0.15)',
      },
      backgroundImage: {
        'saipa-radial': 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34, 211, 238, 0.06) 0%, transparent 60%)',
        'saipa-grid': 'linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '48px 48px',
      },
    },
  },
  plugins: [],
}
