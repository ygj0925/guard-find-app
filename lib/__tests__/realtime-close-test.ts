import { AppState } from 'react-native';
import {
  __resetRealtimeForTests,
  buildWsUrl,
  getRealtimeStatus,
  isPollingFallback,
  startRealtime,
  stopRealtime,
  WS_CLOSE_POLICY_VIOLATION,
} from '../realtime';

const mockCapture = jest.fn();
const mockUnread = jest.fn<Promise<{ unreadCount: number }>, []>();
const mockSetUnread = jest.fn();
let mockToken: string | null = 'tok';

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('../env', () => ({
  env: { WS_BASE_URL: 'wss://ws.test', UNREAD_POLL_INTERVAL_MS: 30000, WS_FALLBACK_AFTER_MS: 10000 },
}));
jest.mock('../monitor', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }));
jest.mock('@/lib/api/endpoints/message', () => ({ messageApi: { unread: () => mockUnread() } }));
jest.mock('@/store/session', () => ({
  useSession: {
    getState: () => ({ token: mockToken, unreadCount: 0, setUnreadCount: mockSetUnread, bumpUnread: jest.fn() }),
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

function changeState(next: 'active' | 'background' | 'inactive'): void {
  AppState.currentState = next;
  const calls = jest.mocked(AppState.addEventListener).mock.calls;
  calls[calls.length - 1][1](next);
}

function deferredUnread(): {
  promise: Promise<{ unreadCount: number }>;
  resolve: (value: { unreadCount: number }) => void;
} {
  let resolve!: (value: { unreadCount: number }) => void;
  const promise = new Promise<{ unreadCount: number }>((done) => { resolve = done; });
  return { promise, resolve };
}

async function flushUnread(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('实时通道断线处理', () => {
  const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeSocket.instances = [];
    mockCapture.mockReset();
    mockUnread.mockReset().mockResolvedValue({ unreadCount: 0 });
    mockSetUnread.mockReset();
    mockToken = 'tok';
    AppState.currentState = 'active';
    jest.mocked(AppState.addEventListener).mockClear();
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
    expect(getRealtimeStatus()).toBe('polling');
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

  it('握手静默挂起仍在 10 秒降级,30 秒关闭旧连接并重试', () => {
    startRealtime();
    const pending = latest();
    jest.advanceTimersByTime(9999);
    expect(isPollingFallback()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(isPollingFallback()).toBe(true);
    expect(mockUnread).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(20000);
    expect(pending.close).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(2);
    latest().onopen?.();
    expect(isPollingFallback()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('直接切换 token 后重新建连,相同 token 重复启动不建多余连接', () => {
    startRealtime();
    const previous = latest();
    previous.onopen?.();
    startRealtime();
    expect(FakeSocket.instances).toHaveLength(1);
    mockToken = 'another-session';
    startRealtime();
    expect(previous.close).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(latest().url).toBe('wss://ws.test/app/websocket?token=another-session');
    latest().onopen?.();
    expect(getRealtimeStatus()).toBe('open');
  });

  it('WS 地址带 token 但日志不带', () => {
    startRealtime();
    expect(latest().url).toBe('wss://ws.test/app/websocket?token=tok');
    latest().onclose?.({ code: WS_CLOSE_POLICY_VIOLATION });
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('websocket?token');
  });

  it('根 host 去尾斜杠并编码 token,使用 /app/websocket', () => {
    expect(buildWsUrl('a+b /?&=中文', 'wss://ws.test///')).toBe(
      'wss://ws.test/app/websocket?token=a%2Bb%20%2F%3F%26%3D%E4%B8%AD%E6%96%87',
    );
  });

  it('9.999 秒不轮询,10 秒立即轮询,30 秒才重连', () => {
    startRealtime();
    latest().onopen?.();
    latest().onclose?.({ code: 1006 });
    jest.advanceTimersByTime(9999);
    expect(isPollingFallback()).toBe(false);
    expect(mockUnread).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(isPollingFallback()).toBe(true);
    expect(getRealtimeStatus()).toBe('polling');
    expect(mockUnread).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(19999);
    expect(FakeSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('error 后延迟 close 不重置首次断线的 10 秒与 30 秒时限', () => {
    startRealtime();
    latest().onopen?.();
    latest().onerror?.();
    jest.advanceTimersByTime(5000);
    latest().onclose?.({ code: 1006 });
    jest.advanceTimersByTime(4999);
    expect(isPollingFallback()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(isPollingFallback()).toBe(true);
    jest.advanceTimersByTime(20000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('10 秒前成功 open 清理降级和重连计时器', () => {
    startRealtime();
    latest().onerror?.();
    jest.advanceTimersByTime(9999);
    latest().onopen?.();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(90000);
    expect(isPollingFallback()).toBe(false);
    expect(getRealtimeStatus()).toBe('open');
    expect(mockUnread).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('轮询后重连成功立即停止轮询', () => {
    startRealtime();
    latest().onopen?.();
    latest().onclose?.({ code: 1006 });
    jest.advanceTimersByTime(30000);
    expect(isPollingFallback()).toBe(true);
    latest().onopen?.();
    expect(isPollingFallback()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(90000);
    expect(mockUnread).toHaveBeenCalledTimes(3);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it.each(['background', 'inactive'] as const)('%s 清理降级;回前台重新从首次断线计时', (state) => {
    startRealtime();
    latest().onopen?.();
    latest().onclose?.({ code: 1006 });
    jest.advanceTimersByTime(9999);
    changeState(state);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(90000);
    expect(isPollingFallback()).toBe(false);
    expect(mockUnread).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(1);
    changeState('active');
    expect(mockUnread).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(2);
    latest().onclose?.({ code: 1006 });
    jest.advanceTimersByTime(9999);
    expect(isPollingFallback()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(isPollingFallback()).toBe(true);
  });

  it('后台停止已经启动的轮询和重连', () => {
    startRealtime();
    latest().onopen?.();
    latest().onclose?.({ code: 1006 });
    jest.advanceTimersByTime(10000);
    changeState('background');
    expect(isPollingFallback()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(90000);
    expect(mockUnread).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it.each([9999, 10000])('stop 在 %i 毫秒清理降级/轮询/重连', (delay) => {
    startRealtime();
    latest().onopen?.();
    latest().onclose?.({ code: 1006 });
    jest.advanceTimersByTime(delay);
    const calls = mockUnread.mock.calls.length;
    stopRealtime();
    expect(jest.getTimerCount()).toBe(0);
    expect(getRealtimeStatus()).toBe('idle');
    expect(isPollingFallback()).toBe(false);
    jest.advanceTimersByTime(90000);
    expect(mockUnread).toHaveBeenCalledTimes(calls);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('后台启动不连接、不拉未读,回前台立即补拉', () => {
    AppState.currentState = 'background';
    startRealtime();
    jest.advanceTimersByTime(90000);
    expect(FakeSocket.instances).toHaveLength(0);
    expect(mockUnread).not.toHaveBeenCalled();
    changeState('active');
    expect(FakeSocket.instances).toHaveLength(1);
    expect(mockUnread).toHaveBeenCalledTimes(1);
  });

  it.each(['background', 'stop'] as const)('%s 后在途未读响应不回写', async (action) => {
    const pending = deferredUnread();
    mockUnread.mockReturnValueOnce(pending.promise);
    startRealtime();
    latest().onopen?.();
    if (action === 'background') changeState('background');
    else stopRealtime();
    pending.resolve({ unreadCount: 99 });
    await flushUnread();
    expect(mockSetUnread).not.toHaveBeenCalled();
  });

  it.each(['foreground', 'restart'] as const)('%s 后同 token 的旧未读响应仍被忽略', async (action) => {
    const pending = deferredUnread();
    mockUnread.mockReturnValueOnce(pending.promise);
    startRealtime();
    latest().onopen?.();
    if (action === 'foreground') {
      changeState('background');
      changeState('active');
    } else {
      stopRealtime();
      startRealtime();
      latest().onopen?.();
    }
    await flushUnread();
    expect(mockSetUnread).toHaveBeenCalledWith(0);
    pending.resolve({ unreadCount: 99 });
    await flushUnread();
    expect(mockSetUnread).toHaveBeenCalledTimes(1);
    expect(mockSetUnread).not.toHaveBeenCalledWith(99);
  });

  it.each([null, 'another-session'])('token 变为 %s 时旧未读不回写,旧 socket 不再发请求', async (token) => {
    const pending = deferredUnread();
    mockUnread.mockReturnValueOnce(pending.promise);
    startRealtime();
    latest().onopen?.();
    mockToken = token;
    pending.resolve({ unreadCount: 99 });
    await flushUnread();
    latest().onopen?.();
    latest().onmessage?.({ data: '{"type":"ping"}' });
    latest().onerror?.();
    expect(mockSetUnread).not.toHaveBeenCalled();
    expect(mockUnread).toHaveBeenCalledTimes(1);
    expect(latest().send).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('旧轮询响应不污染新会话未读或降级提醒', async () => {
    startRealtime();
    latest().onopen?.();
    await flushUnread();
    const pending = deferredUnread();
    mockUnread.mockReturnValueOnce(pending.promise);
    latest().onclose?.({ code: WS_CLOSE_POLICY_VIOLATION });
    stopRealtime();
    mockToken = 'another-session';
    startRealtime();
    latest().onopen?.();
    await flushUnread();
    pending.resolve({ unreadCount: 99 });
    await flushUnread();
    expect(mockSetUnread).not.toHaveBeenCalledWith(99);
    expect(mockCapture.mock.calls.some((call) => String(call[1]).includes('已降级为定时轮询提醒'))).toBe(false);
  });

  it('旧 socket 的已排队事件不能改新 socket 状态或触发请求', () => {
    startRealtime();
    const old = latest();
    const events = { open: old.onopen, error: old.onerror, close: old.onclose, message: old.onmessage };
    old.onopen?.();
    old.onclose?.({ code: 1006 });
    jest.advanceTimersByTime(30000);
    const current = latest();
    current.onopen?.();
    mockUnread.mockClear();
    events.open?.();
    events.error?.();
    events.close?.({ code: WS_CLOSE_POLICY_VIOLATION });
    events.message?.({ data: '{"type":"ping"}' });
    expect(getRealtimeStatus()).toBe('open');
    expect(isPollingFallback()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(mockUnread).not.toHaveBeenCalled();
    expect(current.send).not.toHaveBeenCalled();
    expect(old.send).not.toHaveBeenCalled();
  });

  it('stop 后旧 AppState 回调不能关闭新会话 socket', () => {
    startRealtime();
    const oldChange = jest.mocked(AppState.addEventListener).mock.calls[0][1];
    stopRealtime();
    startRealtime();
    latest().onopen?.();
    oldChange('background');
    expect(getRealtimeStatus()).toBe('open');
    expect(latest().close).not.toHaveBeenCalled();
  });
});
