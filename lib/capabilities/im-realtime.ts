/**
 * IM 实时推送能力(默认实现:WebSocket)。
 *
 * 设计取舍(spec:平台能力分派层):
 *   - 服务端在 /ws/im 维护 userId → sessions 推送 `{action:'new_message', ...}`;
 *   - 客户端收到推送后只做一件事:立刻触发一次 REST 增量拉取,
 *     消息追加/去重/标已读仍走聊天页已有的轮询代码路径,WS 仅负责"提速";
 *   - 连接失败/断开不重试到无限:一次失败即放弃,聊天页 3 秒轮询天然兜底;
 *   - 多个聊天页同时在线时共享一条连接(引用计数),会话切换复用连接。
 */
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
  handlers: Map<number, ImRealtimeHandler>;
  nextId: number;
  closedIntentionally: boolean;
}

const shared: SharedConnection = { socket: null, handlers: new Map(), nextId: 1, closedIntentionally: false };

function wsBaseUrl(): string | null {
  return env.WS_BASE_URL ?? null;
}

function connect(): void {
  const base = wsBaseUrl();
  const token = useSession.getState().token;
  if (!base || !token || shared.socket) return;
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
  socket.onmessage = (event) => {
    let frame: { action?: string; conversationId?: number };
    try {
      frame = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (frame.action === 'admin_message') {
      // 客服回复(无会话概念):通知处于客服聊天页的订阅者
      for (const handler of shared.handlers.values()) {
        if (handler.conversationId === 'support') {
          try { handler.onPush(); } catch { /* 单个订阅者异常不影响其他 */ }
        }
      }
      return;
    }
    if (frame.action !== 'new_message' || frame.conversationId == null) return;
    const pushedConvId = String(frame.conversationId);
    for (const handler of shared.handlers.values()) {
      if (handler.conversationId === pushedConvId) {
        try { handler.onPush(); } catch { /* 单个订阅者异常不影响其他 */ }
      }
    }
  };
  socket.onerror = () => {
    // 一次失败即关闭,聊天页轮询兜底
    try { socket.close(); } catch { /* ignored */ }
  };
  socket.onclose = () => {
    shared.socket = null;
    if (!shared.closedIntentionally && shared.handlers.size > 0) {
      // 异常断开且仍有订阅者:延后重建一次
      setTimeout(() => { if (shared.handlers.size > 0) connect(); }, 5000);
    }
  };
}

function disconnect(): void {
  shared.closedIntentionally = true;
  const socket = shared.socket;
  shared.socket = null;
  if (socket) {
    try { socket.close(); } catch { /* ignored */ }
  }
}

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
