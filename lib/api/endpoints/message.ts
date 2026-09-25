/**
 * 5. 消息与偏好(`/app/message`、`/app/notification`)—— 对齐契约 5 节。
 * WebSocket 帧结构也在这里声明,供 lib/realtime.ts 复用。
 */
import { api } from '../client';
import type { PageQuery, PageResp } from './common';

export type MessageType =
  | 'CASE_APPROVED'
  | 'CASE_REJECTED'
  | 'CASE_LEAD'
  | 'LEAD_REPLIED'
  | 'CASE_FOUND'
  | 'CASE_EXPIRING'
  | 'REPORT_RESULT'
  | 'CASE_PUBLISHED'
  | 'SYSTEM';

/** 列表分组口径:`category` 是查询参数,`type` 是消息自身类型。 */
export type MessageCategory = 'AUDIT' | 'LEAD' | 'RESULT' | 'SYSTEM';

export interface Message {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  bizType: string | null;
  bizId: string | null;
  /** 服务端下发的应用内路径,点击消息按它跳转。 */
  path: string | null;
  readStatus: boolean;
  createTime: string;
}

export interface UnreadResp {
  unreadCount: number;
}

export interface MarkAllReadResp {
  markedCount: number;
}

export interface MessageQuery extends PageQuery {
  onlyUnread?: boolean;
  category?: MessageCategory;
}

export interface Preference {
  type: MessageType;
  label: string;
  inboxEnabled: boolean;
  /** 审核结果类为 true:App 侧开关禁用,不发关闭请求。 */
  inboxForced: boolean;
  smsEnabled: boolean;
  smsNote: string | null;
}

export interface PreferenceResp {
  items: Preference[];
}

export interface PreferenceItemReq {
  type: MessageType;
  inboxEnabled: boolean;
  smsEnabled: boolean;
}

/** 契约 5 节 WebSocket 帧。 */
export type RealtimeFrame =
  | { type: 'message'; data: Message }
  | { type: 'ping' }
  | { type: 'pong' };

export const messageApi = {
  unread: () => api.get<UnreadResp>('/app/message/unread'),
  list: (query: MessageQuery) => api.get<PageResp<Message>>('/app/message', { ...query }),
  markRead: (id: string) =>
    api.patch<null>(`/app/message/${encodeURIComponent(id)}/read`),
  markAllRead: () => api.patch<MarkAllReadResp>('/app/message/read'),
  preferences: () => api.get<PreferenceResp>('/app/notification/preference'),
  savePreferences: (items: PreferenceItemReq[]) =>
    api.put<null>('/app/notification/preference', { items }),
};
