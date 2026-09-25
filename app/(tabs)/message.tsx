/**
 * 消息中心(spec: 消息中心与未读角标 / 实时到达与降级轮询)。
 *
 * 四条约束:
 *   1. 分组按 `type` 客户端归组(契约的 `category` 只是查询参数,消息体上没有分类字段),
 *      服务端新增未知 `type` 时兜底进"系统公告",不把消息丢掉;
 *   2. 点击消息按服务端下发的 `path` 跳转,前端不猜路由;
 *   3. 已读只改本条状态并把角标即时减 1,不整页刷新;"全部已读"同样保留分类与滚动位置;
 *   4. `/app/message` 是 `PageResp` 分页,这里用 `useFeed` 把页码当游标承载,
 *      从而复用"骨架屏 / 空 / 失败可重试 / 无更多"四态与竞态丢弃。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCheck } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, ListFooter, NoticeBar } from '@/components/business/feedback';
import { PUSH_LIMIT_NOTE } from '@/components/business/compliance';
import { useFeed } from '@/hooks/useFeed';
import {
  messageApi,
  type Message,
  type MessageCategory,
  type MessageType,
} from '@/lib/api/endpoints/message';
import type { FeedResp } from '@/lib/api/endpoints/common';
import { MESSAGE_CATEGORY_LABEL, MESSAGE_TYPE_LABEL, formatRelative } from '@/lib/format';
import { toUserMessage } from '@/lib/api/error';
import { onRealtimeMessage, onRealtimeStatus, type RealtimeStatus } from '@/lib/realtime';
import { syncUnreadCount, useSession } from '@/store/session';
import { useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';

const PAGE_SIZE = 20;

const CATEGORY_ORDER: MessageCategory[] = ['AUDIT', 'LEAD', 'RESULT', 'SYSTEM'];

/** 契约 5 节:`category` 四值与 `type` 九值的对应关系,只用于展示分组。 */
const CATEGORY_OF_TYPE: Record<MessageType, MessageCategory> = {
  CASE_APPROVED: 'AUDIT',
  CASE_REJECTED: 'AUDIT',
  REPORT_RESULT: 'AUDIT',
  CASE_LEAD: 'LEAD',
  LEAD_REPLIED: 'LEAD',
  CASE_FOUND: 'RESULT',
  CASE_EXPIRING: 'RESULT',
  CASE_PUBLISHED: 'SYSTEM',
  SYSTEM: 'SYSTEM',
};

function categoryOfType(type: MessageType): MessageCategory {
  return CATEGORY_OF_TYPE[type] ?? 'SYSTEM';
}

interface Section {
  key: MessageCategory;
  title: string;
  data: Message[];
}

export default function MessageTabScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { guard, signedIn } = useSessionGuard();

  const unread = useSession((state) => state.unreadCount);
  const setUnreadCount = useSession((state) => state.setUnreadCount);
  const bumpUnread = useSession((state) => state.bumpUnread);

  const [category, setCategory] = useState<MessageCategory | ''>('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [marking, setMarking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<RealtimeStatus>('idle');

  const slotKey = `message|${category || 'all'}|${onlyUnread ? 'unread' : 'all-read-state'}`;

  // 页码当游标用:`cursor` 是"下一页要取的页号",首屏为 null。
  const fetchPage = useCallback(
    async (cursor: string | null): Promise<FeedResp<Message>> => {
      if (!signedIn) return { records: [], nextCursor: null, hasMore: false };
      const page = cursor ? Number(cursor) : 1;
      const resp = await messageApi.list({
        page,
        size: PAGE_SIZE,
        onlyUnread,
        category: category || undefined,
      });
      const records = resp?.records ?? [];
      const loaded = page * PAGE_SIZE;
      const hasMore = loaded < (resp?.total ?? 0) && records.length > 0;
      return {
        records,
        nextCursor: hasMore ? String(page + 1) : null,
        hasMore,
      };
    },
    [category, onlyUnread, signedIn],
  );

  const feed = useFeed<Message>(slotKey, fetchPage, [slotKey, signedIn]);
  const items = feed.items;
  const { refresh } = feed;
  const skipFirstFocus = useRef(true);

  // 实时帧到达:未读数按服务端校准,列表拉回第一页(分类与滚动位置都还在)。
  useEffect(() => {
    const offStatus = onRealtimeStatus(setRealtime);
    const offMessage = onRealtimeMessage(() => {
      if (!signedIn) return;
      void syncUnreadCount();
      void refresh();
    });
    return () => {
      offStatus();
      offMessage();
    };
  }, [refresh, signedIn]);

  // 回到本页只做一次校准:在别的页面读过消息后角标不能继续挂着。
  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocus.current) {
        skipFirstFocus.current = false;
        return;
      }
      if (!signedIn) return;
      void refresh();
      void syncUnreadCount();
    }, [refresh, signedIn]),
  );

  const sections = useMemo<Section[]>(() => {
    const grouped = new Map<MessageCategory, Message[]>();
    for (const item of items) {
      const key = categoryOfType(item.type);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(item);
      else grouped.set(key, [item]);
    }
    return CATEGORY_ORDER.filter((key) => (grouped.get(key) ?? []).length).map((key) => ({
      key,
      title: MESSAGE_CATEGORY_LABEL[key],
      data: grouped.get(key) ?? [],
    }));
  }, [items]);

  const openMessage = useCallback(
    async (message: Message) => {
      setActionError(null);
      if (!message.readStatus) {
        try {
          await messageApi.markRead(message.id);
          // 只改这一条:spec 要求"打开详情即标记已读且角标同步",但不允许整页刷新。
          feed.patchItem(message.id, { readStatus: true });
          bumpUnread(-1);
        } catch (error) {
          setActionError(toUserMessage(error));
        }
      }
      const target =
        message.path ??
        (message.bizType === 'FIND_CASE' && message.bizId ? `/case/${message.bizId}` : null);
      if (!target) {
        toast('这条消息没有可跳转的内容,请按正文说明操作');
        return;
      }
      router.push(target);
    },
    [bumpUnread, feed, router, toast],
  );

  const markAllRead = useCallback(async () => {
    setActionError(null);
    setMarking(true);
    try {
      await messageApi.markAllRead();
      for (const message of items) {
        if (!message.readStatus) feed.patchItem(message.id, { readStatus: true });
      }
      setUnreadCount(0);
      void syncUnreadCount();
    } catch (error) {
      setActionError(toUserMessage(error));
    } finally {
      setMarking(false);
    }
  }, [feed, items, setUnreadCount]);

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="px-4 pt-2">
          <Text className="text-xl font-bold">消息中心</Text>
        </View>
        <View className="px-4 pt-4">
          <NoticeBar
            tone="info"
            title="登录后查看站内消息"
            lines={['审核结果、新线索与找回喜报都会以站内信发给你。', PUSH_LIMIT_NOTE]}
          />
          <Button
            testID="message-login"
            onPress={() => guard({ href: '/(tabs)/message', label: 'message' })}
          >
            <Text>去登录</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-xl font-bold">消息</Text>
          <Badge variant={unread > 0 ? 'destructive' : 'secondary'} className="bg-urgent">
            <Text>未读 {unread}</Text>
          </Badge>
        </View>
        <Button
          testID="message-mark-all"
          variant="outline"
          size="sm"
          disabled={marking || unread === 0}
          onPress={() => void markAllRead()}
        >
          <Icon as={CheckCheck} size={14} />
          <Text>{marking ? '处理中' : '全部已读'}</Text>
        </Button>
      </View>

      <View className="flex-row flex-wrap gap-2 px-4 pb-2">
        <FilterChip label="全部" active={category === ''} onPress={() => setCategory('')} />
        {CATEGORY_ORDER.map((key) => (
          <FilterChip
            key={key}
            label={MESSAGE_CATEGORY_LABEL[key]}
            active={category === key}
            onPress={() => setCategory(category === key ? '' : key)}
          />
        ))}
        <FilterChip
          label="只看未读"
          active={onlyUnread}
          testID="message-unread-filter"
          onPress={() => setOnlyUnread((current) => !current)}
        />
      </View>

      {actionError ? (
        <View className="px-4 pb-2">
          <Text accessibilityRole="alert" className="text-urgent text-sm">
            {actionError}
          </Text>
        </View>
      ) : null}

      <View className="px-4">
        <NoticeBar tone="info" title="一期没有系统推送" lines={[PUSH_LIMIT_NOTE]} />
        {realtime === 'polling' ? (
          <NoticeBar
            tone="warn"
            title="实时通道不可用,已改为定时轮询"
            lines={['未读数按固定间隔拉取,消息到达可能滞后。']}
          />
        ) : null}
        {realtime === 'closed' ? (
          <NoticeBar
            tone="warn"
            title="实时连接已断开"
            lines={['连接会自动重试;也可下拉刷新立刻取回最新消息。']}
          />
        ) : null}
      </View>

      <SectionList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderItem={({ item }) => (
          <MessageRow message={item} onPress={() => void openMessage(item)} />
        )}
        renderSectionHeader={({ section }) => (
          <Text className="text-muted-foreground pb-1 pt-3 text-xs font-semibold">
            {section.title}
          </Text>
        )}
        ListHeaderComponent={
          feed.showSkeleton ? (
            <View>
              <Skeleton className="mb-3 h-24 rounded-xl" />
              <Skeleton className="mb-3 h-24 rounded-xl" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          feed.showSkeleton || feed.error ? null : (
            <EmptyState
              title={onlyUnread ? '没有未读消息' : '还没有收到消息'}
              description={
                onlyUnread
                  ? '取消「只看未读」可以看到历史消息。'
                  : '审核结果、新线索与找回喜报都会出现在这里。'
              }
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={feed.phase === 'loadingMore'}
            hasMore={feed.hasMore}
            error={items.length ? feed.error : null}
            onRetry={() => void feed.loadMore()}
            empty={items.length === 0}
          />
        }
        onEndReached={() => {
          if (feed.hasMore && feed.phase === 'idle') void feed.loadMore();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={feed.phase === 'refreshing'}
            onRefresh={() => {
              void feed.refresh();
              void syncUnreadCount();
            }}
          />
        }
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'bg-secondary'}`}
    >
      <Text className={active ? 'text-primary-foreground text-xs' : 'text-xs'}>{label}</Text>
    </Pressable>
  );
}

function MessageRow({ message, onPress }: { message: Message; onPress: () => void }) {
  return (
    <Pressable
      testID={`message-item-${message.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${message.readStatus ? '已读' : '未读'}消息:${message.title}`}
      onPress={onPress}
      className="mb-2"
    >
      <Card className="p-4">
        <CardContent>
          <View className="flex-row items-center gap-2">
            {!message.readStatus ? (
              <Badge variant="destructive" className="bg-urgent">
                <Text>未读</Text>
              </Badge>
            ) : null}
            <Badge variant="outline">
              <Text>{MESSAGE_TYPE_LABEL[message.type] ?? message.type}</Text>
            </Badge>
            <View className="flex-1" />
            <Text className="text-muted-foreground text-xs">{formatRelative(message.createTime)}</Text>
          </View>
          <Text className="mt-1.5 text-sm font-semibold" numberOfLines={2}>
            {message.title}
          </Text>
          <Text className="text-muted-foreground mt-1 text-xs leading-4" numberOfLines={3}>
            {message.content}
          </Text>
          {message.path ? (
            <Text className="text-muted-foreground mt-1.5 text-xs">点按跳转到:{message.path}</Text>
          ) : null}
        </CardContent>
      </Card>
    </Pressable>
  );
}
