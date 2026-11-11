import { __resetRealtimeForTests, onRealtimeMessage, parseFrame, startRealtime, stopRealtime } from '../realtime';

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
  onmessage: ((event: { data?: string | ArrayBuffer }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event?: { code?: number }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send = jest.fn();
  close = jest.fn();
}

function message(id: string) {
  return {
    id,
    type: 'CASE_LEAD',
    title: '新线索',
    content: '收到一条新线索',
    bizType: null,
    bizId: null,
    path: null,
    readStatus: false,
    createTime: '2026-01-01T00:00:00Z',
  };
}

function frame(id: string): { data: string } {
  return { data: JSON.stringify({ type: 'message', data: message(id) }) };
}

const invalidFrames: [string, string | ArrayBuffer | undefined][] = [
  ['无数据', undefined],
  ['二进制', new ArrayBuffer(8)],
  ['空文本', ''],
  ['非法 JSON', '{not json'],
  ['null', 'null'],
  ['数组', '[]'],
  ['数值', '1'],
  ['字符串', '"ping"'],
  ['空对象', '{}'],
  ['未知帧类型', '{"type":"unknown"}'],
  ['缺少 data', '{"type":"message"}'],
  ['data 为 null', '{"type":"message","data":null}'],
  ['data 为数组', '{"type":"message","data":[]}'],
];

describe('实时消息去重(spec: 实时到达与降级轮询)', () => {
  const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeSocket.instances = [];
    mockBump.mockReset();
    mockSetUnread.mockReset();
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
    socket.onmessage?.({ data: JSON.stringify({ type: 'pong' }) });
    socket.onmessage?.({ data: '{not json' });
    socket.onmessage?.({ data: JSON.stringify({ type: 'message' }) });

    expect(parseFrame('{"type":"ping"}')).toEqual({ type: 'ping' });
    expect(parseFrame('{"type":"pong"}')).toEqual({ type: 'pong' });
    expect(listener).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
    off();
  });

  it.each([
    'CASE_APPROVED', 'CASE_REJECTED', 'CASE_LEAD', 'LEAD_REPLIED', 'CASE_FOUND',
    'CASE_EXPIRING', 'REPORT_RESULT', 'CASE_PUBLISHED', 'SYSTEM',
  ])('契约消息类型 %s 可解析并正常派发', (type) => {
    const listener = jest.fn();
    onRealtimeMessage(listener);
    startRealtime();
    const data = { ...message('m-1'), type };
    const raw = JSON.stringify({ type: 'message', data });
    expect(parseFrame(raw)).toEqual({ type: 'message', data });
    FakeSocket.instances[0].onmessage?.({ data: raw });
    expect(listener).toHaveBeenCalledWith(data);
    expect(mockBump).toHaveBeenCalledTimes(1);
  });

  it.each([
    { bizId: null, bizType: null, path: null },
    { bizId: '9007199254740993', bizType: 'CASE', path: '/case/9007199254740993' },
  ])('可空业务字段接受 null 或契约 string: %j', (fields) => {
    const data = { ...message('9007199254740993'), ...fields };
    expect(parseFrame(JSON.stringify({ type: 'message', data }))).toEqual({ type: 'message', data });
  });

  it.each([
    'id', 'type', 'title', 'content', 'bizType', 'bizId', 'path', 'readStatus', 'createTime',
  ])('缺少必需字段 %s 时忽略且不消耗去重 ID', (field) => {
    const listener = jest.fn();
    onRealtimeMessage(listener);
    startRealtime();
    const socket = FakeSocket.instances[0];
    const data: Record<string, unknown> = message('m-1');
    delete data[field];
    const raw = JSON.stringify({ type: 'message', data });
    expect(parseFrame(raw)).toBeNull();
    socket.onmessage?.({ data: raw });
    expect(listener).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
    socket.onmessage?.(frame('m-1'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockBump).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Record<string, unknown>]>([
    ['数值 id', { id: 1 }],
    ['非一期类型', { type: 'IM_MESSAGE' }],
    ['非字符串类型', { type: 1 }],
    ['数值标题', { title: 1 }],
    ['空值内容', { content: null }],
    ['数值 bizId', { bizId: 1 }],
    ['对象 bizId', { bizId: {} }],
    ['数值 bizType', { bizType: 1 }],
    ['布尔 path', { path: false }],
    ['对象 path', { path: {} }],
    ['数值 readStatus', { readStatus: 0 }],
    ['数值 createTime', { createTime: 1 }],
  ])('畸形消息 %s 不解析、不派发', (_, patch) => {
    const listener = jest.fn();
    onRealtimeMessage(listener);
    startRealtime();
    const raw = JSON.stringify({ type: 'message', data: { ...message('m-1'), ...patch } });
    expect(parseFrame(raw)).toBeNull();
    FakeSocket.instances[0].onmessage?.({ data: raw });
    expect(listener).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
  });

  it.each(invalidFrames)('畸形/未知外部帧 %s 不解析、不派发', (_, raw) => {
    const listener = jest.fn();
    onRealtimeMessage(listener);
    startRealtime();
    expect(parseFrame(raw)).toBeNull();
    const socket = FakeSocket.instances[0];
    socket.onmessage?.({ data: raw });
    expect(listener).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('已停止生命周期的旧 socket 消息不污染新会话去重或角标', () => {
    const listener = jest.fn();
    onRealtimeMessage(listener);
    startRealtime();
    const oldMessage = FakeSocket.instances[0].onmessage;
    stopRealtime();
    startRealtime();
    oldMessage?.(frame('m-1'));
    expect(listener).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
    FakeSocket.instances[1].onmessage?.(frame('m-1'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockBump).toHaveBeenCalledTimes(1);
  });
});
