/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background:    '#0A0A0A',
        surface:       '#141414',
        surfaceHigh:   '#242424',
        card:          '#1C1C1C',
        border:        '#2A2A2A',
        gold:          '#C9A84C',
        goldLight:     '#E2B05F',
        goldDark:      '#8B6914',
        goldMuted:     '#8B6914',
        textPrimary:   '#F0EDE8',
        textSecondary: '#9E9A94',
        textMuted:     '#5C5852',
        error:         '#B85450',
        success:       '#4A9B6F',
        warning:       '#C8852A',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ["'Playfair Display'", 'Georgia', 'serif'],
      },
      boxShadow: {
        gold: '0 0 20px rgba(201,168,76,0.12)',
        card: '0 4px 24px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
