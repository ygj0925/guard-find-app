/**
 * token 漂移守卫:global.css(CSS 变量)、constants/Colors.ts(TS 事实源)、
 * NATIVE_BRAND(app.json 唯一允许的字面色)与 app.json 本身,四者必须同源。
 * 任一条漂移即 CI 失败。
 */
import fs from 'fs';
import path from 'path';

import { NATIVE_BRAND, TOKENS, type TokenName } from '../Colors';

const ROOT = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'global.css'), 'utf8');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
  expo: {
    android: { adaptiveIcon: { backgroundColor: string } };
    harmony: { splash: { backgroundColor: string } };
  };
};

/** 取出 `:root` / `.dark:root` 块里的 CSS 自定义属性。 */
function readCssVars(selector: string): Record<string, string> {
  const blocks = [...css.matchAll(/(^|\n)\s*(:?\.dark:root|:root)\s*\{([^}]*)\}/gm)];
  const found = blocks.find((m) => m[2].trim() === selector);
  if (!found) throw new Error(`global.css 里找不到选择器 ${selector}`);
  const vars: Record<string, string> = {};
  for (const [, name, value] of found[3].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars[name] = value.trim();
  }
  return vars;
}

/** `199 85% 34%` -> `#0d72a0`,与浏览器/原生解析同一套 HSL 规则。 */
function hslTripleToHex(triple: string): string {
  const [hRaw, sRaw, lRaw] = triple.split(/\s+/);
  const h = Number(hRaw) / 360;
  const s = Number(sRaw.replace('%', '')) / 100;
  const l = Number(lRaw.replace('%', '')) / 100;
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const tokenNames = Object.keys(TOKENS.light) as TokenName[];

describe('token 单一来源', () => {
  it('global.css 的 :root 与 TOKENS.light 逐条一致', () => {
    const root = readCssVars(':root');
    expect(Object.keys(root).length).toBeGreaterThanOrEqual(tokenNames.length);
    for (const name of tokenNames) {
      expect(`${name}=${root[name]}`).toBe(`${name}=${TOKENS.light[name]}`);
    }
  });

  it('global.css 的 .dark:root 与 TOKENS.dark 逐条一致', () => {
    const dark = readCssVars('.dark:root');
    for (const name of tokenNames) {
      expect(`${name}=${dark[name]}`).toBe(`${name}=${TOKENS.dark[name]}`);
    }
  });

  it('NATIVE_BRAND 的每个字面色都是 TOKENS.light 的十六进制形式', () => {
    const pairs: [keyof typeof NATIVE_BRAND, TokenName][] = [
      ['primaryHex', 'primary'],
      ['backgroundHex', 'background'],
      ['urgentHex', 'urgent'],
      ['foundHex', 'found'],
      ['pendingHex', 'pending'],
    ];
    for (const [brandKey, tokenName] of pairs) {
      expect(`${brandKey}=${NATIVE_BRAND[brandKey]}`).toBe(
        `${brandKey}=${hslTripleToHex(TOKENS.light[tokenName])}`,
      );
    }
  });

  it('app.json 的原生底色取自 NATIVE_BRAND,不允许自己漂一份', () => {
    expect(appJson.expo.android.adaptiveIcon.backgroundColor).toBe(NATIVE_BRAND.backgroundHex);
    expect(appJson.expo.harmony.splash.backgroundColor).toBe(NATIVE_BRAND.backgroundHex);
  });

  it('半径 token 存在且被 tailwind 消费(圆角阶梯的地基)', () => {
    expect(readCssVars(':root').radius).toMatch(/^\d+(\.\d+)?rem$/);
  });
});
