/**
 * 我的收藏:收藏的房源列表。
 */
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { PropertyMiniList } from '@/components/business/property-mini-list';
import { fetchFavorites } from '@/lib/api/endpoints/property';

export default function PropertyFavoritesScreen() {
  const params = useLocalSearchParams<{ refresh?: string }>();
  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <PropertyMiniList
        fetcher={fetchFavorites}
        emptyTitle="还没有收藏"
        emptyDescription="看到心仪的房源点收藏,回头就能找到"
        refreshKey={String(params.refresh ?? '')}
      />
    </SafeAreaView>
  );
}
