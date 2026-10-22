import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        surface: '#1c1c1e',
        raised: '#2a2a2d',
        line: '#2f2f33',
        muted: '#8e8e93',
        accent: { DEFAULT: '#f08a31', soft: '#3a2616', strong: '#ffa24f' },
        ok: '#5fcf8a',
        bad: '#ef6a6a',
      },
      borderRadius: { xl2: '1.25rem' },
      fontFamily: {
        sans: ['ui-rounded', '"SF Pro Rounded"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
