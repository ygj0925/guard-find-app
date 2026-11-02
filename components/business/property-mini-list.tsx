/**
 * 房源紧凑列表(收藏/浏览历史共用):封面 + 标题 + 价格 + 位置,点击进详情。
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, MapPin } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { RemoteImage } from '@/components/business/RemoteImage';
import { EmptyState, ErrorState, RefreshingControl, SectionCard } from '@/components/business/feedback';
import type { Property } from '@/lib/api/endpoints/property';
import { useRequest } from '@/hooks/useRequest';

const PAGE_SIZE = 10;

interface PropertyMiniListProps {
  /** 分页拉取函数(page, size) */
  fetcher: (page: number, size: number) => Promise<{ records: Property[]; total: number }>;
  emptyTitle: string;
  emptyDescription: string;
  /** 变化时重新加载的 key */
  refreshKey?: string;
}

export function PropertyMiniList({ fetcher, emptyTitle, emptyDescription, refreshKey }: PropertyMiniListProps) {
  const router = useRouter();
  const [items, setItems] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = useCallback(async (targetPage: number, mode: 'initial' | 'more') => {
    const resp = await fetcher(targetPage, PAGE_SIZE);
    setItems((prev) => (mode === 'more' ? [...prev, ...resp.records] : resp.records));
    setTotal(resp.total);
    setPage(targetPage);
  }, [fetcher]);

  const query = useRequest(() => load(1, 'initial'), [refreshKey, load]);

  const loadMore = useCallback(async () => {
    if (items.length >= total) return;
    try { await load(page + 1, 'more'); } catch { /* silent */ }
  }, [items.length, total, page, load]);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      className="flex-1 px-4"
      contentContainerStyle={{ paddingBottom: 104 }}
      refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.2}
      ListEmptyComponent={
        query.isInitialLoading ? (
          <SectionCard title="加载中…">{null}</SectionCard>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`房源:${item.title}`}
          onPress={() => router.push(`/tools/property-detail?id=${item.id}` as never)}
          className="mb-2"
        >
          <Card className="flex-row p-3">
            {item.images.length > 0 ? (
              <RemoteImage uri={item.images[0]} style={{ width: 96, height: 72, borderRadius: 8 }} />
            ) : (
              <View className="bg-muted h-[72px] w-24 items-center justify-center rounded-lg">
                <Icon as={Building2} size={22} className="text-muted-foreground/50" />
              </View>
            )}
            <View className="ml-3 flex-1 justify-center">
              <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>{item.title}</Text>
              <View className="mt-1 flex-row items-center" style={{ gap: 4 }}>
                <Icon as={MapPin} size={11} className="text-muted-foreground" />
                <Text className="text-muted-foreground shrink text-xs" numberOfLines={1}>
                  {item.district ?? item.city ?? item.address}
                </Text>
              </View>
              <Text className="text-urgent mt-1 text-sm font-bold">
                ¥{item.price}
                <Text className="text-muted-foreground text-[10px] font-normal">{item.priceType === 'rent' ? '/月' : ''}</Text>
              </Text>
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}
