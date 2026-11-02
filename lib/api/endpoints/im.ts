/**
 * IM 私信(`/app/im`)。轮询方案:聊天页 3 秒拉一次新消息,会话列表 10 秒。
 */
import { api } from '../client';

export interface ImConversation {
  id: string;
  peerUserId: string;
  peerNickname: string | null;
  peerAvatar: string | null;
  lastMessage: string | null;
  lastTime: string | null;
  unreadCount: number;
}

export interface ImMessage {
  id: string;
  senderId: string;
  content: string;
  createTime?: string;
}

export function getOrCreateConversation(targetUserId: string): Promise<ImConversation> {
  return api.post<ImConversation>(`/app/im/conversation/${targetUserId}`);
}

export function fetchConversations(): Promise<ImConversation[]> {
  return api.get<ImConversation[]>('/app/im/conversations');
}

export function fetchImMessages(conversationId: string, afterId?: string): Promise<ImMessage[]> {
  return api.get<ImMessage[]>(`/app/im/conversation/${conversationId}/messages`,
    afterId ? { afterId } : undefined);
}

export function sendImMessage(conversationId: string, content: string): Promise<ImMessage> {
  return api.post<ImMessage>(`/app/im/conversation/${conversationId}/message`, { content });
}

export function markImRead(conversationId: string): Promise<void> {
  return api.post<void>(`/app/im/conversation/${conversationId}/read`);
}

export function deleteImConversation(conversationId: string): Promise<void> {
  return api.delete<void>(`/app/im/conversation/${conversationId}`);
}
