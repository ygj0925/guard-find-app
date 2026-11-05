/**
 * IM 实时推送能力(默认实现:WebSocket)。
 *
 * 设计取舍(spec:平台能力分派层):
 *   - 服务端在 /ws/im 维护 userId → sessions 推送 `{action:'new_message', ...}`;
 *   - 客户端收到推送后只做一件事:立刻触发一次 REST 增量拉取,
 *     消息追加/去重/标已读仍走聊天页已有的轮询代码路径,WS 仅负责"提速";
 *   - 连接失败/断开不重试到无限:一次失败即放弃,聊天页 3 秒轮询天然兜底;
 *   - 多个聊天页同时在线时共享一条连接(引用计数),会话切换复用连接;
 *   - 身份切换时旧连接必须关闭,避免用上一个账号的 token 继续收推送。
 */
import { AppState } from 'react-native';

import { env } from '../env';
import { capture } from '../monitor';
import { useSession } from '../../store/session';

export interface ImRealtimeHandler {
  /** 只关心这个会话的推送 */
  conversationId: string;
  /** 推送到达时的回调(内部实现应立刻触发增量拉取) */
  onPush: () => void;
}

export type ImRealtimeApi = {
  /** 订阅某会话的实时推送,返回退订函数 */
  subscribe(handler: ImRealtimeHandler): () => void;
};

interface SharedConnection {
  socket: WebSocket | null;
  /** 当前连接使用的 token;token 变化时必须重建 */
  token: string | null;
  handlers: Map<number, ImRealtimeHandler>;
  nextId: number;
  closedIntentionally: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

const shared: SharedConnection = {
  socket: null,
  token: null,
  handlers: new Map(),
  nextId: 1,
  closedIntentionally: false,
  reconnectTimer: null,
};

/** 后台不建立/保留连接,回前台由订阅者或本模块重建。 */
let appActive = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

function wsBaseUrl(): string | null {
  return env.WS_BASE_URL ?? null;
}

function clearReconnect(): void {
  if (shared.reconnectTimer) {
    clearTimeout(shared.reconnectTimer);
    shared.reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  clearReconnect();
  shared.reconnectTimer = setTimeout(() => {
    shared.reconnectTimer = null;
    connect();
  }, 5000);
}

/** 主动丢弃当前 socket,不触发重连(它的 onclose 会因为引用不一致被忽略)。 */
function dropSocket(): void {
  const socket = shared.socket;
  shared.socket = null;
  shared.token = null;
  if (socket) {
    try { socket.close(); } catch { /* ignored */ }
  }
}

function dispatch(frame: { action?: string; conversationId?: string | number }): void {
  if (frame.action === 'admin_message') {
    // 客服回复(无会话概念):通知客服聊天页与会话列表(通配订阅)
    for (const handler of shared.handlers.values()) {
      if (handler.conversationId === 'support' || handler.conversationId === '*') {
        try { handler.onPush(); } catch { /* 单个订阅者异常不影响其他 */ }
      }
    }
    return;
  }
  if (frame.action !== 'new_message' || frame.conversationId == null) return;
  const pushedConvId = String(frame.conversationId);
  for (const handler of shared.handlers.values()) {
    if (handler.conversationId === pushedConvId || handler.conversationId === '*') {
      try { handler.onPush(); } catch { /* 单个订阅者异常不影响其他 */ }
    }
  }
}

function connect(): void {
  const base = wsBaseUrl();
  const token = useSession.getState().token;
  if (!appActive || !base || !token || shared.handlers.size === 0) return;
  if (shared.socket) {
    if (shared.token === token) return;
    // 账号已切换:旧连接立即作废,不能继续收上一个账号的推送。
    dropSocket();
  }
  clearReconnect();
  shared.closedIntentionally = false;
  const url = `${base.replace(/\/$/, '')}/ws/im?token=${encodeURIComponent(token)}`;
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch (cause) {
    capture('WARN', `im-ws-connect:${cause instanceof Error ? cause.message : String(cause)}`);
    return;
  }
  shared.socket = socket;
  shared.token = token;
  socket.onmessage = (event) => {
    if (shared.socket !== socket) return;
    let frame: { action?: string; conversationId?: string | number };
    try {
      frame = JSON.parse(String(event.data));
    } catch {
      return;
    }
    dispatch(frame);
  };
  socket.onerror = () => {
    // 一次失败即关闭,聊天页轮询兜底
    if (shared.socket === socket) {
      try { socket.close(); } catch { /* ignored */ }
    }
  };
  socket.onclose = () => {
    if (shared.socket !== socket) return;
    shared.socket = null;
    shared.token = null;
    if (!shared.closedIntentionally && shared.handlers.size > 0 && useSession.getState().token) {
      // 异常断开且仍有订阅者:延后重建一次
      scheduleReconnect();
    }
  };
}

function disconnect(): void {
  shared.closedIntentionally = true;
  clearReconnect();
  dropSocket();
}

// 身份切换/退出登录时立刻收口连接,不等待页面退订。
useSession.subscribe((state, previous) => {
  if (state.token === previous.token) return;
  if (!state.token) {
    disconnect();
    return;
  }
  if (shared.handlers.size > 0) {
    dropSocket();
    connect();
  }
});

// 进后台停连,回前台重建;订阅关系保留,页面无需感知。
AppState.addEventListener('change', (next) => {
  const wasActive = appActive;
  appActive = next === 'active';
  if (!appActive) {
    disconnect();
    return;
  }
  if (!wasActive && shared.handlers.size > 0) connect();
});

export const imRealtime: ImRealtimeApi = {
  subscribe(handler: ImRealtimeHandler): () => void {
    const id = shared.nextId++;
    shared.handlers.set(id, handler);
    connect();
    return () => {
      shared.handlers.delete(id);
      if (shared.handlers.size === 0) disconnect();
    };
  },
};
