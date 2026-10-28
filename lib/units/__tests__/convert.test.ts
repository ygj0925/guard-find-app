/**
 * lib/units/convert.ts 单测:倍率换算、温度对数路径、非法输入、格式化。
 */
import { convert, formatConverted, UNIT_CATEGORIES } from '../convert';

describe('convert 倍率品类', () => {
  it('米转千米:1000m = 1km', () => {
    expect(convert('length', 1000, 'm', 'km')).toBeCloseTo(1);
  });

  it('磅转千克', () => {
    expect(convert('weight', 2.20462262, 'lb', 'kg')).toBeCloseTo(1, 5);
  });

  it('GB 转 MB(1024 进制)', () => {
    expect(convert('data', 1, 'GB', 'MB')).toBe(1024);
  });

  it('亩转平方米', () => {
    expect(convert('area', 1, 'mu', 'm2')).toBeCloseTo(666.6666667, 5);
  });
});

describe('convert 温度(独立路径)', () => {
  it('0 摄氏度 = 32 华氏度 = 273.15K', () => {
    expect(convert('temperature', 0, 'C', 'F')).toBeCloseTo(32);
    expect(convert('temperature', 0, 'C', 'K')).toBeCloseTo(273.15);
  });

  it('100 华氏度 ≈ 37.78 摄氏度;往返还原', () => {
    const f = 100;
    const c = convert('temperature', f, 'F', 'C');
    expect(c).toBeCloseTo(37.7778, 3);
    expect(convert('temperature', c as number, 'C', 'F')).toBeCloseTo(f, 6);
  });

  it('同单位原样返回(不经过浮点变换)', () => {
    expect(convert('temperature', 36.5, 'C', 'C')).toBe(36.5);
  });
});

describe('convert 非法输入', () => {
  it('品类/单位不存在或非数值返回 null,不抛异常', () => {
    expect(convert('nope', 1, 'm', 'km')).toBeNull();
    expect(convert('length', 1, 'nope', 'km')).toBeNull();
    expect(convert('length', NaN, 'm', 'km')).toBeNull();
    expect(convert('length', Infinity, 'm', 'km')).toBeNull();
  });
});

describe('formatConverted', () => {
  it('null 显示占位符,去浮点尾噪,大数用科学计数法', () => {
    expect(formatConverted(null)).toBe('—');
    expect(formatConverted(0)).toBe('0');
    expect(formatConverted(666.6666666666667)).toBe('666.66667');
    expect(formatConverted(1e-9).includes('e')).toBe(true);
  });
});

describe('UNIT_CATEGORIES 契约', () => {
  it('每类单位 code 不重复,温度类恰好 3 个', () => {
    for (const category of UNIT_CATEGORIES) {
      const codes = category.units.map((unit) => unit.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
    expect(UNIT_CATEGORIES.find((category) => category.key === 'temperature')?.units).toHaveLength(3);
  });
});
