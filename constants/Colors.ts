/**
 * 品牌 token 事实源(spec D8:global.css 与 Colors.ts 必须同源)。
 *
 * 做法:CSS 变量值写在本文件的 TOKENS 里(NativeWind 运行时读 global.css,
 * JS 侧颜色读本文件),`constants/__tests__/token-sync.test.ts` 会逐条比对两者,漂移即 CI 失败。
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
  | 'overlay'
  | 'urgent'
  | 'urgent-foreground'
  | 'found'
  | 'found-foreground'
  | 'pending'
  | 'pending-foreground';

/**
 * HSL 三元组,与 global.css 的 `--x: H S% L%` 一一对应。
 *
 * 基调(信任优先,寻亲/公益场景):主色是深墨蓝而非电光蓝,深色端取消霓虹青;
 * 紧急红 / 喜报绿 / 待核实琥珀三色的浅色值按 WCAG AA 反推(文字态对比 4.9~7.1),
 * 不允许只靠颜色区分状态,必须同时配文字标签。
 */
export const TOKENS = {
  light: {
    background: '210 36% 97%',
    foreground: '222 45% 11%',
    card: '0 0% 100%',
    'card-foreground': '222 45% 11%',
    popover: '0 0% 100%',
    'popover-foreground': '222 45% 11%',
    primary: '208 58% 33%',
    'primary-foreground': '210 40% 98%',
    secondary: '206 30% 94%',
    'secondary-foreground': '208 50% 28%',
    muted: '210 28% 93%',
    'muted-foreground': '215 17% 42%',
    accent: '205 45% 93%',
    'accent-foreground': '208 55% 26%',
    destructive: '354 72% 43%',
    'destructive-foreground': '210 40% 98%',
    border: '212 26% 86%',
    input: '212 26% 86%',
    ring: '208 58% 33%',
    overlay: '222 45% 8%',
    urgent: '354 72% 43%',
    'urgent-foreground': '210 40% 98%',
    found: '160 62% 27%',
    'found-foreground': '160 45% 97%',
    pending: '32 82% 34%',
    'pending-foreground': '40 90% 97%',
  },
  dark: {
    background: '224 40% 6%',
    foreground: '210 36% 96%',
    card: '223 34% 10%',
    'card-foreground': '210 36% 96%',
    popover: '223 34% 10%',
    'popover-foreground': '210 36% 96%',
    primary: '202 52% 62%',
    'primary-foreground': '204 60% 10%',
    secondary: '220 26% 16%',
    'secondary-foreground': '202 40% 84%',
    muted: '220 24% 15%',
    'muted-foreground': '214 18% 64%',
    accent: '205 32% 18%',
    'accent-foreground': '202 45% 80%',
    destructive: '352 72% 62%',
    'destructive-foreground': '352 60% 10%',
    border: '221 22% 18%',
    input: '221 22% 18%',
    ring: '202 52% 62%',
    overlay: '224 40% 3%',
    urgent: '352 72% 62%',
    'urgent-foreground': '350 60% 10%',
    found: '160 60% 48%',
    'found-foreground': '160 60% 8%',
    pending: '34 78% 58%',
    'pending-foreground': '35 80% 10%',
  },
} as const satisfies Record<'light' | 'dark', Record<TokenName, string>>;

export type Scheme = keyof typeof TOKENS;

/** `208 58% 33%` -> `hsl(208, 58%, 33%)`,RN 颜色解析器可用的形式。 */
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
  primaryHex: '#235785',
  backgroundHex: '#f5f7fa',
  urgentHex: '#bd1f2e',
  foundHex: '#1a7053',
  pendingHex: '#9e5b10',
} as const;
