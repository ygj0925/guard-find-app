/**
 * 社区:朋友圈形态的动态广场(转型规划 M3)。
 * 单列卡片流:头像/昵称/时间/正文/图片九宫格/位置/点赞评论;
 * 广场与我的动态两个视图;FAB 发布(登录后);未登录可浏览。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, MapPin, MessageCircle, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RemoteImage } from '@/components/business/RemoteImage';
import { EmptyState, ErrorState, ListFooter, RefreshingControl, SectionCard } from '@/components/business/feedback';
import {
  deletePost,
  fetchMyPosts,
  fetchPosts,
  togglePostLike,
  type CommunityPost,
} from '@/lib/api/endpoints/post';
import { useRequest } from '@/hooks/useRequest';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const PAGE_SIZE = 10;

/** 相对时间文案:今天/昨天/N 天前(服务端时间为东八区)。 */
export function relativeTime(createTime: string | null | undefined, now: Date = new Date()): string {
  if (!createTime) return '';
  const date = new Date(createTime.replace(' ', 'T') + '+08:00');
  if (Number.isNaN(date.getTime())) return createTime.slice(0, 10);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays} 天前`;
  return createTime.slice(0, 10);
}

export default function CommunityScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const myUserId = useSession((state) => state.user?.id ?? null);

  const [scope, setScope] = useState<'plaza' | 'mine'>('plaza');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(
    async (targetPage: number, mode: 'initial' | 'more') => {
      const resp =
        scope === 'mine'
          ? await fetchMyPosts(targetPage, PAGE_SIZE)
          : await fetchPosts(targetPage, PAGE_SIZE, sort);
      setItems((prev) => (mode === 'more' ? [...prev, ...resp.records] : resp.records));
      setTotal(resp.total);
      setPage(targetPage);
    },
    [scope, sort],
  );

  // 「我的动态」需登录:未登录不发请求(避免全局 401 处理器清会话回跳),由空态引导登录
  const query = useRequest(() => load(1, 'initial'), [signedIn, scope, sort], {
    enabled: scope === 'plaza' || signedIn,
  });

  const loadMore = useCallback(async () => {
    if (items.length >= total) return;
    try {
      await load(page + 1, 'more');
    } catch {
      // 翻页失败静默,下拉刷新可恢复
    }
  }, [items.length, total, page, load]);

  const flipLike = useCallback(
    async (post: CommunityPost) => {
      // 乐观翻转,失败回滚
      const apply = (delta: number, liked: boolean) =>
        setItems((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? { ...item, likedByMe: liked, likeCount: Math.max(0, item.likeCount + delta) }
              : item,
          ),
        );
      apply(post.likedByMe ? -1 : 1, !post.likedByMe);
      try {
        await togglePostLike(post.id);
      } catch {
        apply(post.likedByMe ? 1 : -1, post.likedByMe);
        toast('操作失败,请稍后再试', 'error');
      }
    },
    [toast],
  );

  const confirmDelete = useCallback(
    (post: CommunityPost) => {
      Alert.alert('删除这条动态?', '删除后不可恢复', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deletePost(post.id);
                toast('已删除');
                await query.reload();
              } catch {
                toast('删除失败,请稍后再试', 'error');
              }
            })();
          },
        },
      ]);
    },
    [query, toast],
  );

  const listData = useMemo(() => items, [items]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.2}
        ListHeaderComponent={
          <View className="mb-3 mt-2">
            <Text className="text-2xl font-bold">社区</Text>
            <Text className="text-muted-foreground mt-1 text-sm">记录生活 · 打卡位置 · 分享此刻</Text>
            <View className="mt-3 flex-row rounded-full bg-muted p-1">
              {(['plaza', 'mine'] as const).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key === 'plaza' ? '动态广场' : '我的动态'}
                  onPress={() => setScope(key)}
                  className={`flex-1 items-center rounded-full py-2 ${scope === key ? 'bg-primary' : ''}`}
                >
                  <Text
                    className={`text-sm font-semibold ${scope === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    {key === 'plaza' ? '动态广场' : '我的动态'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {scope === 'plaza' ? (
              <View className="mt-2 flex-row items-center" style={{ gap: 12 }}>
                {(['latest', 'hot'] as const).map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key === 'latest' ? '最新' : '热门'}
                    onPress={() => setSort(key)}
                    className="flex-row items-center"
                    style={{ gap: 4 }}
                  >
                    <Text
                      className={`text-sm font-semibold ${sort === key ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {key === 'latest' ? '最新' : '热门'}
                    </Text>
                    {sort === key ? (
                      <View className="h-0.5 w-4 rounded-full" style={{ backgroundColor: token('primary', scheme) }} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : scope === 'mine' && !signedIn ? (
            <EmptyState
              title="登录后查看我的动态"
              description="登录后即可管理你发布的所有内容"
              actionLabel="去登录"
              onAction={() => router.push(loginHref({ href: '/community/detail?scope=mine', from: 'community' }))}
            />
          ) : scope === 'mine' ? (
            <EmptyState
              title="你还没有发过动态"
              description="点右下角 + 记录第一刻"
              actionLabel={signedIn ? '发布动态' : '去登录'}
              onAction={() =>
                router.push(signedIn ? '/community/publish' : loginHref({ href: '/community/publish', from: 'community' }))
              }
            />
          ) : (
            <EmptyState title="还没有动态" description="来发第一条,让大家看到你的生活" />
          )
        }
        ListFooterComponent={
          <ListFooter loading={false} hasMore={items.length < total} error={null} empty={items.length === 0} />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`动态:${item.nickname ?? ''} ${item.content.slice(0, 20)}`}
            onPress={() => router.push(`/community/detail?id=${item.id}`)}
            onLongPress={item.userId === myUserId ? () => confirmDelete(item) : undefined}
            className="mb-2"
          >
            <Card className="p-3">
              <View className="flex-row items-center">
                <Avatar alt={item.nickname ?? '用户'} className="size-10">
                  {item.avatar ? <AvatarImage source={{ uri: item.avatar }} /> : null}
                  <AvatarFallback>
                    <Text>{(item.nickname ?? '用').slice(0, 1)}</Text>
                  </AvatarFallback>
                </Avatar>
                <View className="ml-3 flex-1">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`查看 ${item.nickname ?? '用户'} 的主页`}
                    onPress={() => router.push(`/community/user?id=${item.userId}`)}
                  >
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {item.nickname ?? '用户'}
                    </Text>
                  </Pressable>
                  <Text className="text-muted-foreground text-xs">{relativeTime(item.createTime)}</Text>
                </View>
              </View>
              <Text className="text-foreground mt-2 text-sm leading-5">{item.content}</Text>
              {item.images.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap" style={{ gap: 4 }}>
                  {item.images.slice(0, 3).map((uri) => (
                    <RemoteImage key={uri} uri={uri} style={{ width: 104, height: 104, borderRadius: 8 }} />
                  ))}
                  {item.images.length > 3 ? (
                    <View
                      className="items-center justify-center"
                      style={{ width: 104, height: 104, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.06)' }}
                    >
                      <Text className="text-muted-foreground text-lg font-semibold">+{item.images.length - 3}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {item.locationName ? (
                <View className="mt-2 flex-row items-center" style={{ gap: 4 }}>
                  <Icon as={MapPin} size={12} className="text-primary" />
                  <Text className="text-primary text-xs">{item.locationName}</Text>
                </View>
              ) : null}
              <View className="mt-2 flex-row items-center" style={{ gap: 16 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.likedByMe ? '取消点赞' : '点赞'}
                  onPress={() => void flipLike(item)}
                  className="flex-row items-center"
                  style={{ gap: 4 }}
                >
                  <Icon as={Heart} size={16} className={item.likedByMe ? 'text-urgent' : 'text-muted-foreground'} />
                  <Text className={`text-xs ${item.likedByMe ? 'text-urgent' : 'text-muted-foreground'}`}>
                    {item.likeCount}
                  </Text>
                </Pressable>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Icon as={MessageCircle} size={16} className="text-muted-foreground" />
                  <Text className="text-muted-foreground text-xs">{item.commentCount}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="发布动态"
        onPress={() =>
          signedIn
            ? router.push('/community/publish')
            : router.push(loginHref({ href: '/community/publish', from: 'community' }))
        }
        className="absolute bottom-28 right-5 h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: token('primary', scheme),
          shadowColor: token('primary', scheme),
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Icon as={Plus} size={24} className="text-primary-foreground" />
      </Pressable>
    </SafeAreaView>
  );
}
