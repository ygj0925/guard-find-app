jest.mock('../../env', () => ({ env: { WS_BASE_URL: 'ws://test.local' } }));
jest.mock('../../monitor', () => ({ capture: jest.fn() }));

class FakeSocket {
  static instances: FakeSocket[] = [];
  url: string;
  closed = false;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
}

function load() {
  jest.resetModules();
  FakeSocket.instances = [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 每个用例重建模块级连接状态
  const { useSession } = require('../../../store/session') as typeof import('../../../store/session');
  useSession.setState({ token: null });
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 每个用例重建模块级连接状态
  const { imRealtime } = require('../im-realtime') as typeof import('../im-realtime');
  return { imRealtime, useSession };
}

function setToken(useSession: ReturnType<typeof load>['useSession'], token: string | null) {
  useSession.setState({ token });
}

describe('im-realtime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (global as { WebSocket?: unknown }).WebSocket = FakeSocket;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('closes the old socket and reconnects with the new token', () => {
    const { imRealtime, useSession } = load();
    setToken(useSession, 'token-a');
    const off = imRealtime.subscribe({ conversationId: '7', onPush: jest.fn() });
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0].url).toContain('token-a');

    setToken(useSession, 'token-b');
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[0].closed).toBe(true);
    expect(FakeSocket.instances[1].url).toContain('token-b');
    expect(FakeSocket.instances[1].closed).toBe(false);
    off();
  });

  it('disconnects on logout and reconnects when a new session subscribes', () => {
    const { imRealtime, useSession } = load();
    setToken(useSession, 'token-a');
    imRealtime.subscribe({ conversationId: '7', onPush: jest.fn() });

    setToken(useSession, null);
    expect(FakeSocket.instances[0].closed).toBe(true);

    setToken(useSession, 'token-b');
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1].url).toContain('token-b');
  });

  it('does not reconnect after the last subscriber leaves', () => {
    const { imRealtime, useSession } = load();
    setToken(useSession, 'token-a');
    const off = imRealtime.subscribe({ conversationId: '7', onPush: jest.fn() });

    off();
    expect(FakeSocket.instances[0].closed).toBe(true);
    jest.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('reconnects once after an unexpected close while subscribed', () => {
    const { imRealtime, useSession } = load();
    setToken(useSession, 'token-a');
    imRealtime.subscribe({ conversationId: '7', onPush: jest.fn() });

    FakeSocket.instances[0].onclose?.();
    jest.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1].url).toContain('token-a');

    jest.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('routes pushes only to matching conversations and support subscribers', () => {
    const { imRealtime, useSession } = load();
    setToken(useSession, 'token-a');
    const conversation = jest.fn();
    const other = jest.fn();
    const support = jest.fn();
    const all = jest.fn();
    imRealtime.subscribe({ conversationId: '7', onPush: conversation });
    imRealtime.subscribe({ conversationId: '8', onPush: other });
    imRealtime.subscribe({ conversationId: 'support', onPush: support });
    imRealtime.subscribe({ conversationId: '*', onPush: all });
    const socket = FakeSocket.instances[0];

    socket.onmessage?.({ data: JSON.stringify({ action: 'new_message', conversationId: 7 }) });
    expect(conversation).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(support).not.toHaveBeenCalled();
    expect(all).toHaveBeenCalledTimes(1);

    socket.onmessage?.({ data: JSON.stringify({ action: 'admin_message' }) });
    expect(support).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledTimes(2);
  });

  it('ignores frames from a socket that was replaced', () => {
    const { imRealtime, useSession } = load();
    setToken(useSession, 'token-a');
    const onPush = jest.fn();
    imRealtime.subscribe({ conversationId: '7', onPush });
    const oldSocket = FakeSocket.instances[0];

    setToken(useSession, 'token-b');
    oldSocket.onmessage?.({ data: JSON.stringify({ action: 'new_message', conversationId: 7 }) });
    expect(onPush).not.toHaveBeenCalled();

    FakeSocket.instances[1].onmessage?.({ data: JSON.stringify({ action: 'new_message', conversationId: 7 }) });
    expect(onPush).toHaveBeenCalledTimes(1);
  });
});
