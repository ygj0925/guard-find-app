/**
 * 密码/心率/折扣 纯函数单测。
 */
import { generatePassword, passwordStrength, STRENGTH_LABELS } from '../password';
import { heartRateZones, maxHeartRate, zoneForHr } from '../fitness';
import { compareUnitPrices, discountedPrice } from '../shopping';

describe('密码生成', () => {
  it('长度正确,仅含已选字符集', () => {
    const pw = generatePassword({ length: 16, uppercase: true, lowercase: true, digits: true, symbols: false, excludeAmbiguous: true });
    expect(pw).toHaveLength(16);
    expect(pw).not.toMatch(/[!@#$%^&*]/);
    expect(pw).not.toMatch(/[0O1lI]/);
  });

  it('保证每种已选类型至少出现一次', () => {
    const pw = generatePassword({ length: 4, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: false });
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/\d/);
  });

  it('长度不合法返回 null', () => {
    expect(generatePassword({ length: 3, uppercase: true, lowercase: true, digits: true, symbols: false, excludeAmbiguous: false })).toBeNull();
  });

  it('强度评分', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('short')).toBeLessThan(4);
    expect(passwordStrength('Abcdefgh123!@#$%^')).toBe(4);
  });
});

describe('心率区间', () => {
  it('30 岁:最大心率 190', () => {
    expect(maxHeartRate(30)).toBe(190);
    expect(maxHeartRate(5)).toBeNull();
  });

  it('五区间边界', () => {
    const zones = heartRateZones(30)!;
    expect(zones).toHaveLength(5);
    expect(zones[0].min).toBe(95); // 190*0.5
    expect(zones[4].max).toBe(190);
  });

  it('心率归区', () => {
    expect(zoneForHr(30, 100)).toBe(1); // 100 <= 95+60%区
    expect(zoneForHr(30, 180)).toBe(5);
    expect(zoneForHr(30, -5)).toBeNull();
  });
});

describe('折扣比较', () => {
  it('单价升序,最优标记', () => {
    const items = [
      { name: '小瓶', price: 10, quantity: 500, unit: 'ml' },
      { name: '大瓶', price: 15, quantity: 1000, unit: 'ml' },
    ];
    const results = compareUnitPrices(items);
    expect(results[0].item.name).toBe('大瓶');
    expect(results[0].isBest).toBe(true);
    expect(results[1].isBest).toBe(false);
  });

  it('非法项被过滤', () => {
    const results = compareUnitPrices([
      { name: 'ok', price: 5, quantity: 1, unit: '个' },
      { name: 'bad', price: 0, quantity: 1, unit: '个' },
    ]);
    expect(results).toHaveLength(1);
  });

  it('折扣实付', () => {
    expect(discountedPrice(100, 0.85)).toBe(85);
    expect(discountedPrice(-1, 0.85)).toBeNull();
  });
});
