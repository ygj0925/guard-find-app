/**
 * lib/textkit/kit.ts 单测。
 */
import { convertRadix, countChars, dateToTimestamp, formatJson, timestampToDate } from '../kit';

describe('countChars', () => {
  it('中英混排统计', () => {
    const stats = countChars('你好 world\n第二次');
    expect(stats.chars).toBe(12);
    expect(stats.charsNoWhitespace).toBe(10);
    expect(stats.cjk).toBe(5);
    expect(stats.words).toBe(1);
    expect(stats.lines).toBe(2);
  });
});

describe('时间戳互转', () => {
  it('10 位秒 / 13 位毫秒互转', () => {
    const date = timestampToDate('1769491200');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(timestampToDate('1769491200123')).not.toBeNull();
    expect(timestampToDate('abc')).toBeNull();
    expect(timestampToDate('12345')).toBeNull();
    const ts = dateToTimestamp('2026-01-27 12:00:00');
    expect(ts).not.toBeNull();
    expect(String(ts)).toMatch(/^\d{10}$/);
    expect(dateToTimestamp('2026-13-01')).toBeNull();
  });
});

describe('进制转换', () => {
  it('255 的各进制', () => {
    expect(convertRadix('255', 10, 16)).toBe('ff');
    expect(convertRadix('ff', 16, 10)).toBe('255');
    expect(convertRadix('255', 10, 2)).toBe('11111111');
    expect(convertRadix('0xFF', 16, 10)).toBeNull();
    expect(convertRadix('abc', 10, 16)).toBeNull();
  });
});

describe('formatJson', () => {
  it('合法 JSON 美化,非法给错误', () => {
    expect(formatJson('{"a":1}')).toEqual({ ok: true, text: '{\n  "a": 1\n}' });
    expect(formatJson('{bad}').ok).toBe(false);
  });
});
