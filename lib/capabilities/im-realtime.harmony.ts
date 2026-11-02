/**
 * IM 实时推送能力(鸿蒙实现:RNOH 上 WebSocket 未验证,直接不建立连接)。
 * 聊天页 3 秒轮询即最终兜底,订阅/退订为纯 no-op。
 */
export interface ImRealtimeHandler {
  conversationId: string;
  onPush: () => void;
}

export type ImRealtimeApi = {
  subscribe(handler: ImRealtimeHandler): () => void;
};

export const imRealtime: ImRealtimeApi = {
  subscribe(_handler: ImRealtimeHandler): () => void {
    return () => { /* no-op */ };
  },
};
