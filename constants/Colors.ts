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
    background: '210 45% 97%',
    foreground: '222 47% 10%',
    card: '0 0% 100%',
    'card-foreground': '222 47% 10%',
    popover: '0 0% 100%',
    'popover-foreground': '222 47% 10%',
    primary: '199 85% 34%',
    'primary-foreground': '210 40% 98%',
    secondary: '200 40% 93%',
    'secondary-foreground': '200 80% 26%',
    muted: '210 30% 93%',
    'muted-foreground': '215 18% 42%',
    accent: '195 80% 92%',
    'accent-foreground': '198 90% 26%',
    destructive: '355 75% 48%',
    'destructive-foreground': '210 40% 98%',
    border: '212 30% 86%',
    input: '212 30% 86%',
    ring: '199 85% 34%',
    urgent: '355 75% 48%',
    'urgent-foreground': '210 40% 98%',
    found: '160 65% 32%',
    'found-foreground': '160 45% 97%',
    pending: '38 95% 42%',
    'pending-foreground': '40 90% 97%',
  },
  dark: {
    background: '224 44% 6%',
    foreground: '210 40% 96%',
    card: '223 36% 10%',
    'card-foreground': '210 40% 96%',
    popover: '223 36% 10%',
    'popover-foreground': '210 40% 96%',
    primary: '191 91% 55%',
    'primary-foreground': '200 80% 10%',
    secondary: '220 30% 16%',
    'secondary-foreground': '195 60% 85%',
    muted: '220 28% 15%',
    'muted-foreground': '215 20% 64%',
    accent: '200 45% 18%',
    'accent-foreground': '191 80% 78%',
    destructive: '355 65% 55%',
    'destructive-foreground': '210 40% 98%',
    border: '221 26% 18%',
    input: '221 26% 18%',
    ring: '191 91% 55%',
    urgent: '352 80% 60%',
    'urgent-foreground': '350 60% 10%',
    found: '160 70% 48%',
    'found-foreground': '160 60% 8%',
    pending: '40 95% 58%',
    'pending-foreground': '35 80% 10%',
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
  primaryHex: '#0d72a0',
  backgroundHex: '#f4f7fb',
  urgentHex: '#d61f2e',
  foundHex: '#1d8763',
  pendingHex: '#d18605',
} as const;
