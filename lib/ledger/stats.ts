/**
 * 记账本地统计纯函数:按天分组、月小计、周区间。
 * 只做字符串/日期运算,不碰网络 —— 服务端已有 /app/ledger/summary,
 * 这里负责列表页的日分组小计与月份导航,逻辑放纯函数便于 jest 直测。
 */
import type { LedgerRecord } from '@/lib/api/endpoints/ledger';

export interface LedgerDayGroup {
  /** 分组键 `yyyy-MM-dd`。 */
  key: string;
  /** 头部文案,如 `10月28日 周三`。 */
  label: string;
  /** 当日支出合计。 */
  expense: number;
  /** 当日收入合计。 */
  income: number;
  records: LedgerRecord[];
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** `yyyy-MM-dd` -> 本地 Date(零点)。非法输入返回 null。 */
export function parseDayKey(key: string): Date | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!matched) return null;
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date -> `yyyy-MM-dd`(本地时区)。 */
export function toDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 分组头文案:`10月28日 周三`;今天/昨天给相对文案。 */
export function dayGroupLabel(key: string, now: Date = new Date()): string {
  const date = parseDayKey(key);
  if (!date) return key;
  const today = toDayKey(now);
  const yesterday = toDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (key === today) return '今天';
  if (key === yesterday) return '昨天';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}

/**
 * 已按 recordDate desc 排好序的服务端分页结果 -> 按天分组(服务端排序保证天也降序)。
 * 跨页时同一天可能出现两次,由调用方用 mergeDayGroups 合并。
 */
export function groupByDay(records: LedgerRecord[], now: Date = new Date()): LedgerDayGroup[] {
  const groups: LedgerDayGroup[] = [];
  const index = new Map<string, LedgerDayGroup>();
  for (const record of records) {
    const key = record.recordDate;
    let group = index.get(key);
    if (!group) {
      group = { key, label: dayGroupLabel(key, now), expense: 0, income: 0, records: [] };
      index.set(key, group);
      groups.push(group);
    }
    if (record.type === 2) group.income += record.amount;
    else group.expense += record.amount;
    group.records.push(record);
  }
  return groups;
}

/** 追加一页数据时,把新分组的金额/记录并进已有分组(跨页同一天)。 */
export function mergeDayGroups(
  base: LedgerDayGroup[],
  incoming: LedgerDayGroup[],
): LedgerDayGroup[] {
  const merged = base.map((group) => ({ ...group, records: [...group.records] }));
  const index = new Map(merged.map((group) => [group.key, group]));
  for (const group of incoming) {
    const existing = index.get(group.key);
    if (existing) {
      existing.expense += group.expense;
      existing.income += group.income;
      existing.records.push(...group.records);
    } else {
      merged.push({ ...group, records: [...group.records] });
      index.set(group.key, merged[merged.length - 1]);
    }
  }
  return merged;
}

/** 月份游标:`2026-10` -> `{2026-11, 2026-09}`;可越界,由 UI 限制未来。 */
export function adjacentMonths(month: string): { prev: string; next: string } {
  const matched = /^(\d{4})-(\d{2})$/.exec(month);
  if (!matched) throw new Error(`月份格式应为 yyyy-MM,实际:${month}`);
  const year = new Date(Number(matched[1]), Number(matched[2]) - 1, 1);
  const prev = new Date(year.getFullYear(), year.getMonth() - 1, 1);
  const next = new Date(year.getFullYear(), year.getMonth() + 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { prev: fmt(prev), next: fmt(next) };
}

/** 月份文案:`2026-10` -> `2026年10月`。 */
export function monthLabel(month: string): string {
  const matched = /^(\d{4})-(\d{2})$/.exec(month);
  if (!matched) return month;
  return `${matched[1]}年${Number(matched[2])}月`;
}

/** 本月 key(本地时区)。 */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 金额展示:保留两位小数,千分位。 */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
