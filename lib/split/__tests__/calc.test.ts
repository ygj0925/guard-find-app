/**
 * lib/split/calc.ts 单测:均分口径(余数前 N 人多付 1 分)、和恒等于总额、非法输入。
 */
import { splitAmount, sumEach } from '../calc';

describe('splitAmount', () => {
  it('整除:100 元 4 人,每人 25.00', () => {
    const result = splitAmount(100, 4);
    expect(result?.perHead).toBe(25);
    expect(result?.remainderCents).toBe(0);
    expect(result?.eachAmount).toEqual([25, 25, 25, 25]);
  });

  it('有余数:10 元 3 人,前 1 人多付 1 分(3.34/3.33/3.33)', () => {
    const result = splitAmount(10, 3);
    expect(result?.remainderCents).toBe(1);
    expect(result?.eachAmount[0]).toBeCloseTo(3.34, 6);
    expect(result?.eachAmount[1]).toBeCloseTo(3.33, 6);
    expect(result?.eachAmount[2]).toBeCloseTo(3.33, 6);
  });

  it('校验和恒等于总额(浮点容差内)', () => {
    const result = splitAmount(312.6, 7);
    expect(result).not.toBeNull();
    expect(sumEach(result!.eachAmount)).toBeCloseTo(312.6, 6);
  });

  it('1 分钱 3 人:头 0 分,3 人都多 1 分', () => {
    const result = splitAmount(0.01, 3);
    expect(result?.perHead).toBe(0);
    expect(result?.remainderCents).toBe(1);
    expect(sumEach(result!.eachAmount)).toBeCloseTo(0.01, 6);
  });

  it('非法输入返回 null', () => {
    expect(splitAmount(0, 3)).toBeNull();
    expect(splitAmount(-5, 3)).toBeNull();
    expect(splitAmount(100, 0)).toBeNull();
    expect(splitAmount(100, 100)).toBeNull();
    expect(splitAmount(NaN, 3)).toBeNull();
  });
});
