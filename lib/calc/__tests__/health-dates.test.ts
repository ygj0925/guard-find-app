/**
 * 健康与日期计算纯函数单测。
 */
import { bmiLevel, calcBmi, calcBmr, dailyWaterMl } from '../health';
import { dateAfterDays, daysBetween, weekendDaysBetween, yearProgress } from '../dates';

describe('健康计算', () => {
  it('BMI:70kg/175cm ≈ 22.9(正常)', () => {
    const bmi = calcBmi(70, 175);
    expect(bmi).toBeCloseTo(22.9, 1);
    expect(bmiLevel(bmi as number)).toBe('正常');
  });

  it('中国分级边界:23.9 正常,24.1 超重,27.9 超重,28.1 肥胖,17 偏瘦', () => {
    expect(bmiLevel(23.9)).toBe('正常');
    expect(bmiLevel(24.1)).toBe('超重');
    expect(bmiLevel(27.9)).toBe('超重');
    expect(bmiLevel(28.1)).toBe('肥胖');
    expect(bmiLevel(17)).toBe('偏瘦');
  });

  it('BMR Mifflin-St Jeor:男 70kg/175cm/30 岁 = 1649,女同参 = 1483', () => {
    // 10*70+6.25*175-5*30+5 = 700+1093.75-150+5 = 1648.75 → 1649
    expect(calcBmr(70, 175, 30, 'male')).toBe(1649);
    expect(calcBmr(70, 175, 30, 'female')).toBe(1483);
  });

  it('饮水:60kg → 1920ml(取整到 50)', () => {
    expect(dailyWaterMl(60)).toBe(1950);
  });

  it('非法输入返回 null', () => {
    expect(calcBmi(0, 175)).toBeNull();
    expect(calcBmi(70, 0)).toBeNull();
    expect(calcBmr(70, 175, 0, 'male')).toBeNull();
    expect(dailyWaterMl(-1)).toBeNull();
  });
});

describe('日期计算', () => {
  it('间隔天数(跨月/倒序取绝对值口径为 b-a)', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
    expect(daysBetween('bad', '2026-01-01')).toBeNull();
  });

  it('N 天后(跨年/负数)', () => {
    expect(dateAfterDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dateAfterDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('周末天数:2026-10-24(周六)~2026-10-25(周日) 共 2 天', () => {
    expect(weekendDaysBetween('2026-10-24', '2026-10-25')).toBe(2);
    expect(weekendDaysBetween('2026-10-26', '2026-10-30')).toBe(0);
  });

  it('当年进度:平年 365 天,1 月 1 日 = 0%', () => {
    const progress = yearProgress(new Date(2026, 0, 1, 12));
    expect(progress.totalDays).toBe(365);
    expect(progress.dayOfYear).toBe(1);
    expect(progress.percent).toBeCloseTo(0.0027, 3);
  });
});
