/**
 * 客户端实时通道(spec 7.4 / 契约 5 节 WebSocket 帧)。
 *
 * 规则照抄契约,不做"优化":
 *   - 连 `WS_BASE_URL/app/websocket?token={appToken}`,服务端只推本 userId;
 *   - 断线超过 10 秒 → 改 30 秒轮询 `GET /app/message/unread`;连上就停掉多余轮询;
 *   - 进后台停止一切(轮询与重连),回前台立即补拉一次;
 *   - 一期无厂商推送,通知偏好页必须明示"关闭 App 后可能收不到实时提醒"。
 *
 * 心跳:收到 `{type:'ping'}` 回 `{type:'pong'}`(部分实现反向,两种都处理)。
 *
 * 鉴权失败与普通断线分开处理:
 *   - 连上后被服务端以 1008 关闭(登录态无法识别 / 会话数超限):不再重连 WS,立即改轮询;
 *   - 握手被拒(HTTP 401)在客户端只表现为"没 open 就 close",连续 3 次即按鉴权失败处理。
 *   轮询走 HTTP 客户端,token 真失效时由它统一触发 401 登出,这里不另做登出。
 */
import { AppState } from 'react-native';
import { env } from './env';
import { capture } from './monitor';
import { messageApi, type Message, type RealtimeFrame } from '@/lib/api/endpoints/message';
import { useSession } from '@/store/session';

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'polling' | 'closed';

export const WS_CLOSE_POLICY_VIOLATION = 1008;
const MAX_HANDSHAKE_FAILURES = 3;
const MESSAGE_TYPES = new Set<Message['type']>([
  'CASE_APPROVED',
  'CASE_REJECTED',
  'CASE_LEAD',
  'LEAD_REPLIED',
  'CASE_FOUND',
  'CASE_EXPIRING',
  'REPORT_RESULT',
  'CASE_PUBLISHED',
  'SYSTEM',
]);

type StatusListener = (status: RealtimeStatus) => void;
type MessageListener = (message: Message) => void;

let socket: WebSocket | null = null;
let currentStatus: RealtimeStatus = 'idle';
let started = false;
let foreground = false;
let lifecycleGeneration = 0;
let lifecycleToken: string | null = null;
let droppedAt: number | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let handshakeFailures = 0;
let authRejected = false;
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

/** WS_BASE_URL 是 API 根 host,服务端入口为 `/app/websocket`。 */
export function buildWsUrl(token: string, baseUrl = env.WS_BASE_URL): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/app/websocket?token=${encodeURIComponent(token)}`;
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

function isCurrentLifecycle(generation = lifecycleGeneration, token = lifecycleToken): boolean {
  return started && foreground && generation === lifecycleGeneration && token !== null
    && token === lifecycleToken && token === useSession.getState().token;
}

async function syncUnread(): Promise<number | null> {
  const generation = lifecycleGeneration;
  const token = lifecycleToken;
  if (!isCurrentLifecycle(generation, token)) return null;
  try {
    const { unreadCount } = await messageApi.unread();
    if (!isCurrentLifecycle(generation, token)) return null;
    useSession.getState().setUnreadCount(unreadCount);
    return unreadCount;
  } catch {
    return isCurrentLifecycle(generation, token) ? useSession.getState().unreadCount : null;
  }
}

async function pollOnce(): Promise<void> {
  const generation = lifecycleGeneration;
  const token = lifecycleToken;
  if (!isCurrentLifecycle(generation, token)) return;
  const count = await syncUnread();
  if (!isCurrentLifecycle(generation, token) || count === null) return;
  if (count > 0 && !fallbackAnnounced) {
    fallbackAnnounced = true;
    capture('WARN', '实时通道不可用,已降级为定时轮询提醒', { unreadCount: count });
  }
}

function startPolling(): void {
  if (!isCurrentLifecycle()) return;
  const generation = lifecycleGeneration;
  const token = lifecycleToken;
  emitStatus('polling');
  if (pollTimer || !isCurrentLifecycle(generation, token)) return;
  pollTimer = setInterval(() => {
    if (isCurrentLifecycle(generation, token)) void pollOnce();
  }, env.UNREAD_POLL_INTERVAL_MS);
  void pollOnce();
}

function stopReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearFallback(): void {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  droppedAt = null;
}

function scheduleReconnect(): void {
  if (reconnectTimer || !isCurrentLifecycle() || authRejected) return;
  const generation = lifecycleGeneration;
  const token = lifecycleToken;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (isCurrentLifecycle(generation, token)) connect();
  }, env.UNREAD_POLL_INTERVAL_MS);
}

/** 鉴权类失败:停掉 WS 重连,只靠轮询;下次回前台或重新登录再试。 */
function giveUpReconnect(detail: Record<string, unknown>): void {
  authRejected = true;
  stopReconnect();
  clearFallback();
  capture('WARN', '实时通道鉴权失败,停止重连并改用轮询', detail);
  startPolling();
}

/** 首次断线起独立计时,满 10 秒降级;重连仍按 30 秒安排。 */
function markDropped(): void {
  if (!isCurrentLifecycle()) return;
  if (droppedAt === null) droppedAt = Date.now();
  if (!fallbackTimer && !pollTimer) {
    const generation = lifecycleGeneration;
    const token = lifecycleToken;
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      if (isCurrentLifecycle(generation, token)) startPolling();
    }, Math.max(0, env.WS_FALLBACK_AFTER_MS - (Date.now() - droppedAt)));
  }
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
  const generation = lifecycleGeneration;
  const token = lifecycleToken;
  if (!token || !isCurrentLifecycle(generation, token)) return;
  const previous = socket;
  socket = null;
  closeQuietly(previous);
  emitStatus('connecting');

  let ws: WebSocket;
  try {
    ws = new WebSocket(buildWsUrl(token));
  } catch {
    // 异常文本可能含带 token 的 URL,不要记入日志。
    capture('WARN', 'WebSocket 创建失败,等待重连');
    markDropped();
    return;
  }
  socket = ws;
  let opened = false;
  const isCurrentSocket = () => socket === ws && isCurrentLifecycle(generation, token);

  ws.onopen = () => {
    if (!isCurrentSocket()) return;
    opened = true;
    handshakeFailures = 0;
    clearFallback();
    stopReconnect();
    fallbackAnnounced = false;
    stopPolling();
    emitStatus('open');
    // 连上后补一次,把断线期间漏掉的未读数拉平。
    void syncUnread();
  };

  ws.onmessage = (event: { data?: string | ArrayBuffer }) => {
    if (!isCurrentSocket()) return;
    const frame = parseFrame(event?.data);
    if (!frame) return;
    if (frame.type === 'ping') {
      safeSend(ws, { type: 'pong' });
      return;
    }
    if (frame.type === 'pong') return;
    dispatch(frame.data);
  };

  ws.onerror = () => {
    if (isCurrentSocket()) markDropped();
  };
  ws.onclose = (event?: { code?: number; reason?: string }) => {
    if (!isCurrentSocket()) return;
    socket = null;
    emitStatus('closed');
    if (event?.code === WS_CLOSE_POLICY_VIOLATION) {
      giveUpReconnect({ code: event.code, reason: event.reason ?? '' });
      return;
    }
    if (!opened) {
      handshakeFailures += 1;
      if (handshakeFailures >= MAX_HANDSHAKE_FAILURES) {
        giveUpReconnect({ code: event?.code ?? 0, handshakeFailures });
        return;
      }
    }
    markDropped();
  };
  markDropped();
}

function safeSend(ws: WebSocket, payload: RealtimeFrame): void {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    markDropped();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false;
  // ID 只接受契约 string,不猜测兼容服务端数值 ID。
  return typeof value.id === 'string'
    && typeof value.type === 'string' && MESSAGE_TYPES.has(value.type as Message['type'])
    && typeof value.title === 'string'
    && typeof value.content === 'string'
    && isNullableString(value.bizType)
    && isNullableString(value.bizId)
    && isNullableString(value.path)
    && typeof value.readStatus === 'boolean'
    && typeof value.createTime === 'string';
}

export function parseFrame(raw: unknown): RealtimeFrame | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.type === 'ping' || parsed.type === 'pong') return { type: parsed.type };
    if (parsed.type === 'message' && isMessage(parsed.data)) {
      return { type: 'message', data: parsed.data };
    }
    return null;
  } catch {
    return null;
  }
}

/** 登录成功后调用;重复调用安全。 */
export function startRealtime(): void {
  if (started && lifecycleToken === useSession.getState().token) return;
  if (started) stopRealtime();
  started = true;
  foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  lifecycleGeneration += 1;
  lifecycleToken = useSession.getState().token;
  appStateSubscription = AppState.addEventListener('change', (next) => {
    // 即便旧订阅的回调已排队,也不能影响重新启动后的生命周期。
    if (!started || appStateSubscription !== subscription) return;
    if (next === 'background' || next === 'inactive') {
      foreground = false;
      lifecycleGeneration += 1;
      // 后台不发请求,在途响应也不回写。
      stopPolling();
      stopReconnect();
      clearFallback();
      const previous = socket;
      socket = null;
      closeQuietly(previous);
      emitStatus('closed');
      return;
    }
    if (next !== 'active' || foreground) return;
    foreground = true;
    lifecycleGeneration += 1;
    lifecycleToken = useSession.getState().token;
    authRejected = false;
    handshakeFailures = 0;
    void syncUnread();
    connect();
  });
  const subscription = appStateSubscription;
  if (isCurrentLifecycle()) connect();
  else emitStatus('closed');
}

export function stopRealtime(): void {
  started = false;
  foreground = false;
  lifecycleGeneration += 1;
  lifecycleToken = null;
  authRejected = false;
  handshakeFailures = 0;
  stopPolling();
  stopReconnect();
  clearFallback();
  appStateSubscription?.remove();
  appStateSubscription = null;
  const previous = socket;
  socket = null;
  closeQuietly(previous);
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
