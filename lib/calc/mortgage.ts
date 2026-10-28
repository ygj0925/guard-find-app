/**
 * 房贷计算纯函数:等额本息 / 等额本金。
 * 口径:月利率 = 年利率/12(单利口径,与主流银行报价一致);金额一律用"分"避免浮点尾差。
 */

export type RepayMethod = 'interest-first-month' | 'principal-first-month';
/** 等额本息(每月总还款固定) */
export const EQUAL_INSTALLMENT = 'equal-installment' as const;
/** 等额本金(每月本金固定,利息递减) */
export const EQUAL_PRINCIPAL = 'equal-principal' as const;
export type MortgageMethod = typeof EQUAL_INSTALLMENT | typeof EQUAL_PRINCIPAL;

export interface MortgageInput {
  /** 贷款本金(元)。 */
  principal: number;
  /** 年利率(%,如 3.1 表示 3.1%)。 */
  annualRatePercent: number;
  /** 年限(年,1-30)。 */
  years: number;
}

export interface MortgageResult {
  method: MortgageMethod;
  /** 首月还款(元)。 */
  firstMonth: number;
  /** 末月还款(元,等额本息=每期)。 */
  lastMonth: number;
  /** 利息总额(元)。 */
  totalInterest: number;
  /** 还款总额(元)。 */
  totalPayment: number;
  /** 每期还款额(等额本息为全部期数;等额本金给首末即可,客户端画趋势)。 */
  monthly: number[];
}

function monthlyRate(annualRatePercent: number): number {
  return annualRatePercent / 100 / 12;
}

/** 等额本息:月供 M = P·r·(1+r)^n / ((1+r)^n - 1);r=0 时退化为无息分期。 */
function equalInstallment(input: MortgageInput): MortgageResult {
  const { principal, years } = input;
  const r = monthlyRate(input.annualRatePercent);
  const n = years * 12;
  const monthCents =
    r === 0 ? Math.round((principal / n) * 100) : Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) * 100);
  const totalCents = monthCents * n;
  const interestCents = totalCents - Math.round(principal * 100);
  return {
    method: EQUAL_INSTALLMENT,
    firstMonth: monthCents / 100,
    lastMonth: monthCents / 100,
    totalInterest: interestCents / 100,
    totalPayment: totalCents / 100,
    monthly: Array.from({ length: n }, () => monthCents / 100),
  };
}

/** 等额本金:每月本金 P/n 固定,利息 = 剩余本金·r;首月最高逐月递减。 */
function equalPrincipal(input: MortgageInput): MortgageResult {
  const { principal, years } = input;
  const r = monthlyRate(input.annualRatePercent);
  const n = years * 12;
  const principalPerMonth = principal / n;
  const monthly: number[] = [];
  let interestTotal = 0;
  let remaining = principal;
  for (let month = 0; month < n; month++) {
    const interest = remaining * r;
    interestTotal += interest;
    monthly.push(Math.round((principalPerMonth + interest) * 100) / 100);
    remaining -= principalPerMonth;
  }
  const totalCents = Math.round((principal + interestTotal) * 100);
  return {
    method: EQUAL_PRINCIPAL,
    firstMonth: monthly[0],
    lastMonth: monthly[n - 1],
    totalInterest: Math.round(interestTotal * 100) / 100,
    totalPayment: totalCents / 100,
    monthly,
  };
}

/** 入参非法(本金<=0、利率<0、年限出界)返回 null。 */
export function calcMortgage(input: MortgageInput, method: MortgageMethod): MortgageResult | null {
  const { principal, annualRatePercent, years } = input;
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent >= 100) return null;
  if (!Number.isFinite(years) || years < 1 || years > 30) return null;
  return method === EQUAL_INSTALLMENT ? equalInstallment(input) : equalPrincipal(input);
}
