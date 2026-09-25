/**
 * 我的收藏(spec: 收藏与分享 / app-plaza-browsing)。
 *
 * 契约 v1 里没有任何 `/app/favorite*` 端点,收藏只能落在本机(`store/favorites.ts` + 本地存储):
 * 换设备或清除应用数据后会丢。这一点在页面顶部明说,不做"看起来像云端同步"的假象。
 * 服务端补端点后,只需要把 store 里的读写换成接口调用,这一页不用改。
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CaseCard } from '@/components/business/case-card';
import { EmptyState, NoticeBar } from '@/components/business/feedback';
import { useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import type { CasePublic } from '@/lib/api/endpoints/case';

export default function FavoritesScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const loaded = useFavorites((state) => state.loaded);
  const byId = useFavorites((state) => state.byId);
  const load = useFavorites((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  // 排序口径与 store 的 `list()` 一致:按发布时间倒序,最新收藏在最前。
  const items = useMemo<CasePublic[]>(() => {
    return Object.values(byId).sort((a, b) =>
      (b.publishTime ?? '').localeCompare(a.publishTime ?? ''),
    );
  }, [byId]);

  const unfavorite = useCallback(
    async (item: CasePublic) => {
      await useFavorites.getState().remove(item.id);
      toast(`已取消收藏:${item.name}`, 'success');
    },
    [toast],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
        <Text className="text-base font-semibold">我的收藏({items.length})</Text>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.replace('/(tabs)/plaza')}
          accessibilityLabel="去广场"
        >
          <Text>去广场</Text>
        </Button>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <NoticeBar
          tone="warn"
          title="收藏只存在这台设备上"
          lines={[
            '接口契约 v1 没有提供收藏端点,列表与取消都只写本机存储。',
            signedIn ? '换设备或清除应用数据后不会同步回来。' : '登录后收藏仍可用,但同样只在本机。',
          ]}
        />

        {!loaded ? (
          <Text className="text-muted-foreground py-6 text-center text-sm">正在读取本机收藏…</Text>
        ) : !items.length ? (
          <EmptyState
            title="收藏夹是空的"
            description="在广场或档案详情里点收藏,想帮找的档案就会留在这里,方便每天回来看有没有新线索。"
            actionLabel="去广场看看"
            onAction={() => router.replace('/(tabs)/plaza')}
          />
        ) : (
          items.map((item) => (
            <View key={item.id}>
              <CaseCard
                item={item}
                favorited
                onPress={() => router.push(`/case/${item.id}`)}
                onLongPress={() => void unfavorite(item)}
              />
              <Button
                testID={`favorite-remove-${item.id}`}
                variant="outline"
                size="sm"
                className="mb-3 self-end"
                onPress={() => void unfavorite(item)}
              >
                <Text>取消收藏</Text>
              </Button>
            </View>
          ))
        )}

        {items.length ? (
          <Text className="text-muted-foreground pt-2 text-center text-xs">
            长按卡片同样可以取消收藏。
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
