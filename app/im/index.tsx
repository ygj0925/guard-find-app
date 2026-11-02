/**
 * IM 消息列表:所有会话(头像/昵称/最后消息/未读角标),点击进聊天页。
 */
import React, { useCallback } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Headset } from 'lucide-react-native';
import { EmptyState, ErrorState, RefreshingControl, SectionCard } from '@/components/business/feedback';
import {
  deleteImConversation, fetchConversations,
  type ImConversation,
} from '@/lib/api/endpoints/im';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

export default function ImListScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const query = useRequest(() => fetchConversations(), [signedIn]);
  const conversations = query.data ?? [];

  const confirmDelete = useCallback((conv: ImConversation) => {
    Alert.alert('删除这个会话?', '仅自己视角隐藏', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        void (async () => {
          try { await deleteImConversation(conv.id); toast('已删除'); await query.reload(); }
          catch { toast('删除失败,请稍后再试', 'error'); }
        })();
      }},
    ]);
  }, [query, toast]);

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState title="登录后使用私信" description="和关注的人实时聊天"
          actionLabel="去登录" onAction={() => router.push(loginHref({ href: '/im', from: 'im' }))} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
        ListHeaderComponent={
          <View className="mb-3 mt-2">
            <Text className="text-2xl font-bold">消息</Text>
            {/* 官方客服固定入口 */}
            <Pressable accessibilityRole="button" accessibilityLabel="联系官方客服"
              onPress={() => router.push('/im/chat?mode=support&peerName=%E5%AE%98%E6%96%B9%E5%AE%A2%E6%9C%8D' as never)}
              className="mt-3">
              <Card className="flex-row items-center p-3">
                <View className="bg-accent size-12 items-center justify-center rounded-full">
                  <Icon as={Headset} size={20} className="text-accent-foreground" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground text-sm font-semibold">官方客服</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">问题反馈 · 意见建议,工作日 9:00-18:00</Text>
                </View>
              </Card>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : (
            <EmptyState title="还没有会话" description="从社区找人聊天吧" />
          )
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button"
            accessibilityLabel={`会话:${item.peerNickname ?? ''}`}
            onPress={() => router.push(`/im/chat?peerId=${item.peerUserId}&convId=${item.id}` as never)}
            onLongPress={() => confirmDelete(item)}
            className="mb-1">
            <Card className="flex-row items-center p-3">
              <View style={{ position: 'relative' }}>
                <Avatar alt={item.peerNickname ?? '用户'} className="size-12">
                  {item.peerAvatar ? <AvatarImage source={{ uri: item.peerAvatar }} /> : null}
                  <AvatarFallback>
                    <Text>{(item.peerNickname ?? '用').slice(0, 1)}</Text>
                  </AvatarFallback>
                </Avatar>
                {item.unreadCount > 0 ? (
                  <View className="bg-urgent absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full px-1">
                    <Text className="text-primary-foreground text-[10px] font-bold">
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                  {item.peerNickname ?? '用户'}
                </Text>
                <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
                  {item.lastMessage ?? '开始对话…'}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
