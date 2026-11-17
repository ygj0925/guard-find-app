import { accountingApi } from '../endpoints/accounting';
import {
  createLedgerRecord,
  transferLedgerGroupOwner,
} from '../endpoints/ledger';

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};
const mockRequest = jest.fn();
jest.mock('../client', () => ({
  api: {
    get: (...args: unknown[]) => mockApi.get(...args),
    post: (...args: unknown[]) => mockApi.post(...args),
    put: (...args: unknown[]) => mockApi.put(...args),
    patch: (...args: unknown[]) => mockApi.patch(...args),
    delete: (...args: unknown[]) => mockApi.delete(...args),
  },
  request: (...args: unknown[]) => mockRequest(...args),
}));

beforeEach(() => {
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  mockRequest.mockReset();
});

it('preserves string IDs and the group on writes and owner transfer', async () => {
  const id = '9223372036854775806';
  mockApi.post.mockResolvedValueOnce(id);
  const input = {
    type: 1 as const,
    amount: 20,
    category: 'food',
    recordDate: '2026-11-17',
    groupId: id,
  };
  expect(await createLedgerRecord(input)).toBe(id);
  expect(mockApi.post).toHaveBeenNthCalledWith(1, '/app/ledger/record', input);
  await transferLedgerGroupOwner(id, '9223372036854775805');
  expect(mockApi.post).toHaveBeenNthCalledWith(
    2,
    `/app/ledger/group/${id}/transfer-owner`,
    { nextOwnerId: '9223372036854775805' },
  );
});

it('keeps snapshot version and operation identity and surfaces conflicts without retrying', async () => {
  const input = {
    baseVersion: 9,
    operationId: 'stable-operation-1234',
    payload: '{"format":"jianzhang"}',
  };
  const conflict = new Error('云端账本已更新');
  mockApi.put.mockRejectedValueOnce(conflict);
  await expect(accountingApi.saveSnapshot(input)).rejects.toBe(conflict);
  expect(mockApi.put).toHaveBeenCalledTimes(1);
  expect(mockApi.put).toHaveBeenCalledWith('/app/accounting/snapshot', input, {
    timeoutMs: 60000,
  });
  await accountingApi.snapshot(9);
  expect(mockApi.get).toHaveBeenCalledWith('/app/accounting/snapshot', {
    knownVersion: 9,
  });
  await accountingApi.patchSnapshot({
    baseVersion: 9,
    operationId: input.operationId,
    changes: [{ collection: 'entries', key: 'entry-1', value: null }],
  });
  expect(mockApi.patch).toHaveBeenCalledWith(
    '/app/accounting/snapshot',
    expect.objectContaining({ baseVersion: 9, operationId: input.operationId }),
    { timeoutMs: 60000 },
  );
});

it('uploads receipts privately as multipart and never includes a public storage path', async () => {
  await accountingApi.uploadReceipt({
    uri: 'file:///receipt.png',
    name: 'receipt.png',
    type: 'image/png',
    size: 20,
  });
  const [path, body, options] = mockApi.post.mock.calls[0];
  expect(path).toBe('/app/accounting/receipts');
  expect(body).toBeUndefined();
  expect(options.rawBody.get('file')).toBeTruthy();
  expect(options.rawBody.get('path')).toBeNull();
  expect(options.timeoutMs).toBe(60000);
  await accountingApi.receiptContent('receipt-id');
  expect(mockRequest).toHaveBeenCalledWith(
    '/app/accounting/receipts/receipt-id',
    { responseType: 'blob', timeoutMs: 60000 },
  );
});

it('rejects unsupported or oversized uploads before making a request', () => {
  expect(() =>
    accountingApi.uploadReceipt({
      uri: 'x',
      name: 'x',
      type: 'image/gif',
      size: 10,
    }),
  ).toThrow('5MB');
  expect(() =>
    accountingApi.uploadReceipt({
      uri: 'x',
      name: 'x',
      type: 'image/png',
      size: 5242881,
    }),
  ).toThrow('5MB');
  expect(() =>
    accountingApi.transcribe({
      uri: 'x',
      name: 'x',
      type: 'audio/wav',
      size: 10485761,
    }),
  ).toThrow('10MB');
  expect(mockApi.post).not.toHaveBeenCalled();
});

it('only produces a recognition draft and never posts a ledger record automatically', async () => {
  await accountingApi.recognize({ text: '午饭35元', date: '2026-11-17' });
  expect(mockApi.post).toHaveBeenCalledTimes(1);
  expect(mockApi.post).toHaveBeenCalledWith(
    '/app/accounting/recognize',
    { text: '午饭35元', date: '2026-11-17' },
    { timeoutMs: 75000 },
  );
});
