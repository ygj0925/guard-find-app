/**
 * 品牌 token 事实源(spec D8:global.css 与 Colors.ts 必须同源)。
 *
 * 做法:CSS 变量值写在本文件的 TOKENS 里(NativeWind 运行时读 global.css,
 * JS 侧颜色读本文件),`__tests__/token-sync.test.ts` 会逐条比对两者,漂移即 CI 失败。
 * RN 支持 `hsl(h, s%, l%)` 字符串,所以不需要再转 hex。
 */

export type TokenName =
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'popover'
  | 'popover-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'border'
  | 'input'
  | 'ring'
  | 'urgent'
  | 'urgent-foreground'
  | 'found'
  | 'found-foreground'
  | 'pending'
  | 'pending-foreground';

/** HSL 三元组,与 global.css 的 `--x: H S% L%` 一一对应。 */
export const TOKENS = {
  light: {
    background: '210 40% 98%',
    foreground: '222 47% 12%',
    card: '0 0% 100%',
    'card-foreground': '222 47% 12%',
    popover: '0 0% 100%',
    'popover-foreground': '222 47% 12%',
    primary: '201 72% 30%',
    'primary-foreground': '210 40% 98%',
    secondary: '201 34% 93%',
    'secondary-foreground': '201 72% 22%',
    muted: '210 27% 94%',
    'muted-foreground': '215 16% 44%',
    accent: '201 42% 92%',
    'accent-foreground': '201 72% 22%',
    destructive: '355 70% 48%',
    'destructive-foreground': '210 40% 98%',
    border: '214 26% 87%',
    input: '214 26% 87%',
    ring: '201 72% 30%',
    urgent: '355 70% 48%',
    'urgent-foreground': '210 40% 98%',
    found: '152 55% 30%',
    'found-foreground': '150 40% 97%',
    pending: '32 92% 40%',
    'pending-foreground': '40 90% 97%',
  },
  dark: {
    background: '222 47% 8%',
    foreground: '210 40% 96%',
    card: '222 44% 11%',
    'card-foreground': '210 40% 96%',
    popover: '222 44% 11%',
    'popover-foreground': '210 40% 96%',
    primary: '200 78% 55%',
    'primary-foreground': '202 80% 12%',
    secondary: '217 25% 18%',
    'secondary-foreground': '210 40% 96%',
    muted: '217 25% 18%',
    'muted-foreground': '215 20% 65%',
    accent: '217 28% 20%',
    'accent-foreground': '210 40% 96%',
    destructive: '355 65% 55%',
    'destructive-foreground': '210 40% 98%',
    border: '217 25% 20%',
    input: '217 25% 20%',
    ring: '200 78% 55%',
    urgent: '355 68% 58%',
    'urgent-foreground': '350 60% 10%',
    found: '152 52% 45%',
    'found-foreground': '150 45% 10%',
    pending: '33 90% 55%',
    'pending-foreground': '30 60% 10%',
  },
} as const satisfies Record<'light' | 'dark', Record<TokenName, string>>;

export type Scheme = keyof typeof TOKENS;

/** `201 72% 30%` -> `hsl(201, 72%, 30%)`,RN 颜色解析器可用的形式。 */
export function hsl(triple: string): string {
  const [h, s, l] = triple.split(/\s+/);
  return `hsl(${h}, ${s}, ${l})`;
}

export function token(name: TokenName, scheme: Scheme = 'light'): string {
  return hsl(TOKENS[scheme][name]);
}

/**
 * 导航/原生属性用的具名色(Tab 的 tintColor、headers 等不能写 className)。
 * 值一律从 TOKENS 派生,不允许在这里出现字面色值。
 */
export const Colors = {
  light: {
    text: token('foreground', 'light'),
    background: token('background', 'light'),
    tint: token('primary', 'light'),
    icon: token('muted-foreground', 'light'),
    tabIconDefault: token('muted-foreground', 'light'),
    tabIconSelected: token('primary', 'light'),
    urgent: token('urgent', 'light'),
    found: token('found', 'light'),
    pending: token('pending', 'light'),
    border: token('border', 'light'),
  },
  dark: {
    text: token('foreground', 'dark'),
    background: token('background', 'dark'),
    tint: token('primary', 'dark'),
    icon: token('muted-foreground', 'dark'),
    tabIconDefault: token('muted-foreground', 'dark'),
    tabIconSelected: token('primary', 'dark'),
    urgent: token('urgent', 'dark'),
    found: token('found', 'dark'),
    pending: token('pending', 'dark'),
    border: token('border', 'dark'),
  },
} as const;

/** app.json 里只能写字面色,这份常量是写进原生配置的那一次例外的出处(由测试与 HSL 对齐)。 */
export const NATIVE_BRAND = {
  primaryHex: '#155d84',
  backgroundHex: '#f8fafc',
  urgentHex: '#d02533',
  foundHex: '#22774f',
  pendingHex: '#c46c08',
} as const;
