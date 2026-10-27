/**
 * lib/ledger/stats.ts 纯函数单测:日分组、跨页合并、月份游标、金额格式化。
 */
import type { LedgerRecord } from '../../api/endpoints/ledger';
import {
  adjacentMonths,
  currentMonth,
  formatAmount,
  groupByDay,
  mergeDayGroups,
  monthLabel,
  parseDayKey,
  toDayKey,
} from '../stats';

const NOW = new Date(2026, 9, 28, 12, 0, 0); // 2026-10-28 周三(本地)

function record(id: string, type: 1 | 2, amount: number, recordDate: string): LedgerRecord {
  return { id, type, amount, category: 'food', recordDate, remark: null };
}

describe('parseDayKey / toDayKey', () => {
  it('解析 yyyy-MM-dd,非法输入返回 null', () => {
    expect(parseDayKey('2026-10-28')).toEqual(new Date(2026, 9, 28));
    expect(parseDayKey('2026-10-28 10:00')).toBeNull();
    expect(parseDayKey('')).toBeNull();
  });

  it('toDayKey 补零', () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('groupByDay', () => {
  it('按天分组并累计日支出/收入,相对文案今天/昨天', () => {
    const groups = groupByDay(
      [
        record('1', 1, 12.5, '2026-10-28'),
        record('2', 1, 8, '2026-10-28'),
        record('3', 2, 100, '2026-10-27'),
        record('4', 1, 30, '2026-10-20'),
      ],
      NOW,
    );
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe('今天');
    expect(groups[0].expense).toBeCloseTo(20.5);
    expect(groups[1].label).toBe('昨天');
    expect(groups[1].income).toBeCloseTo(100);
    expect(groups[2].label).toBe('10月20日 周二');
    expect(groups[2].records).toHaveLength(1);
  });
});

describe('mergeDayGroups', () => {
  it('跨页同一天合并金额与记录,不重复分组', () => {
    const page1 = groupByDay([record('1', 1, 10, '2026-10-28')], NOW);
    const page2 = groupByDay([record('2', 1, 5, '2026-10-28'), record('3', 1, 3, '2026-10-27')], NOW);
    const merged = mergeDayGroups(page1, page2);
    expect(merged).toHaveLength(2);
    expect(merged[0].expense).toBeCloseTo(15);
    expect(merged[0].records).toHaveLength(2);
    expect(merged[1].expense).toBeCloseTo(3);
  });
});

describe('月份工具', () => {
  it('currentMonth 取本地当月', () => {
    expect(currentMonth(NOW)).toBe('2026-10');
  });

  it('adjacentMonths 跨年正确', () => {
    expect(adjacentMonths('2026-12').next).toBe('2027-01');
    expect(adjacentMonths('2027-01').prev).toBe('2026-12');
  });

  it('monthLabel 渲染中文', () => {
    expect(monthLabel('2026-10')).toBe('2026年10月');
  });
});

describe('formatAmount', () => {
  it('千分位 + 两位小数', () => {
    expect(formatAmount(12345.5)).toBe('12,345.50');
  });
});
