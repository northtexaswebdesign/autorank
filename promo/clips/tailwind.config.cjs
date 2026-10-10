const path = require('path');
const repo = path.resolve(__dirname, '../..');
module.exports = {
  content: [path.join(repo, 'components/**/*.tsx'), path.join(__dirname, 'main.tsx')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      colors: {
        canvas: '#F4F3EF',
        brand: { 50: '#F7F6F3', 100: '#EFEDE8', 200: '#E4E1D9', 300: '#CFCAC0', 400: '#8C887F', 500: '#2A2B30', 600: '#111214', 700: '#000000', 800: '#000000', 900: '#000000' },
        accent: '#EA580C',
      },
    },
  },
};
