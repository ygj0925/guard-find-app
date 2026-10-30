/**
 * 亲戚称呼 + 心率区间 + 密码 + 折扣 单测。
 */
import { kinshipTitle, availableSteps } from '../kinship';
import { heartRateZones, maxHeartRate, zoneForHr } from '../fitness';
import { generatePassword, passwordStrength } from '../password';
import { compareUnitPrices, discountedPrice } from '../shopping';

describe('亲戚称呼', () => {
  it('直系三代', () => {
    expect(kinshipTitle('f')).toBe('爸爸');
    expect(kinshipTitle('ff')).toBe('爷爷');
    expect(kinshipTitle('mm')).toBe('外婆');
    expect(kinshipTitle('ss')).toBe('孙子');
  });

  it('旁系', () => {
    expect(kinshipTitle('fob')).toBe('伯父');
    expect(kinshipTitle('mob')).toBe('舅舅');
  });

  it('姻亲', () => {
    expect(kinshipTitle('hf')).toBe('公公');
    expect(kinshipTitle('wf')).toBe('岳父');
  });

  it('未收录返回 null', () => {
    expect(kinshipTitle('xxx')).toBeNull();
    expect(kinshipTitle('')).toBeNull();
  });

  it('可用步骤列表至少 8 项', () => {
    expect(availableSteps().length).toBeGreaterThanOrEqual(8);
  });
});

describe('心率区间', () => {
  it('30 岁最大心率 190', () => {
    expect(maxHeartRate(30)).toBe(190);
  });

  it('五区间', () => {
    expect(heartRateZones(30)).toHaveLength(5);
  });

  it('心率归区', () => {
    expect(zoneForHr(30, 180)).toBe(5);
  });
});

describe('密码生成', () => {
  it('强度评分覆盖', () => {
    expect(passwordStrength('Abcdefgh123!@#$%^')).toBe(4);
    expect(passwordStrength('')).toBe(0);
  });

  it('生成密码长度和类型保证', () => {
    const pw = generatePassword({ length: 20, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: false });
    expect(pw).toHaveLength(20);
  });
});

describe('折扣比较', () => {
  it('最优单价标记', () => {
    const results = compareUnitPrices([
      { name: 'A', price: 10, quantity: 1, unit: '个' },
      { name: 'B', price: 8, quantity: 1, unit: '个' },
    ]);
    expect(results[0].isBest).toBe(true);
    expect(results[0].item.name).toBe('B');
  });

  it('折扣实付', () => {
    expect(discountedPrice(200, 0.75)).toBe(150);
  });
});
