/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 50:'#fbf4f4', 100:'#f3e3e5', 200:'#e4c7cc', 300:'#d3a5af', 400:'#b97989', 500:'#a36173', 600:'#8b4f5c', 700:'#733e4b', 800:'#603540', 900:'#4b2c34', 950:'#302026' },
        // Keep existing utility consumers connected to the shared warm palette.
        indigo: { 50:'#fbf4f4', 100:'#f3e3e5', 200:'#e4c7cc', 300:'#d3a5af', 400:'#b97989', 500:'#a36173', 600:'#8b4f5c', 700:'#733e4b', 800:'#603540', 900:'#4b2c34', 950:'#302026' },
        slate: { 50:'#faf7f2', 100:'#f0e8df', 200:'#ddd2c7', 300:'#c4b4a6', 400:'#7b695e', 500:'#716157', 600:'#605149', 700:'#493d35', 800:'#302722', 900:'#241e1a', 950:'#191512' },
        white: '#fffdfa',
      },
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'slide-up-sheet': 'slideUpSheet 0.3s cubic-bezier(0.32,0.72,0,1)',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn:      { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        slideUpSheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)',
        'modal': '0 20px 60px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
