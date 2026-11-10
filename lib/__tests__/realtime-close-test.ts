import {
  __resetRealtimeForTests,
  getRealtimeStatus,
  isPollingFallback,
  startRealtime,
  WS_CLOSE_POLICY_VIOLATION,
} from '../realtime';

const mockCapture = jest.fn();
const mockUnread = jest.fn(async () => ({ unreadCount: 0 }));

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('../env', () => ({
  env: { WS_BASE_URL: 'wss://ws.test', UNREAD_POLL_INTERVAL_MS: 30000, WS_FALLBACK_AFTER_MS: 10000 },
}));
jest.mock('../monitor', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }));
jest.mock('@/lib/api/endpoints/message', () => ({ messageApi: { unread: () => mockUnread() } }));
jest.mock('@/store/session', () => ({
  useSession: {
    getState: () => ({ token: 'tok', unreadCount: 0, setUnreadCount: jest.fn(), bumpUnread: jest.fn() }),
  },
}));

type CloseEvent = { code?: number; reason?: string };

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data?: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event?: CloseEvent) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send = jest.fn();
  close = jest.fn();
}

function latest(): FakeSocket {
  return FakeSocket.instances[FakeSocket.instances.length - 1];
}

describe('实时通道断线处理', () => {
  const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeSocket.instances = [];
    mockCapture.mockReset();
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket;
  });

  afterEach(() => {
    __resetRealtimeForTests();
    jest.useRealTimers();
    (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
  });

  it('连上后被 1008 关闭:立即改轮询,不再重连 WS', () => {
    startRealtime();
    latest().onopen?.();
    latest().onclose?.({ code: WS_CLOSE_POLICY_VIOLATION, reason: '未识别的登录态' });

    expect(isPollingFallback()).toBe(true);
    expect(getRealtimeStatus()).toBe('polling');
    jest.advanceTimersByTime(120000);
    expect(FakeSocket.instances).toHaveLength(1);
    const detail = mockCapture.mock.calls.find((call) => String(call[1]).includes('鉴权失败'))?.[2];
    expect(detail).toEqual({ code: 1008, reason: '未识别的登录态' });
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('tok');
  });

  it('握手连续 3 次未 open 就关闭:按鉴权失败停掉重连', () => {
    startRealtime();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      latest().onclose?.({ code: 1006 });
      if (attempt < 2) jest.advanceTimersByTime(30000);
    }

    expect(FakeSocket.instances).toHaveLength(3);
    expect(isPollingFallback()).toBe(true);
    jest.advanceTimersByTime(120000);
    expect(FakeSocket.instances).toHaveLength(3);
  });

  it('连上后普通断线:照常安排重连', () => {
    startRealtime();
    latest().onopen?.();
    latest().onclose?.({ code: 1006 });

    expect(isPollingFallback()).toBe(false);
    jest.advanceTimersByTime(30000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('WS 地址带 token 但日志不带', () => {
    startRealtime();
    expect(latest().url).toBe('wss://ws.test/websocket?token=tok');
    latest().onclose?.({ code: WS_CLOSE_POLICY_VIOLATION });
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('websocket?token');
  });
});
