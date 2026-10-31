/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 50:'#f0f5f5', 100:'#e1ebed', 200:'#c4d6dc', 300:'#a3bec9', 400:'#6e95a7', 500:'#446b80', 600:'#294d62', 700:'#233a50', 800:'#1b2e3c', 900:'#14232d', 950:'#101923' },
        // Existing indigo utilities share the Option B His Presence palette.
        indigo: { 50:'#f0f5f5', 100:'#e1ebed', 200:'#c4d6dc', 300:'#a3bec9', 400:'#6e95a7', 500:'#446b80', 600:'#294d62', 700:'#233a50', 800:'#1b2e3c', 900:'#14232d', 950:'#101923' },
        slate: { 50:'#f6f5f1', 100:'#eeece5', 200:'#dedbd2', 300:'#c5c0b5', 400:'#8a877e', 500:'#6c6b63', 600:'#55594f', 700:'#384749', 800:'#25353b', 900:'#14232d', 950:'#101923' },
        white: '#ffffff',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
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
