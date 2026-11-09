/**
 * 浏览足迹:最近看过的房源。
 */
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { PropertyMiniList } from '@/components/business/property-mini-list';
import { fetchViewHistory } from '@/lib/api/endpoints/property';

export default function PropertyHistoryScreen() {
  const params = useLocalSearchParams<{ refresh?: string }>();
  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <PropertyMiniList
        fetcher={fetchViewHistory}
        emptyTitle="暂无浏览记录"
        emptyDescription="浏览过的房源会自动出现在这里"
        refreshKey={String(params.refresh ?? '')}
      />
    </SafeAreaView>
  );
}
