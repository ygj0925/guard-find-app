/**
 * AA 分账计算纯函数。口径与服务端 ToolSplitServiceImpl 一致:
 * 总分(元×100) ÷ 人数 向下取整,余数分由前 N 人各多承担 1 分,相加恒等于总额。
 */
export interface SplitResult {
  /** 每人基准金额(元,向下取整到分)。 */
  perHead: number;
  /** 余数(分),前 remainderPeople 人各多付 1 分。 */
  remainderCents: number;
  /** 每人实际应付(元),数组长度=人数;前 N 位多 1 分。 */
  eachAmount: number[];
}

/** 非法输入(人数<1、金额<=0、超范围)返回 null,由 UI 提示。 */
export function splitAmount(totalYuan: number, people: number): SplitResult | null {
  if (!Number.isFinite(totalYuan) || !Number.isFinite(people)) return null;
  if (people < 1 || people > 99) return null;
  if (totalYuan <= 0) return null;
  const totalCents = Math.round(totalYuan * 100);
  if (totalCents <= 0) return null;
  const headCents = Math.floor(totalCents / people);
  const remainderCents = totalCents % people;
  const eachAmount = Array.from({ length: people }, (_, index) =>
    Number((index < remainderCents ? headCents + 1 : headCents) / 100),
  );
  return {
    perHead: Number((headCents / 100).toFixed(2)),
    remainderCents,
    eachAmount,
  };
}

/** 校验和:每人相加恒等于总额(浮点容差 1e-6)。 */
export function sumEach(eachAmount: number[]): number {
  return eachAmount.reduce((sum, value) => sum + value, 0);
}
