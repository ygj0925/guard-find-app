import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useLedgerFeed } from '../useLedgerFeed';
import {
  fetchLedgerRecords,
  fetchLedgerSummary,
} from '@/lib/api/endpoints/ledger';
import type { LedgerRecord } from '@/lib/api/endpoints/ledger';

const mockState = { token: 'first' };
jest.mock('@/store/session', () => ({
  useSession: Object.assign(
    (select: (state: typeof mockState) => unknown) => select(mockState),
    { getState: () => mockState },
  ),
}));
jest.mock('@/lib/api/endpoints/ledger', () => ({
  fetchLedgerRecords: jest.fn(),
  fetchLedgerSummary: jest.fn(),
}));
const records = fetchLedgerRecords as jest.Mock;
const summary = fetchLedgerSummary as jest.Mock;
let renderer: TestRenderer.ReactTestRenderer;
let latest: ReturnType<typeof useLedgerFeed>;
function Probe({
  month,
  group,
  enabled = true,
}: {
  month: string;
  group: string | null;
  enabled?: boolean;
}) {
  latest = useLedgerFeed(month, enabled, group);
  return null;
}
async function render(
  month = '2026-11',
  group: string | null = null,
  enabled = true,
) {
  await act(async () => {
    renderer = TestRenderer.create(
      <Probe month={month} group={group} enabled={enabled} />,
    );
  });
  await tick();
}
async function tick() {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  mockState.token = 'first';
  records
    .mockReset()
    .mockResolvedValue({
      records: [
        {
          id: '1',
          userId: '1',
          type: 1,
          amount: 10,
          category: 'food',
          recordDate: '2026-11-17',
          remark: null,
        } satisfies LedgerRecord,
      ],
      total: 30,
    });
  summary
    .mockReset()
    .mockResolvedValue({ totalExpense: 500, totalIncome: 900 });
});
afterEach(() => {
  act(() => renderer?.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('uses full monthly totals rather than the current page and passes the group to both endpoints', async () => {
  await render('2026-11', '5');
  expect(latest.monthExpense).toBe(500);
  expect(latest.monthIncome).toBe(900);
  expect(records).toHaveBeenCalledWith({
    month: '2026-11',
    groupId: '5',
    page: 1,
    size: 20,
  });
  expect(summary).toHaveBeenCalledWith({
    period: 'month',
    date: '2026-11-01',
    groupId: '5',
  });
});
it('refetches a previously visited month and invalidates responses from another scope', async () => {
  await render();
  await act(async () => {
    renderer.update(<Probe month="2026-10" group={null} />);
  });
  await tick();
  await act(async () => {
    renderer.update(<Probe month="2026-11" group="7" />);
  });
  await tick();
  expect(records).toHaveBeenCalledTimes(3);
  let resolve!: (value: unknown) => void;
  records.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => {
    void latest.refresh();
  });
  await act(async () => {
    renderer.update(<Probe month="2026-11" group="8" />);
  });
  await tick();
  await act(async () => {
    resolve({ records: [{ id: 'stale' }], total: 1 });
  });
  expect(
    latest.groups
      .flatMap((day) => day.records)
      .some((record) => record.id === 'stale'),
  ).toBe(false);
});
it('does not fetch private records while disabled and clears an old account on logout', async () => {
  await render('2026-11', null, false);
  expect(records).not.toHaveBeenCalled();
  await act(async () => {
    renderer.update(<Probe month="2026-11" group={null} />);
  });
  await tick();
  mockState.token = '';
  await act(async () => {
    renderer.update(<Probe month="2026-11" group={null} enabled={false} />);
  });
  expect(latest.groups).toEqual([]);
  expect(latest.monthExpense).toBe(0);
});
