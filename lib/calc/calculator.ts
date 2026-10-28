/**
 * 计算器纯函数(即时执行型,类 iOS 基础计算器):
 * 输入数字/运算符即结算前一段,等号重复上一次运算。
 * 全程用"分"不现实(有除法),改用 Number + 显示层 toPrecision 控尾噪;除零返回错误态。
 */

export type Operator = '+' | '-' | '×' | '÷';

/** 二元运算;除零返回 null(由 UI 显示"除数不能为 0")。 */
export function applyOperation(left: number, right: number, operator: Operator): number | null {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      return right === 0 ? null : left / right;
  }
}

/** 显示值格式化:去浮点尾噪,超长用科学计数法。 */
export function formatDisplay(value: number): string {
  if (!Number.isFinite(value)) return '错误';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e12 || abs < 1e-9) return value.toExponential(6).replace(/\.?0+e/, 'e');
  const rounded = Number(value.toPrecision(12));
  return String(rounded);
}

/** 当前输入追加数字/小数点(小数点唯一,前导零规整)。 */
export function appendDigit(current: string, digit: string): string {
  if (digit === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  if (current === '0') return digit;
  // 超长输入截断(12 位含小数点),避免精度崩坏
  return current.length >= 12 ? current : current + digit;
}
