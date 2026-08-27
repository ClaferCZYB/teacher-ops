/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
      },
      colors: {
        // 主色（主题色，运行时由 data-theme 切换）
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          950: 'rgb(var(--ink-950) / <alpha-value>)',
        },
        // 米白底（每个主题色相不同，整体偏暖）
        paper: {
          50: 'rgb(var(--paper-50) / <alpha-value>)',
          100: 'rgb(var(--paper-100) / <alpha-value>)',
          200: 'rgb(var(--paper-200) / <alpha-value>)',
        },
        // 中性灰（始终一致）
        muted: {
          50: '#f7f7f6',
          100: '#eeeeec',
          200: '#dcdbd7',
          300: '#b8b7b1',
          400: '#8c8b85',
          500: '#6a6964',
          600: '#4f4e4a',
          700: '#3a3936',
        },
        // 性别（语义色，三主题一致）
        male: {
          50: 'rgb(var(--male-50) / <alpha-value>)',
          100: 'rgb(var(--male-100) / <alpha-value>)',
          600: 'rgb(var(--male-600) / <alpha-value>)',
          700: 'rgb(var(--male-700) / <alpha-value>)',
        },
        female: {
          50: 'rgb(var(--female-50) / <alpha-value>)',
          100: 'rgb(var(--female-100) / <alpha-value>)',
          600: 'rgb(var(--female-600) / <alpha-value>)',
          700: 'rgb(var(--female-700) / <alpha-value>)',
        },
        // 加减分（语义色）
        reward: {
          50: 'rgb(var(--reward-50) / <alpha-value>)',
          100: 'rgb(var(--reward-100) / <alpha-value>)',
          600: 'rgb(var(--reward-600) / <alpha-value>)',
          700: 'rgb(var(--reward-700) / <alpha-value>)',
        },
        award: {
          50: 'rgb(var(--award-50) / <alpha-value>)',
          100: 'rgb(var(--award-100) / <alpha-value>)',
          600: 'rgb(var(--award-600) / <alpha-value>)',
          700: 'rgb(var(--award-700) / <alpha-value>)',
        },
        demerit: {
          50: 'rgb(var(--demerit-50) / <alpha-value>)',
          100: 'rgb(var(--demerit-100) / <alpha-value>)',
          600: 'rgb(var(--demerit-600) / <alpha-value>)',
          700: 'rgb(var(--demerit-700) / <alpha-value>)',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(var(--shadow-color), 0.05), 0 1px 3px rgba(var(--shadow-color), 0.06)',
        soft: '0 6px 24px -12px rgba(var(--shadow-color), 0.22)',
        ring: '0 0 0 3px rgba(var(--ink-300), 0.25)',
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        lg: '10px',
        xl: '14px',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
}