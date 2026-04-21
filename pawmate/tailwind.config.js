/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        rubik: ['Rubik', 'sans-serif'],
        assistant: ['Assistant', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: '#FF6B6B',
          secondary: '#4ECDC4',
          accent: '#FFE66D',
          dark: '#2D3436',
          light: '#F8F9FA',
        },
      },
    },
  },
  plugins: [require('tailwindcss-rtl')],
};
