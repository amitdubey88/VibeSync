/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core palette (legacy)
        bg: {
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          hover: 'rgb(var(--bg-hover) / <alpha-value>)',
        },
        accent: {
          red: 'rgb(var(--accent-red) / <alpha-value>)',
          redHover: 'rgb(var(--accent-red-hover) / <alpha-value>)',
          purple: 'rgb(var(--accent-purple) / <alpha-value>)',
          purpleHover: 'rgb(var(--accent-purple-hover) / <alpha-value>)',
          cyan: 'rgb(var(--accent-cyan) / <alpha-value>)',
          green: '#10b981',
          yellow: '#f59e0b',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: '#5a5a7a',
        },
        border: {
          dark: 'rgb(var(--border-dark) / <alpha-value>)',
          light: 'rgb(var(--border-light) / <alpha-value>)',
        },
        // Cinematic Obsidian Palette (Stitch)
        obsidian: {
          background: 'rgb(var(--obsidian-bg) / <alpha-value>)',
          surface: 'rgb(var(--obsidian-surface) / <alpha-value>)',
          'surface-bright': 'rgb(var(--obsidian-surface-bright) / <alpha-value>)',
          'surface-dim': 'rgb(var(--obsidian-surface-dim) / <alpha-value>)',
          'surface-low': 'rgb(var(--obsidian-surface-low) / <alpha-value>)',
          'surface-container': 'rgb(var(--obsidian-surface-container) / <alpha-value>)',
          'surface-high': 'rgb(var(--obsidian-surface-high) / <alpha-value>)',
          'surface-highest': 'rgb(var(--obsidian-surface-highest) / <alpha-value>)',
          primary: 'rgb(var(--obsidian-primary) / <alpha-value>)',
          'primary-dim': 'rgb(var(--obsidian-primary-dim) / <alpha-value>)',
          'primary-container': 'rgb(var(--obsidian-primary-container) / <alpha-value>)',
          secondary: 'rgb(var(--obsidian-secondary) / <alpha-value>)',
          'secondary-dim': 'rgb(var(--obsidian-secondary-dim) / <alpha-value>)',
          'secondary-container': 'rgb(var(--obsidian-secondary-container) / <alpha-value>)',
          tertiary: 'rgb(var(--obsidian-tertiary) / <alpha-value>)',
          'tertiary-dim': 'rgb(var(--obsidian-tertiary-dim) / <alpha-value>)',
          'tertiary-container': 'rgb(var(--obsidian-tertiary-container) / <alpha-value>)',
          error: 'rgb(var(--obsidian-error) / <alpha-value>)',
          'error-dim': 'rgb(var(--obsidian-error-dim) / <alpha-value>)',
          'error-container': 'rgb(var(--obsidian-error-container) / <alpha-value>)',
          outline: 'rgb(var(--obsidian-outline) / <alpha-value>)',
          'outline-variant': 'rgb(var(--obsidian-outline-variant) / <alpha-value>)',
          'on-surface': 'rgb(var(--obsidian-surface) / <alpha-value>)',
          'on-surface-variant': 'rgb(var(--obsidian-on-surface-variant) / <alpha-value>)',
          'on-primary': 'rgb(var(--obsidian-primary) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        headline: ['"Space Grotesk"', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'ripple': 'ripple 0.6s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'ping-once': 'pingOnce 0.6s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(229, 9, 20, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(229, 9, 20, 0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        pingOnce: {
          '0%':   { transform: 'scale(0.8)', opacity: '1' },
          '60%':  { transform: 'scale(1.3)', opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        // Design system radius tokens
        sm:  '6px',
        md:  '10px',
        lg:  '12px',   // standard interactive elements: buttons, inputs
        xl:  '16px',   // cards, panels, modals
        '2xl': '20px', // large cards, overlays
        full: '9999px',
      },
      boxShadow: {
        // Named shadow tokens — use these everywhere, not arbitrary shadows
        none:     'none',
        card:     '0 4px 16px rgba(0,0,0,0.4)',
        floating: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        modal:    '0 24px 64px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)',
        hover:    '0 4px 15px rgba(139,92,246,0.15)',
        'glow-red':    '0 0 20px rgba(229,9,20,0.4)',
        'glow-purple': '0 0 20px rgba(139,92,246,0.4)',
        'glow-cyan':   '0 0 20px rgba(6,182,212,0.4)',
        'glow-green':  '0 0 12px rgba(16,185,129,0.5)',
        inner: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
