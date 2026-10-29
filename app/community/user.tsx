/**
 * 用户主页(掘金式):头像昵称 + 关注/粉丝/动态计数 + 关注按钮 + TA 的动态列表。
 * 关注/取关幂等;自己看自己显示"我的主页"隐藏关注按钮。
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RemoteImage } from '@/components/business/RemoteImage';
import { EmptyState, ErrorState, ListFooter, RefreshingControl } from '@/components/business/feedback';
import { SkeletonList } from '@/components/ui/skeleton';
import { fetchUserPosts, type CommunityPost } from '@/lib/api/endpoints/post';
import { fetchSocialCounts, followUser, unfollowUser } from '@/lib/api/endpoints/social';
import { relativeTime } from '@/app/(tabs)/community';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const PAGE_SIZE = 10;

export default function SocialUserScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const targetUserId = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const myUserId = useSession((state) => state.user?.id ?? null);

  const countsQuery = useRequest(() => fetchSocialCounts(targetUserId), [targetUserId, signedIn]);
  const counts = countsQuery.data;

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const load = useCallback(
    async (targetPage: number, mode: 'initial' | 'more') => {
      const resp = await fetchUserPosts(targetUserId, targetPage, PAGE_SIZE);
      setItems((prev) => (mode === 'more' ? [...prev, ...resp.records] : resp.records));
      setTotal(resp.total);
      setPage(targetPage);
    },
    [targetUserId],
  );
  const postsQuery = useRequest(() => load(1, 'initial'), [targetUserId, signedIn]);

  const isMe = myUserId === targetUserId;

  const toggleFollow = useCallback(async () => {
    if (!counts) return;
    if (!signedIn) {
      router.push(loginHref({ href: `/community/user?id=${targetUserId}`, from: 'social' }));
      return;
    }
    try {
      if (counts.followedByMe) {
        await unfollowUser(targetUserId);
        toast('已取消关注', 'info');
      } else {
        const newly = await followUser(targetUserId);
        toast(newly ? '已关注' : '你已关注过 TA', newly ? 'success' : 'info');
      }
      await countsQuery.reload();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '操作失败,请稍后再试', 'error');
    }
  }, [counts, countsQuery, router, signedIn, targetUserId, toast]);

  const loadMore = useCallback(async () => {
    if (items.length >= total) return;
    try {
      await load(page + 1, 'more');
    } catch {
      // 翻页失败静默
    }
  }, [items.length, total, page, load]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(postsQuery.status === 'loading', () => void postsQuery.reload())}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.2}
        ListHeaderComponent={
          <View className="mb-3 mt-2">
            <Card className="p-4">
              <View className="flex-row items-center">
                <Avatar alt="头像" className="size-16">
                  {items[0]?.avatar ? <AvatarImage source={{ uri: items[0].avatar }} /> : null}
                  <AvatarFallback>
                    <Text>{(items[0]?.nickname ?? '用').slice(0, 1)}</Text>
                  </AvatarFallback>
                </Avatar>
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-bold" numberOfLines={1}>
                    {items[0]?.nickname ?? '用户'}
                  </Text>
                  {counts ? (
                    <Text className="text-muted-foreground mt-1 text-xs">
                      关注 {counts.followingCount} · 粉丝 {counts.followerCount} · 动态 {counts.postCount}
                    </Text>
                  ) : null}
                </View>
                {!isMe ? (
                  <Button
                    size="sm"
                    variant={counts?.followedByMe ? 'outline' : 'default'}
                    onPress={() => void toggleFollow()}
                  >
                    <Text>{counts?.followedByMe ? '已关注' : '+ 关注'}</Text>
                  </Button>
                ) : (
                  <Text className="text-muted-foreground text-xs">我的主页</Text>
                )}
              </View>
            </Card>
            <Text className="text-muted-foreground mb-2 mt-2 text-xs font-semibold">TA 的动态({total})</Text>
          </View>
        }
        ListEmptyComponent={
          postsQuery.isInitialLoading ? (
            <SkeletonList rows={3} />
          ) : postsQuery.error ? (
            <ErrorState error={postsQuery.error} onRetry={() => void postsQuery.reload()} />
          ) : (
            <EmptyState title="还没有发布过动态" />
          )
        }
        ListFooterComponent={
          <ListFooter loading={false} hasMore={items.length < total} error={null} empty={items.length === 0} />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`动态:${item.content.slice(0, 16)}`}
            onPress={() => router.push(`/community/detail?id=${item.id}`)}
            className="mb-2"
          >
            <Card className="p-3">
              <Text className="text-muted-foreground text-xs">{relativeTime(item.createTime)}</Text>
              <Text className="text-foreground mt-1 text-sm leading-5">{item.content}</Text>
              {item.images.length > 0 ? (
                <View className="mt-2 flex-row" style={{ gap: 4 }}>
                  {item.images.slice(0, 3).map((uri) => (
                    <RemoteImage key={uri} uri={uri} style={{ width: 88, height: 88, borderRadius: 8 }} />
                  ))}
                </View>
              ) : null}
              <View className="mt-2 flex-row" style={{ gap: 16 }}>
                <Text className="text-muted-foreground text-xs">赞 {item.likeCount}</Text>
                <Text className="text-muted-foreground text-xs">评论 {item.commentCount}</Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
