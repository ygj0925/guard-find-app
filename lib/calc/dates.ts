/**
 * 日期计算纯函数。入参/出参一律 `yyyy-MM-dd` 字符串,内部本地 Date(与全 app 口径一致)。
 */
import { parseDayKey, toDayKey } from '@/lib/ledger/stats';

const DAY_MS = 86_400_000;

/** 两日期间隔天数(b - a;同日为 0)。非法输入返回 null。 */
export function daysBetween(from: string, to: string): number | null {
  const a = parseDayKey(from);
  const b = parseDayKey(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** 某日期后/前 N 天的日期;N 可为负。非法输入返回 null。 */
export function dateAfterDays(from: string, days: number): string | null {
  const a = parseDayKey(from);
  if (!a || !Number.isFinite(days)) return null;
  return toDayKey(new Date(a.getFullYear(), a.getMonth(), a.getDate() + days));
}

/** 两日期间的完整周末天数(不含端点规则:逐日扫描含两端)。 */
export function weekendDaysBetween(from: string, to: string): number | null {
  const a = parseDayKey(from);
  const b = parseDayKey(to);
  if (!a || !b) return null;
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export interface YearProgress {
  /** 当年第几天(1 起)。 */
  dayOfYear: number;
  totalDays: number;
  /** 0-1,4 位小数。 */
  percent: number;
}

/** 当年进度。 */
export function yearProgress(now: Date = new Date()): YearProgress {
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const totalDays = Math.round((new Date(year + 1, 0, 1).getTime() - start.getTime()) / DAY_MS);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1;
  return {
    dayOfYear,
    totalDays,
    percent: Math.round((dayOfYear / totalDays) * 10_000) / 10_000,
  };
}
