/** @type {import('tailwindcss').Config} */
// 语义色值以 global.css 的 CSS 变量为唯一事实源(见 D8 决策),本文件只做 hsl 包裹;
// constants/Colors.ts 里的同一份 token 由 constants/__tests__/token-sync.test.ts 校验与 global.css 不漂移。
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
      // 圆角阶梯全部由 --radius(14px,容器档)派生,不允许再出现脱离阶梯的字面半径。
      // 规则:xs 6 小控件 / sm 8 图标容器 / md 10 控件(button,input) / lg=xl 14 卡片与容器
      //      / 2xl 20 底部 sheet 与大块 hero / full 胶囊(chip、分段器、悬浮 tab bar)。
      borderRadius: {
        xs: 'calc(var(--radius) - 8px)',
        sm: 'calc(var(--radius) - 6px)',
        md: 'calc(var(--radius) - 4px)',
        lg: 'var(--radius)',
        xl: 'var(--radius)',
        '2xl': 'calc(var(--radius) + 6px)',
        '3xl': 'calc(var(--radius) + 10px)',
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
        overlay: 'hsl(var(--overlay) / <alpha-value>)',
        'on-overlay': 'hsl(var(--on-overlay) / <alpha-value>)',
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
