/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F6F3EA',
        card: '#FFFFFF',
        sage: '#8FA888',
        sageDark: '#4F6B4C',
        sagePale: '#E4EBDD',
        sand: '#E9DFC6',
        coral: '#E17654',
        coralDark: '#C15B3B',
        coralPale: '#FBE5DC',
        ink: '#2C3630',
        inkSoft: '#66756A',
        line: '#DDD5C2',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        xl2: '22px',
      },
    },
  },
  plugins: [],
};
