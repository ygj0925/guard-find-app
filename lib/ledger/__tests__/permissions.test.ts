import { canManageLedgerRecord, isLedgerDate } from '../permissions';
import { parseAccountingDraft } from '../recognition';
import type { LedgerRecord } from '@/lib/api/endpoints/ledger';
jest.mock('lucide-react-native', () => ({}));

const record: LedgerRecord = {
  id: '1',
  userId: '2',
  type: 1,
  amount: 35,
  category: 'food',
  recordDate: '2026-11-17',
  remark: null,
};
it('only allows the author to edit or delete a shared record', () => {
  expect(canManageLedgerRecord(record, '2')).toBe(true);
  expect(canManageLedgerRecord(record, '3')).toBe(false);
  expect(canManageLedgerRecord(record, null)).toBe(false);
  expect(
    canManageLedgerRecord(
      { ...record, userId: undefined } as unknown as LedgerRecord,
      '2',
    ),
  ).toBe(false);
});
it.each(['2026-02-29', '2026-02-31', '2026-13-01', '2026-11-00', '2026-1-01'])(
  'rejects impossible date %s',
  (date) => expect(isLedgerDate(date)).toBe(false),
);
it('accepts leap day and a valid recognition draft', () => {
  expect(isLedgerDate('2028-02-29')).toBe(true);
  expect(
    parseAccountingDraft(JSON.stringify({ ...record, remark: '午饭' })),
  ).toMatchObject({ amount: 35, category: 'food' });
});
it.each([
  { amount: -1 },
  { amount: 0.001 },
  { type: 2 },
  { category: 'invented' },
  { recordDate: '2026-02-31' },
  { remark: 'a'.repeat(501) },
])('rejects malformed recognition drafts %j', (change) => {
  expect(
    parseAccountingDraft(JSON.stringify({ ...record, remark: '', ...change })),
  ).toBeNull();
});
