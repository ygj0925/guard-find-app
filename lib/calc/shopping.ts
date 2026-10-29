/**
 * 折扣比较纯函数:多商品单价比价 + 折扣实付计算。
 */

export interface ShoppingItem {
  name: string;
  /** 价格(元)。 */
  price: number;
  /** 数量/规格。 */
  quantity: number;
  /** 单位(如 ml / g / 包)。 */
  unit: string;
}

export interface UnitPriceResult {
  item: ShoppingItem;
  /** 单价(元/单位,4 位小数)。 */
  unitPrice: number;
  /** 是否为列表中最优。 */
  isBest: boolean;
}

/** 按单价升序排列;非法输入(价格<=0、数量<=0)的项被过滤。 */
export function compareUnitPrices(items: ShoppingItem[]): UnitPriceResult[] {
  const valid = items.filter(
    (item) => Number.isFinite(item.price) && item.price > 0 && Number.isFinite(item.quantity) && item.quantity > 0,
  );
  const results: UnitPriceResult[] = valid
    .map((item) => ({
      item,
      unitPrice: Math.round((item.price / item.quantity) * 10000) / 10000,
      isBest: false,
    }))
    .sort((a, b) => a.unitPrice - b.unitPrice);
  if (results.length > 0) results[0].isBest = true;
  return results;
}

/** 折扣实付:原价 × 折扣(如 0.85 表示 85 折);非法返回 null。 */
export function discountedPrice(originalPrice: number, discountRate: number): number | null {
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) return null;
  if (!Number.isFinite(discountRate) || discountRate <= 0 || discountRate >= 1) return null;
  return Math.round(originalPrice * discountRate * 100) / 100;
}
