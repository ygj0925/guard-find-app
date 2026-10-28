/**
 * lib/calc/mortgage.ts 单测:等额本息月供公式、等额本金递减、校验和、非法输入。
 */
import { calcMortgage, EQUAL_INSTALLMENT, EQUAL_PRINCIPAL } from '../mortgage';

describe('等额本息', () => {
  it('100 万 / 30 年 / 3.1%:月供 ≈ 4270.16 元', () => {
    const result = calcMortgage({ principal: 1_000_000, annualRatePercent: 3.1, years: 30 }, EQUAL_INSTALLMENT);
    expect(result).not.toBeNull();
    expect(result!.firstMonth).toBeCloseTo(4270.16, 1);
    expect(result!.monthly.every((m) => m === result!.firstMonth)).toBe(true);
    // 利息 = 月供×360 - 本金
    expect(result!.totalPayment - 1_000_000).toBeCloseTo(result!.totalInterest, 2);
    expect(result!.totalInterest).toBeGreaterThan(500_000);
    expect(result!.totalInterest).toBeLessThan(560_000);
  });

  it('0% 利率退化为无息:月供 = 本金/期数', () => {
    const result = calcMortgage({ principal: 120_000, annualRatePercent: 0, years: 1 }, EQUAL_INSTALLMENT);
    expect(result!.firstMonth).toBeCloseTo(10_000, 6);
    expect(result!.totalInterest).toBeCloseTo(0, 6);
  });
});

describe('等额本金', () => {
  it('首月最高,逐月递减;利息 = Σ剩余本金×月利率', () => {
    const result = calcMortgage({ principal: 1_000_000, annualRatePercent: 3.1, years: 30 }, EQUAL_PRINCIPAL);
    expect(result).not.toBeNull();
    expect(result!.firstMonth).toBeGreaterThan(result!.lastMonth!);
    // 逐月递减(金额已四舍五入到分,只断言严格单调)
    expect(result!.monthly[0]).toBeGreaterThan(result!.monthly[1]);
    expect(result!.monthly[1]).toBeGreaterThan(result!.monthly[2]);
    expect(result!.totalPayment - 1_000_000).toBeCloseTo(result!.totalInterest, 2);
    // 等额本金总利息必然低于等额本息
    const installment = calcMortgage({ principal: 1_000_000, annualRatePercent: 3.1, years: 30 }, EQUAL_INSTALLMENT);
    expect(result!.totalInterest).toBeLessThan(installment!.totalInterest);
  });
});

describe('非法输入', () => {
  it('本金/利率/年限出界返回 null', () => {
    expect(calcMortgage({ principal: 0, annualRatePercent: 3.1, years: 30 }, EQUAL_INSTALLMENT)).toBeNull();
    expect(calcMortgage({ principal: 100, annualRatePercent: 120, years: 30 }, EQUAL_INSTALLMENT)).toBeNull();
    expect(calcMortgage({ principal: 100, annualRatePercent: 3.1, years: 31 }, EQUAL_INSTALLMENT)).toBeNull();
    expect(calcMortgage({ principal: 100, annualRatePercent: 3.1, years: NaN }, EQUAL_INSTALLMENT)).toBeNull();
  });
});
