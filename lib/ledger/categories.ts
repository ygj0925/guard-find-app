/**
 * 记账分类契约:码值与服务端 LedgerCategories 一一对应,前端不硬编码零散文案。
 * 图标走 lucide-react-native,与 TabIcon 同一体系。
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  Bus,
  Gamepad2,
  GraduationCap,
  Gift,
  HandCoins,
  HeartPulse,
  Home,
  PiggyBank,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Wallet,
} from 'lucide-react-native';

import type { LedgerType } from '@/lib/api/endpoints/ledger';

export interface LedgerCategory {
  code: string;
  label: string;
  icon: LucideIcon;
}

export const EXPENSE_CATEGORIES: LedgerCategory[] = [
  { code: 'food', label: '餐饮', icon: Utensils },
  { code: 'transport', label: '交通', icon: Bus },
  { code: 'shopping', label: '购物', icon: ShoppingBag },
  { code: 'housing', label: '居住', icon: Home },
  { code: 'entertainment', label: '娱乐', icon: Gamepad2 },
  { code: 'medical', label: '医疗', icon: HeartPulse },
  { code: 'education', label: '教育', icon: GraduationCap },
  { code: 'social', label: '人情', icon: HandCoins },
  { code: 'other', label: '其他', icon: Wallet },
];

export const INCOME_CATEGORIES: LedgerCategory[] = [
  { code: 'salary', label: '工资', icon: PiggyBank },
  { code: 'investment', label: '理财', icon: TrendingUp },
  { code: 'redpacket', label: '红包', icon: Gift },
  { code: 'other', label: '其他', icon: Wallet },
];

export function categoriesOf(type: LedgerType): LedgerCategory[] {
  return type === 2 ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryLabel(type: LedgerType, code: string): string {
  return categoriesOf(type).find((item) => item.code === code)?.label ?? '其他';
}

export function categoryIcon(type: LedgerType, code: string): LucideIcon {
  return categoriesOf(type).find((item) => item.code === code)?.icon ?? Wallet;
}
