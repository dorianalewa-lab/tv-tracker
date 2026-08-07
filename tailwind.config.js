/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d10',
        surface: '#15181d',
        border: '#242830',
        text: '#f5f5f7',
        muted: '#8b93a0',
        accent: '#f5c518',
      },
    },
  },
  plugins: [],
};
