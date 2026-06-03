/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        bg: { DEFAULT: '#07070f', 2: '#0f0f1e', 3: '#16162a', 4: '#1e1e35', 5: '#252540' },
        accent: { DEFAULT: '#7c6df0', 2: '#a594f9', 3: '#c8beff' },
        success: { DEFAULT: '#00d2c8', 2: '#55edd8' },
        warn: '#f0c060',
        danger: '#ff6b6b',
        muted: { DEFAULT: '#6868a0', 2: '#9090b8' },
      },
      animation: {
        'fade-up': 'fadeUp 0.2s ease',
        'pulse-dot': 'pulseDot 1.2s infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,80%,100%': { opacity: 0.3, transform: 'translateY(0)' }, '40%': { opacity: 1, transform: 'translateY(-6px)' } },
      },
    },
  },
  plugins: [],
}
