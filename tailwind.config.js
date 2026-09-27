/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 50:'#eff6ff', 100:'#dbeafe', 200:'#bfdbfe', 300:'#93c5fd', 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', 800:'#1e40af', 900:'#1e3a8a', 950:'#172554' },
        // Existing indigo utilities share the KDEC blue brand palette.
        indigo: { 50:'#eff6ff', 100:'#dbeafe', 200:'#bfdbfe', 300:'#93c5fd', 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', 800:'#1e40af', 900:'#1e3a8a', 950:'#172554' },
        slate: { 50:'#f5f8fc', 100:'#edf3fa', 200:'#dce5f0', 300:'#b6c7dc', 400:'#60758f', 500:'#536981', 600:'#405671', 700:'#2c4360', 800:'#182f4d', 900:'#102139', 950:'#091527' },
        white: '#ffffff',
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
