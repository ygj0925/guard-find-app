/**
 * 打卡月历纯函数:给定月份生成网格(周一开头),标出打卡日/今天/未来日。
 */
export interface MonthGridDay {
  /** 1-31(月内);月外补位格为 null。 */
  day: number | null;
  /** `yyyy-MM-dd`,月外为 null。 */
  key: string | null;
}

/** `yyyy-MM` -> [周一开头的网格(7 列), 月天数]。 */
export function buildMonthGrid(month: string): MonthGridDay[] {
  const matched = /^(\d{4})-(\d{2})$/.exec(month);
  if (!matched) return [];
  const first = new Date(Number(matched[1]), Number(matched[2]) - 1, 1);
  const daysInMonth = new Date(Number(matched[1]), Number(matched[2]), 0).getDate();
  // JS getDay(): 0=周日;换算成周一开头(0=周一)
  const lead = (first.getDay() + 6) % 7;
  const cells: MonthGridDay[] = Array.from({ length: lead }, () => ({ day: null, key: null }));
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${matched[1]}-${matched[2]}-${String(day).padStart(2, '0')}`;
    cells.push({ day, key });
  }
  return cells;
}

/** 相邻月份游标(与记账页 adjacentMonths 同语义,月历页独立引入避免耦合)。 */
export function adjacentMonth(month: string, delta: number): string {
  const matched = /^(\d{4})-(\d{2})$/.exec(month);
  if (!matched) throw new Error(`月份格式应为 yyyy-MM,实际:${month}`);
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
