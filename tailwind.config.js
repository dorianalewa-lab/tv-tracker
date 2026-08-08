/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0812',
        surface: '#16121e',
        border: 'rgba(255,255,255,0.08)',
        text: '#f5f5f7',
        muted: '#9ea0b5',
        // Violet pastel — palette Liquid Glass
        accent: '#a78bfa',
        'accent-strong': '#8b5cf6',
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
