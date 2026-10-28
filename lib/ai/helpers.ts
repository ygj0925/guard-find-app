/**
 * AI 对话展示层纯函数:气泡行组装、标题/时间文案。
 * 消息数据在服务端,这里只处理渲染前的纯转换,便于 jest 直测。
 */
import type { AiMessage } from '@/lib/api/endpoints/ai';

export interface AiBubbleRow {
  key: string;
  role: AiMessage['role'];
  content: string;
  /** 相邻同角色合并时保留首条时间。 */
  time?: string;
}

/** 消息数组 -> 气泡行(一消息一气泡;预留同角色连续合并的入参位)。 */
export function buildBubbleRows(messages: AiMessage[]): AiBubbleRow[] {
  return messages.map((message) => ({
    key: `m:${message.id}`,
    role: message.role,
    content: message.content,
    time: message.createTime,
  }));
}

/** 发送中的乐观气泡 key(回包后按序替换)。 */
export function pendingBubbleKey(): string {
  return 'pending:outgoing';
}

/** 会话标题展示:超长截断(服务端已截 20 字,这里是防御)。 */
export function conversationTitle(title: string | null | undefined, maxLength = 20): string {
  const text = (title ?? '').trim();
  if (!text) return '新对话';
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

/** 助手预设(一期写死,后续可做成服务端字典)。 */
export const AI_PRESETS: { key: string; label: string; prompt: string }[] = [
  { key: 'translate', label: '帮我翻译', prompt: '请把下面这段话翻译成英文:' },
  { key: 'write', label: '帮我写作', prompt: '请围绕这个主题写一段短文:' },
  { key: 'summary', label: '帮我总结', prompt: '请总结下面这段话的要点:' },
];
