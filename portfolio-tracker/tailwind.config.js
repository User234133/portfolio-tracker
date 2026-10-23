/** @type {import('tailwindcss').Config} */
// Direction artistique « gogol » : crème à pois, contours épais, ombres dures, couleurs bonbon.
// Les palettes slate / indigo / green / red... sont redéfinies ici : le code des pages garde ses
// classes habituelles (bg-slate-800 = carte blanche, bg-indigo-600 = bouton rose, etc.).
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1b1233',
        primary: '#8B5CF6',
        success: '#4ADE80',
        danger: '#FF5C5C',
        slate: {
          100: '#1b1233', 200: '#2d1f57', 300: '#4a3b78', 400: '#6b5b95', 500: '#7a6aa6',
          600: '#1b1233', 700: '#FFF1B8', 800: '#FFFFFF', 900: '#FFF1C9',
        },
        indigo: { 300: '#7c3aed', 400: '#7c3aed', 500: '#8B5CF6', 600: '#FF5CA8', 700: '#ff3d97', 900: '#c4b5fd' },
        green: { 400: '#067a3f', 500: '#4ADE80', 600: '#4ADE80', 700: '#22c55e', 900: '#86efac' },
        red: { 400: '#c4143f', 500: '#FF5C5C', 900: '#fca5a5' },
        yellow: { 400: '#8a5300', 900: '#fde68a' },
        amber: { 400: '#FF8A3D', 700: '#b45309' },
        blue: { 400: '#1558b0', 900: '#93c5fd' },
      },
      fontFamily: {
        sans: ['Fredoka', 'ui-rounded', '"Arial Rounded MT Bold"', 'system-ui', 'sans-serif'],
        display: ['"Lilita One"', 'Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        goofy: '5px 5px 0 #1b1233',
        'goofy-sm': '3px 3px 0 #1b1233',
      },
      keyframes: {
        wiggle: { '0%, 100%': { transform: 'rotate(-8deg)' }, '50%': { transform: 'rotate(8deg)' } },
      },
      animation: { wiggle: 'wiggle 1.3s ease-in-out infinite' },
    },
  },
  plugins: [],
}
