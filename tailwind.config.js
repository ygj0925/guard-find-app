/** @type {import('tailwindcss').Config} */
// 语义色值以 global.css 的 CSS 变量为唯一事实源(见 D8 决策),本文件只做 hsl 包裹;
// constants/Colors.ts 里的同一份 token 由 __tests__/tokens.test.ts 校验与 global.css 不漂移。
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    './providers/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './store/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        // 业务语义色:紧急 / 已找回 / 待处理,必须"颜色 + 文字"同时出现,不单独靠颜色表意。
        urgent: {
          DEFAULT: 'hsl(var(--urgent) / <alpha-value>)',
          foreground: 'hsl(var(--urgent-foreground) / <alpha-value>)',
        },
        found: {
          DEFAULT: 'hsl(var(--found) / <alpha-value>)',
          foreground: 'hsl(var(--found-foreground) / <alpha-value>)',
        },
        pending: {
          DEFAULT: 'hsl(var(--pending) / <alpha-value>)',
          foreground: 'hsl(var(--pending-foreground) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
