import { __resetRealtimeForTests, onRealtimeMessage, startRealtime } from '../realtime';

const mockBump = jest.fn();
const mockSetUnread = jest.fn();

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('../env', () => ({
  env: { WS_BASE_URL: 'wss://ws.test', UNREAD_POLL_INTERVAL_MS: 30000, WS_FALLBACK_AFTER_MS: 10000 },
}));
jest.mock('../monitor', () => ({ capture: jest.fn() }));
jest.mock('@/lib/api/endpoints/message', () => ({
  messageApi: { unread: async () => ({ unreadCount: 0 }) },
}));
jest.mock('@/store/session', () => ({
  useSession: {
    getState: () => ({
      token: 'tok',
      unreadCount: 0,
      setUnreadCount: mockSetUnread,
      bumpUnread: mockBump,
    }),
  },
}));

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data?: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event?: { code?: number }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send = jest.fn();
  close = jest.fn();
}

function frame(id: string): { data: string } {
  return { data: JSON.stringify({ type: 'message', data: { id, type: 'CASE_LEAD', title: '新线索' } }) };
}

describe('实时消息去重(spec: 实时到达与降级轮询)', () => {
  const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeSocket.instances = [];
    mockBump.mockReset();
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket;
  });

  afterEach(() => {
    __resetRealtimeForTests();
    jest.useRealTimers();
    (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
  });

  it('同一消息 id 重复到达:监听只回调一次,角标只 +1', () => {
    const listener = jest.fn();
    const off = onRealtimeMessage(listener);
    startRealtime();
    const socket = FakeSocket.instances[0];
    socket.onopen?.();

    socket.onmessage?.(frame('m-1'));
    socket.onmessage?.(frame('m-1'));
    socket.onmessage?.(frame('m-2'));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls.map((call) => call[0].id)).toEqual(['m-1', 'm-2']);
    expect(mockBump).toHaveBeenCalledTimes(2);
    expect(mockBump).toHaveBeenCalledWith(1);
    off();
  });

  it('心跳与坏帧不计入消息', () => {
    const listener = jest.fn();
    const off = onRealtimeMessage(listener);
    startRealtime();
    const socket = FakeSocket.instances[0];
    socket.onopen?.();

    socket.onmessage?.({ data: JSON.stringify({ type: 'ping' }) });
    socket.onmessage?.({ data: '{not json' });
    socket.onmessage?.({ data: JSON.stringify({ type: 'message' }) });

    expect(listener).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
    off();
  });
});
