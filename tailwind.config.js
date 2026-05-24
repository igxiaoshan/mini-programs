/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fffaf0',
          100: '#fff4dc',
          200: '#ffe8b8',
          300: '#ffd889',
        },
        peach: '#ff8a6a',
        tomato: '#ef5c45',
        mint: '#8fcfb1',
        soy: '#7b5140',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(139, 82, 49, 0.12)',
        tabbar: '0 -10px 30px rgba(117, 79, 48, 0.08)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        flipCard: {
          '0%': { transform: 'rotateY(0deg) scale(1)' },
          '50%': { transform: 'rotateY(90deg) scale(0.98)' },
          '100%': { transform: 'rotateY(0deg) scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        floaty: 'floaty 3.2s ease-in-out infinite',
        flipCard: 'flipCard 0.62s ease-in-out',
        slideUp: 'slideUp 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
