/**
 * 看房预约:两个视角切换。
 * 我预约的(guest):状态跟踪 + 取消;我收到的(owner):确认/拒绝。
 */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RemoteImage } from '@/components/business/RemoteImage';
import { EmptyState, ErrorState, RefreshingControl, SectionCard } from '@/components/business/feedback';
import { updateBookingStatus, fetchBookings, type PropertyBooking, type BookingStatus } from '@/lib/api/endpoints/property';
import { useRequest } from '@/hooks/useRequest';
import { useToast } from '@/providers/ToastProvider';

const PAGE_SIZE = 10;
const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  1: { label: '待确认', cls: 'text-foreground bg-muted' },
  2: { label: '已确认', cls: 'text-primary bg-accent' },
  3: { label: '已拒绝', cls: 'text-urgent bg-accent' },
  4: { label: '已取消', cls: 'text-muted-foreground bg-muted' },
};

function formatTime(value: string): string {
  return (value ?? '').replace('T', ' ').slice(0, 16);
}

export default function PropertyBookingsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [role, setRole] = useState<'guest' | 'owner'>('guest');
  const [items, setItems] = useState<PropertyBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = useCallback(async (targetPage: number, mode: 'initial' | 'more') => {
    const resp = await fetchBookings(role, targetPage, PAGE_SIZE);
    setItems((prev) => (mode === 'more' ? [...prev, ...resp.records] : resp.records));
    setTotal(resp.total);
    setPage(targetPage);
  }, [role]);

  const query = useRequest(() => load(1, 'initial'), [role]);

  const applyStatus = useCallback(async (booking: PropertyBooking, status: BookingStatus) => {
    try {
      await updateBookingStatus(booking.id, status);
      toast(status === 2 ? '已确认' : status === 3 ? '已拒绝' : '已取消', 'success');
      await load(1, 'initial');
    } catch {
      toast('操作失败,请稍后再试', 'error');
    }
  }, [load, toast]);

  const confirmAction = useCallback((booking: PropertyBooking, status: BookingStatus) => {
    const text = status === 2 ? '确认这个预约?' : status === 3 ? '拒绝这个预约?' : '取消这个预约?';
    Alert.alert(text, formatTime(booking.bookingTime), [
      { text: '取消操作', style: 'cancel' },
      { text: '确定', style: status === 3 ? 'destructive' : 'default', onPress: () => void applyStatus(booking, status) },
    ]);
  }, [applyStatus]);

  const loadMore = useCallback(async () => {
    if (items.length >= total) return;
    try { await load(page + 1, 'more'); } catch { /* silent */ }
  }, [items.length, total, page, load]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="px-4 pb-2 pt-2">
        <Text className="text-2xl font-bold">看房预约</Text>
        <View className="mt-3 flex-row rounded-full bg-muted p-1">
          {(['guest', 'owner'] as const).map((key) => (
            <Pressable key={key} accessibilityRole="button"
              accessibilityLabel={key === 'guest' ? '我预约的' : '我收到的'}
              onPress={() => setRole(key)}
              className={`flex-1 items-center rounded-full py-2 ${role === key ? 'bg-primary' : ''}`}>
              <Text className={`text-sm font-semibold ${role === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {key === 'guest' ? '我预约的' : '我收到的'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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
            <EmptyState
              title={role === 'guest' ? '还没有预约' : '还没有收到的预约'}
              description={role === 'guest' ? '在房源详情页点「预约看房」即可预约' : '有人预约你的房源时会出现在这里'}
            />
          )
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] ?? STATUS_META[1];
          const isGuest = role === 'guest';
          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`预约:${item.propertyTitle ?? ''}`}
              onPress={() => router.push(`/tools/property-detail?id=${item.propertyId}` as never)}
              className="mb-2"
            >
              <Card className="p-3">
                <View className="flex-row">
                  {item.propertyImage ? (
                    <RemoteImage uri={item.propertyImage} style={{ width: 84, height: 64, borderRadius: 8 }} />
                  ) : (
                    <View className="bg-muted h-16 w-[84px] items-center justify-center rounded-lg">
                      <Icon as={Building2} size={20} className="text-muted-foreground/50" />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-foreground shrink grow text-sm font-semibold" numberOfLines={1}>
                        {item.propertyTitle ?? '房源已删除'}
                      </Text>
                      <View className={`rounded-full px-2 py-0.5 ${meta.cls}`}>
                        <Text className={`text-[10px] font-bold ${meta.cls}`}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text className="text-muted-foreground mt-1 text-xs">
                      看房时间 {formatTime(item.bookingTime)}
                    </Text>
                    {isGuest ? null : (
                      <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
                        预约人 {item.userNickname ?? '用户'} · {item.contactName ?? ''} {item.contactPhone ?? ''}
                      </Text>
                    )}
                    {item.remark ? (
                      <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>备注:{item.remark}</Text>
                    ) : null}
                  </View>
                </View>

                {/* 操作:房东(待确认)确认/拒绝;预约人(待确认/已确认)取消 */}
                {item.status === 1 && !isGuest ? (
                  <View className="mt-3 flex-row justify-end" style={{ gap: 8 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel="拒绝预约"
                      onPress={() => confirmAction(item, 3)}
                      className="rounded-full border border-border px-4 py-1.5">
                      <Text className="text-muted-foreground text-xs font-semibold">拒绝</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="确认预约"
                      onPress={() => confirmAction(item, 2)}
                      className="bg-accent rounded-full px-4 py-1.5">
                      <Text className="text-accent-foreground text-xs font-semibold">确认</Text>
                    </Pressable>
                  </View>
                ) : null}
                {item.status === 1 && isGuest ? (
                  <View className="mt-3 flex-row justify-end">
                    <Pressable accessibilityRole="button" accessibilityLabel="取消预约"
                      onPress={() => confirmAction(item, 4)}
                      className="rounded-full border border-border px-4 py-1.5">
                      <Text className="text-muted-foreground text-xs font-semibold">取消预约</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            </PressableScale>
          );
        }}
      />
    </SafeAreaView>
  );
}
