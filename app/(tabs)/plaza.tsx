/**
 * 广场:四流切换 + 城市手选 + 筛选 + 首屏信任数据。
 *
 * 四条流各自独立 slot(useFeed 按 slotKey 缓存 items 与游标),切走再切回不重头加载;
 * "就近"用常驻地或城市选择器结果,一期不申请定位权限。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { CaseCard } from '@/components/business/case-card';
import {
  EmptyState,
  ErrorState,
  ListFooter,
  NoticeBar,
  SectionCard,
} from '@/components/business/feedback';
import { RegionPicker } from '@/components/business/pickers';
import { FilterSheet } from '@/components/business/filter-sheet';
import { useFeed } from '@/hooks/useFeed';
import { useRequest } from '@/hooks/useRequest';
import {
  fetchPlazaPage,
  hasPlazaFilters,
  plazaApi,
  type PlazaFilterSelection,
  type PlazaSort,
} from '@/lib/api/endpoints/plaza';
import { buildSlotKey, resolveCity, usePlazaView } from '@/store/plaza-view';
import { useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';
import { useBreakpoint, contentWidthStyle } from '@/hooks/useBreakpoint';
import { useToolsOrder, pinTools } from '@/store/tools-order';
import { DEFAULT_QUICK_KEYS, getTool } from '@/lib/tools/registry';
import { useFilters } from '@/providers/FiltersProvider';
import { favoriteRunId, useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';
import { useCircularReveal } from '@/components/ui/circular-reveal';
import { token } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { requireLogin } from '@/lib/nav';
import { trackCaseClick } from '@/lib/track';
import type { CasePublic } from '@/lib/api/endpoints/case';

const SORTS: { key: PlazaSort; label: string }[] = [
  { key: 'latest', label: '最新' },
  { key: 'urgent', label: '紧急' },
  { key: 'nearby', label: '就近' },
  { key: 'found', label: '喜报' },
];

export default function PlazaScreen() {
  const responsive = useBreakpoint();
  const router = useRouter();
  const sort = usePlazaView((state) => state.sort);
  const setSort = usePlazaView((state) => state.setSort);
  const city = usePlazaView((state) => state.city);
  const setCity = usePlazaView((state) => state.setCity);
  const filters = usePlazaView((state) => state.filters);
  const hydrate = usePlazaView((state) => state.hydrate);
  const user = useSession((state) => state.user);
  const scheme = useColorScheme() ?? 'light';
  const { revealPush, overlay } = useCircularReveal(router);
  const { regionLabel } = useFilters();

  const [cityOpen, setCityOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 手选城市优先,未设置则回落到账号常驻地(一期不申请定位权限)。
  const homeCity = useMemo(() => resolveCity(city, user), [city, user]);
  const activeCity = sort === 'nearby' ? homeCity : city;
  const needsCity = sort === 'nearby' && !activeCity?.cityCode;
  const filtered = hasPlazaFilters(filters);
  const cityLabel = activeCity?.cityCode
    ? regionLabel(activeCity.cityCode) || activeCity.cityLabel || activeCity.cityCode
    : '';

  // slot 身份必须由 useMemo 出:切流/切城市/改筛选各自保留 items 与游标。
  const slotKey = useMemo(
    () => buildSlotKey(sort, sort === 'nearby' ? activeCity?.cityCode : null, filters),
    [sort, activeCity?.cityCode, filters],
  );

  const query = useMemo(
    () => ({
      sort,
      size: 10,
      provinceCode: activeCity?.provinceCode ?? undefined,
      cityCode: activeCity?.cityCode ?? undefined,
      ...filters,
    }),
    [sort, activeCity?.provinceCode, activeCity?.cityCode, filters],
  );

  const fetchPage = useCallback(
    (cursor: string | null) => fetchPlazaPage({ ...query, cursor: cursor ?? undefined }),
    [query],
  );

  const feed = useFeed(slotKey, fetchPage, [slotKey]);

  // 统计失败不影响列表,单独请求并忽略错误(useRequest 会把 error 交给我们自己处理)。
  const statistics = useRequest(() => plazaApi.statistics(), [], { keepDataOnError: true });

  const onEndReached = useCallback(() => {
    if (feed.hasMore && feed.phase === 'idle') void feed.loadMore();
  }, [feed]);

  const { guard, signedIn } = useSessionGuard();
  // 首页快捷入口:与工具箱置顶共用一份偏好;长按可移除/排序
  const pinnedKeys = useToolsOrder((state) => state.pinned);
  const loadOrder = useToolsOrder((state) => state.load);
  React.useEffect(() => {
    void loadOrder();
  }, [loadOrder]);
  const quickTools = useMemo(() => {
    const keys = pinnedKeys.length > 0 ? pinnedKeys.slice(0, 8) : DEFAULT_QUICK_KEYS;
    return keys.map(getTool).filter((tool): tool is NonNullable<typeof tool> => tool !== null && !!tool.href);
  }, [pinnedKeys]);
  const { toast } = useToast();
  const loadFavorites = useFavorites((state) => state.load);
  const favoriteIds = useFavorites((state) => state.byId);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  /**
   * 长按卡片 = 收藏 / 取消收藏。
   * 未登录时记下"这一次收藏",回跳目标是详情页 —— 由详情页登录后自动补做
   * (spec: 未登录收藏被引导)。
   */
  const toggleFavorite = useCallback(
    (item: CasePublic) => {
      if (!signedIn) {
        void requireLogin({
          href: `/case/${item.id}`,
          run: favoriteRunId(item.id),
          from: 'plaza-favorite',
        });
        guard({ href: `/case/${item.id}`, run: favoriteRunId(item.id), label: 'favorite' });
        return;
      }
      void useFavorites
        .getState()
        .toggle(item)
        .then((added) => {
          toast(added ? '已加入收藏(仅本机,跨设备同步待服务端端点)' : '已取消收藏');
        });
    },
    [guard, signedIn, toast],
  );

  const openCase = useCallback(
    (item: CasePublic) => {
      trackCaseClick(item.id);
      router.push(`/case/${item.id}`);
    },
    [router],
  );

  const applyFilters = (next: PlazaFilterSelection) => {
    usePlazaView.getState().setFilters(next);
    setFilterOpen(false);
  };

  const filterCount = Object.values(filters).filter(
    (value) => value !== undefined && value !== null && value !== '',
  ).length;

  const header = (
    <View>
      {statistics.data ? (
        <SectionCard title="平台累计" description="数据来自服务端统计接口">
          <View className="flex-row justify-between">
            <Stat label="在册档案" value={statistics.data.totalCase} />
            <Stat label="已找回" value={statistics.data.foundCase} tone="found" />
            <Stat label="近 7 天新增" value={statistics.data.recentNewCase} />
            <Stat label="今日线索" value={statistics.data.todayLead} />
          </View>
        </SectionCard>
      ) : null}

      {needsCity ? (
        <NoticeBar
          tone="info"
          title="就近流需要先选城市"
          lines={['一期不申请定位权限,请手动选择常驻地或当前关注城市。']}
        />
      ) : null}

      {filtered ? (
        <NoticeBar
          tone="warn"
          title="已按筛选条件搜索"
          lines={['契约中筛选参数只在搜索接口上提供,故本列表改走搜索结果,排序由服务端决定。']}
        />
      ) : null}

      {user && !user.boundPhone ? (
        <NoticeBar
          tone="warn"
          title="未绑定手机号"
          lines={['浏览与收藏不受影响,但提交线索前需要完成手机号验证。']}
        />
      ) : null}

      {feed.showSkeleton ? (
        <View>
          <Skeleton className="mb-3 h-28 rounded-xl" />
          <Skeleton className="mb-3 h-28 rounded-xl" />
          <Skeleton className="mb-3 h-28 rounded-xl" />
        </View>
      ) : null}

      {feed.error && feed.items.length === 0 ? (
        <ErrorState error={feed.error} onRetry={() => void feed.refresh()} />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-1">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}
          className="border-input bg-muted flex-1 flex-row items-center gap-2 rounded-md border px-3 py-2"
        >
          <Icon as={Search} size={15} className="text-muted-foreground" />
          <Text className="text-muted-foreground text-sm">搜索姓名 / 地区 / 特征</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilterOpen(true)}
          className="border-border rounded-md border px-3 py-2"
        >
          <Text className="text-sm">{filterCount ? `筛选 ${filterCount}` : '筛选'}</Text>
        </Pressable>
      </View>

      {/* 我的快捷入口:与工具箱置顶共用偏好;长按可上移/下移/移除 */}
      <View className="pb-1 pt-1">
        <View className="flex-row items-center justify-between px-4 pb-1">
          <Text className="text-muted-foreground text-xs font-semibold">我的快捷入口</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="去工具箱管理"
            onPress={() => router.push('/(tabs)/tools')}
          >
            <Text className="text-primary text-xs">管理</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {quickTools.map((tool) => (
            <Pressable
              key={tool.key}
              accessibilityRole="button"
              accessibilityLabel={`快捷打开${tool.title}`}
              onPress={(event) => {
                const { pageX, pageY } = event.nativeEvent;
                revealPush(tool.href as string, pageX, pageY, token('primary', scheme));
              }}
              onLongPress={() => {
                const list = quickTools.map((item) => item.key);
                const pos = list.indexOf(tool.key);
                Alert.alert(tool.title, undefined, [
                  {
                    text: '上移',
                    onPress: () => {
                      if (pos > 0) {
                        const next = [...list];
                        [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
                        void pinTools(next);
                      }
                    },
                  },
                  {
                    text: '下移',
                    onPress: () => {
                      if (pos < list.length - 1) {
                        const next = [...list];
                        [next[pos + 1], next[pos]] = [next[pos], next[pos + 1]];
                        void pinTools(next);
                      }
                    },
                  },
                  { text: '移除', style: 'destructive', onPress: () => void pinTools(list.filter((key) => key !== tool.key)) },
                  { text: '取消', style: 'cancel' },
                ]);
              }}
              className="mx-1 w-16 items-center rounded-xl py-2 web:cursor-pointer hover:opacity-80"
            >
              <View className="bg-accent h-11 w-11 items-center justify-center rounded-xl">
                <Icon as={tool.icon} size={20} className="text-primary" />
              </View>
              <Text className="text-muted-foreground mt-1 text-xs" numberOfLines={1}>
                {tool.title}
              </Text>
            </Pressable>
          ))}
          {overlay}
        </ScrollView>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="pb-2 pl-4"
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {SORTS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.key === sort }}
            onPress={() => setSort(item.key)}
            className={`mr-2 rounded-full px-4 py-1.5 ${
              item.key === sort ? 'bg-primary' : 'bg-secondary'
            }`}
          >
            <Text className={item.key === sort ? 'text-primary-foreground text-sm' : 'text-sm'}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        {/* 城市对四种流都可叠加(契约 feed 接受 provinceCode/cityCode);就近流必须有一个城市。 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择城市"
          onPress={() => setCityOpen(true)}
          className="border-primary rounded-full border border-dashed px-4 py-1.5"
        >
          <Text className="text-primary text-sm">城市:{cityLabel || '全部'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重置城市选择"
          onPress={() => setCity(null)}
          className="border-border rounded-full border px-4 py-1.5"
        >
          <Text className="text-muted-foreground text-sm">清除城市</Text>
        </Pressable>
      </ScrollView>

      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={[{ paddingBottom: 104 }, contentWidthStyle(responsive)]}
        data={feed.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CaseCard
            item={item}
            favorited={Boolean(favoriteIds[item.id])}
            onPress={() => openCase(item)}
            onLongPress={() => toggleFavorite(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feed.showSkeleton || feed.error ? null : needsCity ? null : (
            <EmptyState
              title="这一流暂时没有内容"
              description="换个筛选条件,或下拉刷新试试。"
              actionLabel="清空筛选"
              onAction={() => usePlazaView.getState().resetFilters()}
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={feed.phase === 'loadingMore'}
            hasMore={feed.hasMore}
            error={feed.items.length ? feed.error : null}
            onRetry={() => void feed.loadMore()}
            empty={feed.items.length === 0}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={feed.phase === 'refreshing'}
            onRefresh={() => void feed.refresh()}
          />
        }
      />

      <RegionPicker
        visible={cityOpen}
        level={2}
        onClose={() => setCityOpen(false)}
        value={
          city
            ? {
                provinceCode: city.provinceCode,
                cityCode: city.cityCode,
                districtCode: null,
                label: city.cityLabel,
              }
            : null
        }
        onChange={(selection) =>
          setCity({
            provinceCode: selection.provinceCode,
            cityCode: selection.cityCode,
            cityLabel: selection.label,
          })
        }
      />
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={applyFilters}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'found' }) {
  return (
    <View className="items-center">
      <Text className={tone === 'found' ? 'text-found text-lg font-bold' : 'text-lg font-bold'}>
        {value ?? 0}
      </Text>
      <Text className="text-muted-foreground text-xs">{label}</Text>
    </View>
  );
}
