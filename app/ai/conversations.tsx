/**
 * AI 对话 · 会话列表:最近会话 + 新建对话入口。
 * 会话数据在服务端(登录即同步);列表分页页码制,下拉刷新。
 */
import React, { useCallback } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  ListFooter,
  RefreshingControl,
  SectionCard,
} from '@/components/business/feedback';import {
  createAiConversation,
  deleteAiConversation,
  fetchAiConversations,
  type AiConversation,
} from '@/lib/api/endpoints/ai';
import { conversationTitle } from '@/lib/ai/helpers';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const PAGE_SIZE = 20;

export default function AiConversationsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<AiConversation[]>([]);
  const [total, setTotal] = React.useState(0);

  const load = useCallback(
    async (targetPage: number, mode: 'initial' | 'more') => {
      const resp = await fetchAiConversations({ page: targetPage, size: PAGE_SIZE });
      setItems((prev) => (mode === 'more' ? [...prev, ...resp.records] : resp.records));
      setTotal(resp.total);
      setPage(targetPage);
    },
    [],
  );

  const query = useRequest(() => load(1, 'initial'), [signedIn]);

  const loadMore = useCallback(async () => {
    if (items.length >= total) return;
    try {
      await load(page + 1, 'more');
    } catch {
      // 翻页失败静默,footer 不展示错误(下拉刷新可重试)
    }
  }, [items.length, total, page, load]);

  const openConversation = useCallback(
    (conversation: AiConversation) => {
      router.push(`/ai/chat?id=${conversation.id}`);
    },
    [router],
  );

  const newConversation = useCallback(async () => {
    try {
      const conversation = await createAiConversation();
      router.push(`/ai/chat?id=${conversation.id}`);
    } catch {
      toast('创建会话失败,请稍后再试', 'error');
    }
  }, [router, toast]);

  const confirmDelete = useCallback(
    (conversation: AiConversation) => {
      Alert.alert('删除这个会话?', '会话内的消息会一起删除', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteAiConversation(conversation.id);
                setItems((prev) => prev.filter((item) => item.id !== conversation.id));
                setTotal((prev) => Math.max(0, prev - 1));
                toast('已删除');
              } catch {
                toast('删除失败,请稍后再试', 'error');
              }
            })();
          },
        },
      ]);
    },
    [toast],
  );

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用 AI 对话"
          description="会话历史跟随账号云端同步"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/ai/conversations', from: 'ai' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
        ListHeaderComponent={
          <View className="mb-4 mt-2 flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold">AI 对话</Text>
              <Text className="text-muted-foreground mt-1 text-sm">翻译 · 写作 · 总结 · 随便聊聊</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="新建对话"
              onPress={() => void newConversation()}
              className="bg-accent h-10 w-10 items-center justify-center rounded-full"
            >
              <Icon as={Plus} size={20} className="text-primary" />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : (
            <EmptyState
              title="还没有会话"
              description="点右上角 + 开始第一段对话"
              actionLabel="新建对话"
              onAction={() => void newConversation()}
            />
          )
        }
        ListFooterComponent={
          <ListFooter loading={false} hasMore={items.length < total} error={null} empty={items.length === 0} />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.2}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={conversationTitle(item.title)}
            onPress={() => openConversation(item)}
            onLongPress={() => confirmDelete(item)}
            className="mb-2"
          >
            <Card className="flex-row items-center p-3">
              <View className="bg-accent h-9 w-9 items-center justify-center rounded-full">
                <Icon as={MessageCircle} size={16} className="text-accent-foreground" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {conversationTitle(item.title)}
                </Text>
                {item.mockMode ? (
                  <Text className="text-pending mt-0.5 text-[10px]">测试模式 · 服务端未配置 Key</Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
