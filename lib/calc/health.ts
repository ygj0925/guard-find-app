/**
 * 健康计算纯函数。公式来源:
 * - BMI 分级按中国成人标准(WS/T 428):<18.5 偏瘦,18.5-24 正常,24-28 超重,≥28 肥胖
 * - BMR 用 Mifflin-St Jeor 公式(1990),现行主流估算式
 * 仅作参考估算,UI 侧须常驻"不构成医疗建议"声明。
 */

export type BmiLevel = '偏瘦' | '正常' | '超重' | '肥胖';

/** BMI = 体重kg / 身高m²;非法输入(体重/身高 <= 0)返回 null。 */
export function calcBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** 中国成人 BMI 分级。 */
export function bmiLevel(bmi: number): BmiLevel {
  if (bmi < 18.5) return '偏瘦';
  if (bmi < 24) return '正常';
  if (bmi < 28) return '超重';
  return '肥胖';
}

/**
 * BMR 基础代谢(kcal/天),Mifflin-St Jeor:
 * 男 = 10×kg + 6.25×cm − 5×age + 5;女 = 同式 − 161。
 */
export function calcBmr(weightKg: number, heightCm: number, age: number, gender: 'male' | 'female'): number | null {
  if (!Number.isFinite(age) || age <= 0 || age > 120) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (!Number.isFinite(base)) return null;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

/** 每日饮水建议(ml):体重 × 30-35ml,取中值 32ml,向上取整到 50ml。 */
export function dailyWaterMl(weightKg: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  return Math.ceil((weightKg * 32) / 50) * 50;
}
