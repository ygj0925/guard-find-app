/**
 * 单位换算纯函数:长度/重量/温度/数据存储/面积 五类,纯本地零接口。
 * 温度是对数变换(不是倍率),单独走一条路径;其余品类统一"先归一化到基准单位再换出"。
 */

export interface UnitDef {
  code: string;
  label: string;
  /** 相对品类基准单位的倍率(温度品类无意义,不使用)。 */
  factor: number;
}

export interface UnitCategory {
  key: string;
  label: string;
  /** 品类基准单位(倍率=1)。 */
  units: UnitDef[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    key: 'length',
    label: '长度',
    units: [
      { code: 'mm', label: '毫米', factor: 0.001 },
      { code: 'cm', label: '厘米', factor: 0.01 },
      { code: 'm', label: '米', factor: 1 },
      { code: 'km', label: '千米', factor: 1000 },
      { code: 'in', label: '英寸', factor: 0.0254 },
      { code: 'ft', label: '英尺', factor: 0.3048 },
      { code: 'mi', label: '英里', factor: 1609.344 },
    ],
  },
  {
    key: 'weight',
    label: '重量',
    units: [
      { code: 'mg', label: '毫克', factor: 0.000001 },
      { code: 'g', label: '克', factor: 0.001 },
      { code: 'kg', label: '千克', factor: 1 },
      { code: 't', label: '吨', factor: 1000 },
      { code: 'lb', label: '磅', factor: 0.45359237 },
      { code: 'oz', label: '盎司', factor: 0.028349523125 },
    ],
  },
  {
    key: 'temperature',
    label: '温度',
    units: [
      { code: 'C', label: '摄氏度', factor: 1 },
      { code: 'F', label: '华氏度', factor: 1 },
      { code: 'K', label: '开尔文', factor: 1 },
    ],
  },
  {
    key: 'data',
    label: '数据',
    units: [
      { code: 'B', label: '字节', factor: 1 },
      { code: 'KB', label: '千字节', factor: 1024 },
      { code: 'MB', label: '兆字节', factor: 1024 ** 2 },
      { code: 'GB', label: '吉字节', factor: 1024 ** 3 },
      { code: 'TB', label: '太字节', factor: 1024 ** 4 },
    ],
  },
  {
    key: 'area',
    label: '面积',
    units: [
      { code: 'm2', label: '平方米', factor: 1 },
      { code: 'km2', label: '平方千米', factor: 1e6 },
      { code: 'ha', label: '公顷', factor: 1e4 },
      { code: 'mu', label: '亩', factor: 666.6666667 },
      { code: 'ft2', label: '平方英尺', factor: 0.09290304 },
    ],
  },
];

/** 找品类;找不到(含 null)返回 null。 */
export function categoryOf(key: string): UnitCategory | null {
  return UNIT_CATEGORIES.find((category) => category.key === key) ?? null;
}

/** 温度换算:品类内两两互转,不经基准单位。 */
function convertTemperature(value: number, from: string, to: string): number {
  // 先统一到摄氏度
  let celsius: number;
  if (from === 'F') celsius = ((value - 32) * 5) / 9;
  else if (from === 'K') celsius = value - 273.15;
  else celsius = value;
  if (to === 'F') return (celsius * 9) / 5 + 32;
  if (to === 'K') return celsius + 273.15;
  return celsius;
}

/**
 * 换算主入口。输入非法(from/to 不在品类内、value 非有限数)返回 null,
 * 由 UI 层给"无法换算"提示,纯函数不抛异常。
 */
export function convert(
  categoryKey: string,
  value: number,
  fromCode: string,
  toCode: string,
): number | null {
  if (!Number.isFinite(value)) return null;
  const category = categoryOf(categoryKey);
  if (!category) return null;
  const from = category.units.find((unit) => unit.code === fromCode);
  const to = category.units.find((unit) => unit.code === toCode);
  if (!from || !to) return null;
  if (from.code === to.code) return value;
  if (category.key === 'temperature') {
    return convertTemperature(value, from.code, to.code);
  }
  return (value * from.factor) / to.factor;
}

/** 结果展示:智能保留有效位(去浮点尾噪)。 */
export function formatConverted(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e9 || abs < 1e-6) return value.toExponential(6).replace(/\.?0+e/, 'e');
  // 最多 8 位有效数字,去掉尾部零
  const fixed = Number(value.toPrecision(8));
  return String(fixed);
}
