/**
 * 关键词搜索(spec: 筛选与搜索 / 契约 3 节 `GET /app/search`)。
 *
 * 三条约定:
 *   1. 长度与敏感词校验交给服务端:前端不做 50 字截断,命中规则时把 `msg` 原文显示出来,
 *      字段级原因(`4001` 的 `fieldErrors`)一并列出,不替换成"搜索失败";
 *   2. 历史记录是本机功能(契约只有 `POST /app/search/history/clear`,没有读取端点):
 *      列表存本地 kv,"清空"会同时清本地并在已登录时调用服务端端点;
 *   3. 从广场带过来的筛选条件继续生效(筛选位只在 /app/search 上),页面明示这一点。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Search, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CaseCard } from '@/components/business/case-card';
import { EmptyState, ErrorState, ListFooter, NoticeBar } from '@/components/business/feedback';
import { useFeed } from '@/hooks/useFeed';
import { plazaApi, hasPlazaFilters, fetchSearchPage } from '@/lib/api/endpoints/plaza';
import { ApiError, toUserMessage } from '@/lib/api/error';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';
import { usePlazaView } from '@/store/plaza-view';
import { useFavorites } from '@/store/favorites';
import { favoriteRunId, useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';
import { requireLogin } from '@/lib/nav';
import { trackCaseClick } from '@/lib/track';
import type { CasePublic } from '@/lib/api/endpoints/case';
import type { FeedResp } from '@/lib/api/endpoints/common';

const HISTORY_KEY = 'guardfind.search-history.v1';
const HISTORY_LIMIT = 10;
const PAGE_SIZE = 10;

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ keyword?: string }>();
  const initialKeyword = Array.isArray(params.keyword) ? params.keyword[0] : params.keyword;

  const [text, setText] = useState(initialKeyword ?? '');
  const [active, setActive] = useState(initialKeyword?.trim() ?? '');
  const [history, setHistory] = useState<string[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const filters = usePlazaView((state) => state.filters);
  const filtered = hasPlazaFilters(filters);
  const { guard, signedIn } = useSessionGuard();
  const { toast } = useToast();
  const loadFavorites = useFavorites((state) => state.load);
  const favoriteIds = useFavorites((state) => state.byId);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    void (async () => {
      const stored = await kvGetJson<string[]>(HISTORY_KEY, []);
      setHistory(Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : []);
      setHistoryLoaded(true);
    })();
  }, []);

  const query = useMemo(() => ({ ...filters }), [filters]);

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<FeedResp<CasePublic>> => {
      if (!active) return { records: [], nextCursor: null, hasMore: false };
      // 一律走 `/app/search`:关键词长度与敏感词的服务端校验只有它有,不回落到 feed。
      return fetchSearchPage({
        keyword: active,
        cursor: cursor ?? undefined,
        size: PAGE_SIZE,
        ...query,
      });
    },
    [active, query],
  );

  const slotKey = active ? `search|${active}|${JSON.stringify(query)}` : 'search|idle';
  const feed = useFeed<CasePublic>(slotKey, fetchPage, [slotKey]);

  const rememberKeyword = useCallback(async (keyword: string) => {
    const next = [keyword, ...history.filter((item) => item !== keyword)].slice(0, HISTORY_LIMIT);
    setHistory(next);
    await kvSetJson(HISTORY_KEY, next);
  }, [history]);

  const runSearch = useCallback(
    (raw: string) => {
      const keyword = raw.trim();
      if (!keyword) {
        setActive('');
        return;
      }
      setText(keyword);
      setActive(keyword);
      void rememberKeyword(keyword);
    },
    [rememberKeyword],
  );

  const removeKeyword = useCallback(
    async (keyword: string) => {
      const next = history.filter((item) => item !== keyword);
      setHistory(next);
      await kvSetJson(HISTORY_KEY, next);
    },
    [history],
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await kvSetJson(HISTORY_KEY, []);
    if (!signedIn) return;
    // 服务端历史记录是另一份:清不掉就只说明"本机已清",不谎报成功。
    try {
      await plazaApi.clearSearchHistory();
      toast('本机与服务端搜索记录已清空', 'success');
    } catch (error) {
      toast(`本机记录已清空,服务端未清空:${toUserMessage(error)}`, 'warn');
    }
  }, [signedIn, toast]);

  const toggleFavorite = useCallback(
    (item: CasePublic) => {
      if (!signedIn) {
        void requireLogin({
          href: `/case/${item.id}`,
          run: favoriteRunId(item.id),
          from: 'search-favorite',
        });
        guard({ href: `/case/${item.id}`, run: favoriteRunId(item.id), label: 'favorite' });
        return;
      }
      void useFavorites
        .getState()
        .toggle(item)
        .then((added) => {
          toast(added ? '已加入收藏(仅本机)' : '已取消收藏', 'success');
        });
    },
    [guard, signedIn, toast],
  );

  const serverMessage = feed.error instanceof ApiError ? feed.error.msg?.trim() : '';
  const fieldErrors =
    feed.error instanceof ApiError && feed.error.code === 4001
      ? Object.entries(feed.error.fieldErrors ?? {})
      : [];

  const header = (
    <View>
      {active ? (
        <View className="flex-row items-center gap-2 pb-2">
          <Text className="text-muted-foreground flex-1 text-xs" numberOfLines={1}>
            当前关键词:{active}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setActive('');
              setText('');
            }}
          >
            <Text>清除</Text>
          </Button>
        </View>
      ) : null}

      {serverMessage ? (
        <NoticeBar
          tone="danger"
          title={serverMessage}
          lines={[
            '这是服务端返回的原话,未按通用文案改写。',
            ...fieldErrors.map(([field, reason]) => `${field}:${reason}`),
            ...(feed.items.length ? ['已保留上一次成功加载的结果,可修改关键词后重试。'] : []),
          ]}
        />
      ) : null}

      {!serverMessage && feed.error && feed.items.length === 0 ? (
        <ErrorState error={feed.error} onRetry={() => void feed.refresh()} />
      ) : null}

      {filtered ? (
        <NoticeBar
          tone="info"
          title="已叠加广场的筛选条件"
          lines={[
            '性别、年龄段、情形、血样与年份区间这些筛选位只在 /app/search 上提供,列表结果由服务端排序。',
          ]}
        />
      ) : null}

      {!active && historyLoaded && history.length ? (
        <View className="flex-row items-center justify-between pb-1 pt-2">
          <Text className="text-muted-foreground text-xs">搜索历史</Text>
          <Pressable accessibilityRole="button" onPress={() => void clearHistory()} className="p-1">
            <Text className="text-primary text-xs">清空</Text>
          </Pressable>
        </View>
      ) : null}

      {!active && historyLoaded
        ? history.map((keyword) => (
            <View
              key={keyword}
              className="border-border flex-row items-center gap-2 border-b py-2"
            >
              <Icon as={Clock} size={14} className="text-muted-foreground" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`用历史关键词搜索 ${keyword}`}
                onPress={() => runSearch(keyword)}
                className="flex-1"
              >
                <Text className="text-sm" numberOfLines={1}>
                  {keyword}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`删除历史记录 ${keyword}`}
                onPress={() => void removeKeyword(keyword)}
                className="p-1"
              >
                <Icon as={X} size={14} className="text-muted-foreground" />
              </Pressable>
            </View>
          ))
        : null}

      {feed.showSkeleton && active ? (
        <View className="pt-2">
          <Skeleton className="mb-3 h-28 rounded-xl" />
          <Skeleton className="mb-3 h-28 rounded-xl" />
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
        <Input
          testID="search-input"
          value={text}
          maxLength={60}
          placeholder="姓名 / 地区 / 体貌特征关键词"
          returnKeyType="search"
          className="flex-1"
          accessibilityLabel="搜索关键词"
          onChangeText={setText}
          onSubmitEditing={() => runSearch(text)}
        />
        <Button testID="search-submit" size="sm" onPress={() => runSearch(text)}>
          <Icon as={Search} size={14} className="text-primary-foreground" />
          <Text>搜索</Text>
        </Button>
      </View>
      <View className="px-4 pb-1">
        <Text className="text-muted-foreground text-xs">
          搜索词长度与敏感词由服务端校验(契约上限 50 字);命中规则时这里会显示服务端原话。
        </Text>
      </View>

      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 28 }}
        data={active ? feed.items : []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <CaseCard
            item={item}
            favorited={Boolean(favoriteIds[item.id])}
            onPress={() => {
              trackCaseClick(item.id);
              router.push(`/case/${item.id}`);
            }}
            onLongPress={() => toggleFavorite(item)}
          />
        )}
        ListEmptyComponent={
          active && !feed.showSkeleton && !feed.error ? (
            <EmptyState
              title={`没有匹配「${active}」的档案`}
              description="试试只搜姓氏、地名或某个体貌特征;词越长越难命中。"
            />
          ) : null
        }
        ListFooterComponent={
          active ? (
            <ListFooter
              loading={feed.phase === 'loadingMore'}
              hasMore={feed.hasMore}
              error={feed.items.length ? feed.error : null}
              onRetry={() => void feed.loadMore()}
              empty={feed.items.length === 0}
            />
          ) : null
        }
        onEndReached={() => {
          if (feed.hasMore && feed.phase === 'idle') void feed.loadMore();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={feed.phase === 'refreshing'}
            onRefresh={() => void feed.refresh()}
          />
        }
      />
    </SafeAreaView>
  );
}
