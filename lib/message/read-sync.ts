/**
 * 消息已读与 Tab 角标同步(spec: 消息中心与未读角标)。
 *
 * 角标只在服务端确认已读后才变:请求失败时列表与角标都保持原样,避免两者对不上。
 */
import { messageApi, type Message } from '@/lib/api/endpoints/message';
import { syncUnreadCount, useSession } from '@/store/session';

type PatchItem = (id: string, patch: Partial<Message>) => void;

export async function markMessageRead(message: Message, patchItem: PatchItem): Promise<void> {
  if (message.readStatus) return;
  await messageApi.markRead(message.id);
  patchItem(message.id, { readStatus: true });
  useSession.getState().bumpUnread(-1);
}

export async function markAllMessagesRead(items: Message[], patchItem: PatchItem): Promise<void> {
  await messageApi.markAllRead();
  for (const message of items) {
    if (!message.readStatus) patchItem(message.id, { readStatus: true });
  }
  useSession.getState().setUnreadCount(0);
  void syncUnreadCount();
}

/** 跳转目标只认服务端下发的 `path`;老消息没有 path 时按档案业务键兜底,其余不猜路由。 */
export function messageTarget(message: Message): string | null {
  if (message.path) return message.path;
  if (message.bizType === 'FIND_CASE' && message.bizId) return `/case/${message.bizId}`;
  return null;
}
