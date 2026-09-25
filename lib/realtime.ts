/**
 * 客户端实时通道(spec 7.4 / 契约 5 节 WebSocket 帧)。
 *
 * 规则照抄契约,不做"优化":
 *   - 连 `WS_BASE_URL/websocket?token={appToken}`,服务端只推本 userId;
 *   - 断线超过 10 秒 → 改 30 秒轮询 `GET /app/message/unread`;连上就停掉多余轮询;
 *   - 进后台停止一切(轮询与重连),回前台立即补拉一次;
 *   - 一期无厂商推送,通知偏好页必须明示"关闭 App 后可能收不到实时提醒"。
 *
 * 心跳:收到 `{type:'ping'}` 回 `{type:'pong'}`(部分实现反向,两种都处理)。
 */
import { AppState } from 'react-native';
import { env } from './env';
import { capture } from './monitor';
import { messageApi, type Message, type RealtimeFrame } from '@/lib/api/endpoints/message';
import { useSession } from '@/store/session';

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'polling' | 'closed';

type StatusListener = (status: RealtimeStatus) => void;
type MessageListener = (message: Message) => void;

let socket: WebSocket | null = null;
let currentStatus: RealtimeStatus = 'idle';
let started = false;
let droppedAt: number | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
const statusListeners = new Set<StatusListener>();
const messageListeners = new Set<MessageListener>();
/** 已处理过的消息 id:WS 与轮询双通道不能重复提示。 */
const seen = new Set<string>();
let seenOrder: string[] = [];
let fallbackAnnounced = false;

function emitStatus(next: RealtimeStatus): void {
  if (currentStatus === next) return;
  currentStatus = next;
  for (const listener of statusListeners) listener(next);
}

export function getRealtimeStatus(): RealtimeStatus {
  return currentStatus;
}

export function onRealtimeStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export function onRealtimeMessage(listener: MessageListener): () => void {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

/** `wss://host/websocket?token=...`(契约 0 节"实时通道")。 */
export function buildWsUrl(token: string, baseUrl = env.WS_BASE_URL): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/websocket?token=${encodeURIComponent(token)}`;
}

export function rememberMessageId(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  seenOrder.push(id);
  if (seenOrder.length > 300) {
    const dropped = seenOrder.splice(0, seenOrder.length - 300);
    for (const id2 of dropped) seen.delete(id2);
  }
  return true;
}

function dispatch(message: Message): void {
  if (!rememberMessageId(message.id)) return;
  useSession.getState().bumpUnread(1);
  for (const listener of messageListeners) listener(message);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function syncUnread(): Promise<number> {
  try {
    const { unreadCount } = await messageApi.unread();
    useSession.getState().setUnreadCount(unreadCount);
    return unreadCount;
  } catch {
    return useSession.getState().unreadCount;
  }
}

async function pollOnce(): Promise<void> {
  if (!started) return;
  const count = await syncUnread();
  if (count > 0 && !fallbackAnnounced) {
    fallbackAnnounced = true;
    capture('WARN', '实时通道不可用,已降级为定时轮询提醒', { unreadCount: count });
  }
}

function startPolling(): void {
  if (pollTimer || !started) return;
  emitStatus('polling');
  pollTimer = setInterval(() => {
    void pollOnce();
  }, env.UNREAD_POLL_INTERVAL_MS);
  void pollOnce();
}

function scheduleReconnect(): void {
  if (reconnectTimer || !started) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, env.UNREAD_POLL_INTERVAL_MS);
}

/** 断线满 10 秒才降级轮询 —— 短暂抖动不该打扰用户。 */
function markDropped(): void {
  if (droppedAt === null) droppedAt = Date.now();
  if (Date.now() - droppedAt < env.WS_FALLBACK_AFTER_MS) return;
  if (pollTimer) return;
  startPolling();
  scheduleReconnect();
}

function closeQuietly(ws: WebSocket | null): void {
  if (!ws) return;
  try {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
  } catch {
    // 已经断了。
  }
}

function connect(): void {
  if (!started) return;
  const { token } = useSession.getState();
  if (!token) return;
  closeQuietly(socket);
  socket = null;
  emitStatus('connecting');

  let ws: WebSocket;
  try {
    ws = new WebSocket(buildWsUrl(token));
  } catch (caught) {
    capture('WARN', 'WebSocket 创建失败,改用轮询', {
      detail: caught instanceof Error ? caught.message : String(caught),
    });
    startPolling();
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    droppedAt = null;
    fallbackAnnounced = false;
    stopPolling();
    emitStatus('open');
    // 连上后补一次,把断线期间漏掉的未读数拉平。
    void syncUnread();
  };

  ws.onmessage = (event: { data?: string | ArrayBuffer }) => {
    const frame = parseFrame(event?.data);
    if (!frame) return;
    if (frame.type === 'ping') {
      safeSend({ type: 'pong' });
      return;
    }
    if (frame.type === 'pong') return;
    if (frame.type === 'message' && frame.data) dispatch(frame.data);
  };

  ws.onerror = () => markDropped();
  ws.onclose = () => {
    if (!started) {
      emitStatus('closed');
      return;
    }
    emitStatus('closed');
    markDropped();
    scheduleReconnect();
  };
}

function safeSend(payload: RealtimeFrame): void {
  try {
    socket?.send(JSON.stringify(payload));
  } catch {
    markDropped();
  }
}

export function parseFrame(raw: unknown): RealtimeFrame | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as RealtimeFrame;
    return parsed && typeof parsed.type === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** 登录成功后调用;重复调用安全。 */
export function startRealtime(): void {
  if (started) return;
  started = true;
  connect();
  appStateSubscription = AppState.addEventListener('change', (next) => {
    if (next === 'background' || next === 'inactive') {
      // 后台不发请求(spec: 后台不发请求)。
      stopPolling();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      closeQuietly(socket);
      socket = null;
      emitStatus('closed');
      return;
    }
    if (!started) return;
    void syncUnread();
    connect();
  });
}

export function stopRealtime(): void {
  started = false;
  stopPolling();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  appStateSubscription?.remove();
  appStateSubscription = null;
  closeQuietly(socket);
  socket = null;
  droppedAt = null;
  emitStatus('idle');
}

export function isPollingFallback(): boolean {
  return pollTimer !== null;
}

/** 测试辅助。 */
export function __resetRealtimeForTests(): void {
  stopRealtime();
  seen.clear();
  seenOrder = [];
  fallbackAnnounced = false;
  statusListeners.clear();
  messageListeners.clear();
}
