/**
 * 文本工具纯函数:字数统计 / 时间戳互转 / 进制转换 / JSON 格式化。
 */

export interface CharStats {
  /** 字符数(含空格)。 */
  chars: number;
  /** 不含空格换行。 */
  charsNoWhitespace: number;
  /** 中文汉字数。 */
  cjk: number;
  /** 英文单词数(按空白切分的含字母片段)。 */
  words: number;
  /** 行数。 */
  lines: number;
}

export function countChars(text: string): CharStats {
  const chars = text.length;
  const charsNoWhitespace = text.replace(/\s/g, '').length;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = text.split(/\s+/).filter((token) => /[a-zA-Z]/.test(token)).length;
  const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
  return { chars, charsNoWhitespace, cjk, words, lines };
}

/** 秒/毫秒时间戳 -> `yyyy-MM-dd HH:mm:ss`(本地时区);非法返回 null。 */
export function timestampToDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d{10}$/.test(trimmed) && !/^\d{13}$/.test(trimmed)) return null;
  const ms = Number(trimmed.length === 10 ? `${trimmed}000` : trimmed);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

/** `yyyy-MM-dd( HH:mm:ss)` -> 秒级时间戳;非法返回 null。 */
export function dateToTimestamp(raw: string): number | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw.trim());
  if (!matched) return null;
  const [, y, mo, d, h, mi, s] = matched;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0));
  // Date 会把 13 月进位到次年,回读月份校验拦住
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(mo) - 1) return null;
  return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
}

/** 2/8/10/16 进制互转(十进制为枢纽);非法返回 null。 */
export function convertRadix(value: string, from: 2 | 8 | 10 | 16, to: 2 | 8 | 10 | 16): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const decimal = parseInt(trimmed, from);
  if (Number.isNaN(decimal) || decimal < 0) return null;
  // 回读校验,拦住 "abc" 转 10 进制这类静默截断
  if (decimal.toString(from) !== trimmed.toLowerCase().replace(/^0+(?=.)/, '')) return null;
  return decimal.toString(to);
}

/** JSON 美化;失败返回错误信息(不抛异常)。 */
export function formatJson(raw: string, indent = 2): { ok: true; text: string } | { ok: false; error: string } {
  try {
    return { ok: true, text: JSON.stringify(JSON.parse(raw), null, indent) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'JSON 解析失败' };
  }
}
