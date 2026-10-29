/**
 * 密码生成纯函数(密码学安全随机)。
 */

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** 排除易混淆字符 0O1lI。 */
  excludeAmbiguous: boolean;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = '0O1lI';

function charset(options: PasswordOptions): string {
  let pool = '';
  if (options.uppercase) pool += UPPER;
  if (options.lowercase) pool += LOWER;
  if (options.digits) pool += DIGITS;
  if (options.symbols) pool += SYMBOLS;
  if (options.excludeAmbiguous) {
    pool = pool
      .split('')
      .filter((c) => !AMBIGUOUS.includes(c))
      .join('');
  }
  return pool;
}

/** 密码学安全随机整数 [0, max)。 */
function secureRandomInt(max: number): number {
  const global = globalThis as { crypto?: { getRandomValues?(arr: Uint32Array): Uint32Array } };
  if (global.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    global.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  // 非 Web/非 RN 环境降级(仅测试)
  return Math.floor(Math.random() * max);
}

/** 生成密码;有效字符集不足返回 null。 */
export function generatePassword(options: PasswordOptions): string | null {
  if (options.length < 4 || options.length > 128) return null;
  const pool = charset(options);
  if (pool.length < 4) return null;
  // 保证至少包含每种已选字符类型(从各自的类型池中取,尊重 excludeAmbiguous)
  const filterAmbiguous = (chars: string) =>
    options.excludeAmbiguous ? chars.split('').filter((c) => !AMBIGUOUS.includes(c)).join('') : chars;
  const required: string[] = [];
  if (options.uppercase) { const sub = filterAmbiguous(UPPER); if (sub) required.push(sub[secureRandomInt(sub.length)]); }
  if (options.lowercase) { const sub = filterAmbiguous(LOWER); if (sub) required.push(sub[secureRandomInt(sub.length)]); }
  if (options.digits) { const sub = filterAmbiguous(DIGITS); if (sub) required.push(sub[secureRandomInt(sub.length)]); }
  if (options.symbols) { const sub = filterAmbiguous(SYMBOLS); if (sub) required.push(sub[secureRandomInt(sub.length)]); }
  const remaining = options.length - required.length;
  const chars: string[] = [...required];
  for (let i = 0; i < remaining; i++) {
    chars.push(pool[secureRandomInt(pool.length)]);
  }
  // Fisher-Yates 洗牌
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** 强度评分(0-4):按长度与字符集多样性。 */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export const STRENGTH_LABELS = ['极弱', '弱', '一般', '强', '极强'] as const;
