/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        bg: {
          primary: 'var(--bg-primary, #08080f)',
          secondary: 'var(--bg-secondary, #0f0f1a)',
          card: 'var(--bg-card, #13131f)',
          hover: 'var(--bg-hover, #1a1a2e)',
        },
        accent: {
          red: 'var(--accent-red, #e50914)',
          redHover: 'var(--accent-red-hover, #f40612)',
          purple: 'var(--accent-purple, #8b5cf6)',
          purpleHover: 'var(--accent-purple-hover, #7c3aed)',
          cyan: 'var(--accent-cyan, #06b6d4)',
          green: '#10b981',
          yellow: '#f59e0b',
        },
        text: {
          primary: 'var(--text-primary, #f1f1f1)',
          secondary: 'var(--text-secondary, #a0a0b8)',
          muted: '#5a5a7a',
        },
        border: {
          dark: 'var(--border-dark, #1e1e30)',
          light: 'var(--border-light, #2a2a40)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
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
