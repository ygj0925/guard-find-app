/**
 * 记账预算(`/app/budget`)。预算 vs 实际支出对比,超 80% 预警,超 100% 标超支。
 */
import { api } from '../client';

export interface BudgetCategory {
  category: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  /** 0-1,>1 表示超支。 */
  ratio: number;
  /** normal / warn / over。 */
  alertLevel: string;
}

export interface BudgetSummary {
  period: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  categories: BudgetCategory[];
}

export interface BudgetSetting {
  period: string;
  category: string;
  budgetAmount: number;
}

export function setBudget(period: string, category: string, amount: number): Promise<void> {
  return api.post<void>('/app/budget/set', { period, category, budgetAmount: amount });
}

export function removeBudget(period: string, category: string): Promise<void> {
  return api.delete<void>(`/app/budget/remove?period=${period}&category=${category}`);
}

export function fetchBudgetSummary(period: string): Promise<BudgetSummary> {
  return api.get<BudgetSummary>('/app/budget/summary', { period });
}

export function fetchBudgetSettings(period: string): Promise<BudgetSetting[]> {
  return api.get<BudgetSetting[]>('/app/budget/list', { period });
}
