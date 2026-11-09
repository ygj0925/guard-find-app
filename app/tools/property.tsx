import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Building2, MapPin, Plus } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RemoteImage } from '@/components/business/RemoteImage';
import { EmptyState, ErrorState, ListFooter, RefreshingControl, SectionCard } from '@/components/business/feedback';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { loginHref } from '@/lib/nav';
import { deleteProperty, fetchMyProperties, fetchProperties, updatePropertyStatus, type Property } from '@/lib/api/endpoints/property';

const PAGE_SIZE = 10;
const TYPE_LABEL: Record<string, string> = { house: '住宅', apartment: '公寓', villa: '别墅', shop: '商铺' };

export default function PropertyScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const [tab, setTab] = useState<'plaza' | 'mine'>('plaza');
  const [filterType, setFilterType] = useState<'all' | 'house' | 'apartment' | 'villa' | 'shop'>('all');
  const [filterPriceType, setFilterPriceType] = useState<'all' | 'rent' | 'sale'>('all');
  const [filterRentalMode, setFilterRentalMode] = useState<'all' | 'whole' | 'shared'>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (targetPage: number, mode: 'initial' | 'more') => {
    const resp = tab === 'mine'
      ? await fetchMyProperties(targetPage, PAGE_SIZE)
      : await fetchProperties({
          page: targetPage, size: PAGE_SIZE,
          propertyType: filterType !== 'all' ? filterType : undefined,
          priceType: filterPriceType !== 'all' ? filterPriceType : undefined,
          rentalMode: filterRentalMode !== 'all' ? filterRentalMode : undefined,
        });
    setItems((prev) => (mode === 'more' ? [...prev, ...resp.records] : resp.records));
    setTotal(resp.total);
    setPage(targetPage);
  }, [tab, filterType, filterPriceType, filterRentalMode]);

  const query = useRequest(() => load(1, 'initial'), [signedIn, tab, filterType, filterPriceType, filterRentalMode]);

  // 从发布/编辑页返回时自动刷新
  useFocusEffect(
    useCallback(() => {
      if (items.length > 0 || total > 0) void load(1, 'initial');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]),
  );

  const loadMore = useCallback(async () => {
    if (items.length >= total) return;
    try { await load(page + 1, 'more'); } catch { /* silent */ }
  }, [items.length, total, page, load]);

  const toggleStatus = useCallback(async (item: Property) => {
    const next = item.status === 2 ? 3 : 2;
    try {
      await updatePropertyStatus(item.id, next);
      toast(next === 2 ? '已上架' : '已下架', 'success');
      await query.reload();
    } catch { toast('操作失败,请稍后再试', 'error'); }
  }, [query, toast]);

  const confirmDelete = useCallback((item: Property) => {
    Alert.alert('删除这个房源?', item.title, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        void (async () => {
          try { await deleteProperty(item.id); toast('已删除'); await query.reload(); }
          catch { toast('删除失败,请稍后再试', 'error'); }
        })();
      }},
    ]);
  }, [query, toast]);

  if (!signedIn && tab === 'mine') {
    return (
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
        <EmptyState title="登录后管理房源" description="发布房源,管理上架/下架"
          actionLabel="去登录" onAction={() => router.push(loginHref({ href: '/tools/property', from: 'property' }))} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.2}
        ListHeaderComponent={
          <View className="mb-3 mt-2">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-muted-foreground text-sm">找房 · 发房源 · 上架下架</Text>
              </View>
              {signedIn ? (
                <Pressable accessibilityRole="button" accessibilityLabel="发布房源"
                  onPress={() => router.push('/tools/property-publish')}
                  className="bg-accent h-10 w-10 items-center justify-center rounded-full">
                  <Icon as={Plus} size={20} className="text-primary" />
                </Pressable>
              ) : null}
            </View>
            {/* 收藏/足迹/预约 快捷入口 */}
            {signedIn ? (
              <View className="mt-2 flex-row" style={{ gap: 8 }}>
                {([
                  { key: 'favorites', label: '收藏' },
                  { key: 'history', label: '足迹' },
                  { key: 'bookings', label: '预约' },
                ] as const).map((entry) => (
                  <Pressable key={entry.key} accessibilityRole="button" accessibilityLabel={entry.label}
                    onPress={() => router.push(`/tools/property-${entry.key}` as never)}
                    className="border-border flex-1 items-center rounded-xl border py-2">
                    <Text className="text-foreground text-xs font-semibold">{entry.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View className="mt-3 flex-row rounded-full bg-muted p-1">
              {(['plaza', 'mine'] as const).map((key) => (
                <Pressable key={key} accessibilityRole="button"
                  accessibilityLabel={key === 'plaza' ? '房源广场' : '我的房源'}
                  onPress={() => setTab(key)}
                  className={`flex-1 items-center rounded-full py-2 ${tab === key ? 'bg-primary' : ''}`}>
                  <Text className={`text-sm font-semibold ${tab === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                    {key === 'plaza' ? '房源广场' : '我的房源'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {/* 筛选行:类型 + 租售 */}
            {tab === 'plaza' ? (
              <View className="mt-2 flex-row flex-wrap items-center" style={{ gap: 6 }}>
                {(['all', 'house', 'apartment', 'villa', 'shop'] as const).map((t) => (
                  <Pressable key={t} accessibilityRole="button"
                    accessibilityLabel={t === 'all' ? '全部类型' : TYPE_LABEL[t]}
                    onPress={() => setFilterType(t)}
                    className="rounded-full border px-3 py-1"
                    style={{
                      borderColor: filterType === t ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: filterType === t ? token('accent', scheme) : 'transparent',
                    }}>
                    <Text className={`text-xs ${filterType === t ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {t === 'all' ? '全部' : TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                ))}
                {(['all', 'rent', 'sale'] as const).map((t) => (
                  <Pressable key={t} accessibilityRole="button"
                    accessibilityLabel={t === 'all' ? '全部价格' : t === 'rent' ? '租' : '售'}
                    onPress={() => setFilterPriceType(t)}
                    className="rounded-full border px-3 py-1"
                    style={{
                      borderColor: filterPriceType === t ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: filterPriceType === t ? token('accent', scheme) : 'transparent',
                    }}>
                    <Text className={`text-xs ${filterPriceType === t ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {t === 'all' ? '租售' : t === 'rent' ? '租' : '售'}
                    </Text>
                  </Pressable>
                ))}
                {/* 整租/合租(仅出租时) */}
                {filterPriceType === 'rent' ? (['all', 'whole', 'shared'] as const).map((t) => (
                  <Pressable key={t} accessibilityRole="button"
                    accessibilityLabel={t === 'all' ? '全部方式' : t === 'whole' ? '整租' : '合租'}
                    onPress={() => setFilterRentalMode(t)}
                    className="rounded-full border px-3 py-1"
                    style={{
                      borderColor: filterRentalMode === t ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: filterRentalMode === t ? token('accent', scheme) : 'transparent',
                    }}>
                    <Text className={`text-xs ${filterRentalMode === t ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {t === 'all' ? '方式' : t === 'whole' ? '整租' : '合租'}
                    </Text>
                  </Pressable>
                )) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : (
            <EmptyState title={tab === 'mine' ? '还没有发布房源' : '暂无房源'}
              description={tab === 'mine' ? '点右上角 + 发布第一套房源' : '稍后再来看看'} />
          )
        }
        ListFooterComponent={
          <ListFooter loading={false} hasMore={items.length < total} error={null} empty={items.length === 0} />
        }
        renderItem={({ item }) => (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`房源:${item.title}`}
            onPress={() => router.push(`/tools/property-detail?id=${item.id}` as never)}
            onLongPress={item.userId === useSession.getState().user?.id ? () => confirmDelete(item) : undefined}
            className="mb-2"
          >
            <Card className="p-3">
              {item.images.length > 0 ? (
                <RemoteImage uri={item.images[0]} style={{ width: '100%', height: 160, borderRadius: 8 }} />
              ) : (
                <View className="bg-muted h-32 w-full items-center justify-center rounded-lg">
                  <Icon as={Building2} size={32} className="text-muted-foreground/50" />
                </View>
              )}
              <View className="mt-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center" style={{ gap: 6 }}>
                    <Text className="text-foreground shrink text-sm font-semibold" numberOfLines={1}>{item.title}</Text>
                    {item.ownerIsManager ? (
                      <View className="bg-accent rounded-full px-2 py-0.5">
                        <Text className="text-accent-foreground shrink-0 text-[10px] font-bold">认证管家</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-urgent text-base font-bold">
                    ¥{item.price}
                    <Text className="text-muted-foreground text-xs font-normal">
                      {item.priceType === 'rent' ? '/月' : ''}
                    </Text>
                  </Text>
                </View>
                <Text className="text-muted-foreground mt-1 text-xs" numberOfLines={1}>
                  {item.rentalMode === 'whole' ? '整租' : item.rentalMode === 'shared' ? '合租' : ''}
                  {item.layout ?? ''} {item.areaSqm ? `${item.areaSqm}㎡` : ''}
                  {item.orientation ? ` · ${item.orientation}` : ''}
                  {item.floorInfo ? ` · ${item.floorInfo}层` : ''}
                </Text>
                <View className="mt-1 flex-row items-center" style={{ gap: 4 }}>
                  <Icon as={MapPin} size={12} className="text-muted-foreground" />
                  <Text className="text-muted-foreground flex-1 text-xs" numberOfLines={1}>
                    {item.district ?? item.address}
                  </Text>
                  {tab === 'mine' ? (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={item.status === 2 ? '下架' : '上架'}
                      onPress={() => void toggleStatus(item)}
                      className="bg-accent rounded-full px-3 py-1">
                      <Text className="text-accent-foreground text-xs font-semibold">
                        {item.status === 2 ? '下架' : item.status === 3 ? '重新上架' : '发布'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Card>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}

