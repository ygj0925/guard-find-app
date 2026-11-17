import type { LedgerRecord } from '@/lib/api/endpoints/ledger';

/** 家庭组成员能查看共享记录，只能改删本人记录。缺少归属时不猜测权限。 */
export function canManageLedgerRecord(
  record: LedgerRecord,
  userId: string | null,
): boolean {
  return Boolean(userId && record.userId === userId);
}

export function isLedgerDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
