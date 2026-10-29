/**
 * 心率区间纯函数(运动科学口径)。
 * 最大心率 = 220 - 年龄(Tanaka 口径为 208 - 0.7×年龄,此处用传统 220- age 简式)。
 * 五区间:Z1 恢复(50-60%),Z2 有氧(60-70%),Z3 有氧强度(70-80%),Z4 阈值(80-90%),Z5 无氧(90-100%)。
 */

export interface HeartRateZone {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  min: number;
  max: number;
  /** 训练目的。 */
  purpose: string;
}

/** 非法年龄返回 null。 */
export function maxHeartRate(age: number): number | null {
  if (!Number.isFinite(age) || age < 10 || age > 100) return null;
  return 220 - Math.round(age);
}

/** 五区间(按最大心率百分比取整到整数 bpm)。 */
export function heartRateZones(age: number): HeartRateZone[] | null {
  const max = maxHeartRate(age);
  if (max === null) return null;
  const zone = (pct: number): number => Math.round((max * pct) / 100);
  return [
    { zone: 1, label: 'Z1 恢复', min: zone(50), max: zone(60), purpose: '热身与恢复' },
    { zone: 2, label: 'Z2 有氧', min: zone(60), max: zone(70), purpose: '脂肪燃烧与耐力' },
    { zone: 3, label: 'Z3 有氧强度', min: zone(70), max: zone(80), purpose: '心肺功能提升' },
    { zone: 4, label: 'Z4 阈值', min: zone(80), max: zone(90), purpose: '乳酸阈值训练' },
    { zone: 5, label: 'Z5 无氧', min: zone(90), max: max, purpose: '爆发力与极限' },
  ];
}

/** 判断某心率属于哪个区间(1-5);超出范围返回 null。 */
export function zoneForHr(age: number, hr: number): number | null {
  const zones = heartRateZones(age);
  if (!zones || !Number.isFinite(hr) || hr <= 0) return null;
  for (const z of zones) {
    if (hr <= z.max) return z.zone;
  }
  return 5;
}
