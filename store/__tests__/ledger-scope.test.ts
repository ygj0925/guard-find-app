import { useLedgerScope } from '../ledger-scope';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';

const mockSession: { user: { id: string } | null; token: string | null } = {
  user: { id: '1' },
  token: 'token-1',
};
let mockListener: (
  next: typeof mockSession,
  previous: typeof mockSession,
) => void;
jest.mock('../session', () => ({
  useSession: {
    getState: () => mockSession,
    subscribe: (listener: typeof mockListener) => {
      mockListener = listener;
    },
  },
}));
jest.mock('@/lib/storage/kv', () => ({
  kvGetJson: jest.fn(),
  kvSetJson: jest.fn(),
}));
beforeEach(() => {
  mockSession.user = { id: '1' };
  mockSession.token = 'token-1';
  useLedgerScope.setState({
    loaded: false,
    userId: null,
    groupId: null,
    scopeName: null,
  });
  (kvGetJson as jest.Mock)
    .mockReset()
    .mockResolvedValue({ groupId: null, scopeName: null });
  (kvSetJson as jest.Mock).mockReset().mockResolvedValue(undefined);
});
it('persists scope under the current user instead of a shared device key', async () => {
  await useLedgerScope.getState().setScope('5', '家庭');
  expect(kvSetJson).toHaveBeenCalledWith('guardfind.ledger-scope.v2:1', {
    groupId: '5',
    scopeName: '家庭',
  });
});
it('discards an old account load after another user has selected their scope', async () => {
  let resolve!: (value: unknown) => void;
  (kvGetJson as jest.Mock).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const first = useLedgerScope.getState().load();
  mockSession.user = { id: '2' };
  mockSession.token = 'token-2';
  await useLedgerScope.getState().setScope('8', '新家庭');
  resolve({ groupId: 'old', scopeName: '旧账号' });
  await first;
  expect(useLedgerScope.getState()).toMatchObject({
    userId: '2',
    groupId: '8',
    scopeName: '新家庭',
  });
});
it('clears the group immediately on logout and never restores the unowned legacy key', async () => {
  await useLedgerScope.getState().setScope('5', '家庭');
  const previous = { ...mockSession };
  mockSession.user = null;
  mockSession.token = null;
  mockListener(mockSession, previous);
  expect(useLedgerScope.getState()).toMatchObject({
    userId: null,
    groupId: null,
    scopeName: null,
  });
  expect(kvGetJson).not.toHaveBeenCalledWith(
    'guardfind.ledger-scope.v1',
    expect.anything(),
  );
});
