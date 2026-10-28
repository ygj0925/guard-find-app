/**
 * AI 对话(`/app/ai`)—— 服务端 OpenAI 兼容代理,Key 不落端上。
 * 一期非流式:POST 发送即返回完整回复;mockMode=true 表示服务端未配置 Key。
 */
import { api } from '../client';

export type AiRole = 'user' | 'assistant';

export interface AiConversation {
  id: string;
  title: string;
  model: string | null;
  updateTime?: string;
  /** 服务端未配置 LLM Key 时为 true,UI 显示测试模式提示。 */
  mockMode?: boolean;
}

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
  createTime?: string;
}

export interface AiReplyResp {
  conversationId: string;
  title: string;
  reply: AiMessage;
  mockMode: boolean;
}

/** `POST /app/ai/conversation`,返回新会话。 */
export function createAiConversation(title?: string): Promise<AiConversation> {
  return api.post<AiConversation>('/app/ai/conversation', undefined, {
    params: title ? { title } : undefined,
  });
}

/** `GET /app/ai/conversation/page`,按最近活跃倒序。 */
export function fetchAiConversations(params: { page: number; size: number }): Promise<{
  records: AiConversation[];
  total: number;
}> {
  return api.get('/app/ai/conversation/page', params);
}

/** `GET /app/ai/conversation/{id}/message`,按时间升序。 */
export function fetchAiMessages(conversationId: string): Promise<AiMessage[]> {
  return api.get(`/app/ai/conversation/${conversationId}/message`);
}

/** `POST /app/ai/conversation/{id}/message`,返回助手回复。 */
export function sendAiMessage(conversationId: string, content: string): Promise<AiReplyResp> {
  return api.post(`/app/ai/conversation/${conversationId}/message`, { content });
}

/** `DELETE /app/ai/conversation/{id}`。 */
export function deleteAiConversation(conversationId: string): Promise<void> {
  return api.delete(`/app/ai/conversation/${conversationId}`);
}
