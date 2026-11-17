import type { AccountingDraft } from '@/lib/api/endpoints/accounting';
import { categoriesOf } from './categories';
import { isLedgerDate } from './permissions';

export function parseAccountingDraft(raw?: string): AccountingDraft | null {
  if (!raw) return null;
  try {
    const draft: unknown = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return null;
    const value = draft as AccountingDraft;
    if (
      (value.type !== 1 && value.type !== 2) ||
      typeof value.amount !== 'number' ||
      !Number.isFinite(value.amount) ||
      value.amount <= 0 ||
      value.amount > 999999999.99 ||
      !/^\d+(\.\d{1,2})?$/.test(String(value.amount)) ||
      !isLedgerDate(value.recordDate) ||
      typeof value.remark !== 'string' ||
      value.remark.length > 500 ||
      !categoriesOf(value.type).some(
        (category) => category.code === value.category,
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
