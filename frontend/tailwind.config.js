/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        arena: {
          bg:      '#08081a',
          surface: '#0d0d25',
          card:    '#10102c',
          border:  '#1e1e58',
          accent:  '#a855f7',
          accent2: '#c084fc',
          cyan:    '#22d3ee',
          gold:    '#fbbf24',
          pink:    '#ec4899',
        },
      },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(40px)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'pop': {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        'timer-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        'panel-in': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'streak-pop': {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.18s ease-out',
        'fade-in':        'fade-in 0.25s ease-out',
        'pop':            'pop 0.15s ease-out',
        'timer-pulse':    'timer-pulse 1s ease-in-out infinite',
        'panel-in':       'panel-in 0.22s ease-out',
        'streak-pop':     'streak-pop 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
