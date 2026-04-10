/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F4F8F6',
          border: '#D7E4DE',
          teal: '#2F7A6A',
          'teal-dark': '#255F53',
          ink: '#1E2B28',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 18px 40px -24px rgba(24, 43, 39, 0.38)',
      },
      animation: {
        blink: 'blink 1s step-end infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
