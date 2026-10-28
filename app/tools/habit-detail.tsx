/**
 * 习惯详情 · 打卡月历:月份切换 + 7 列网格(周一开头),打卡日高亮。
 * 数据来自 /app/tool/habit/{id}/log?month=。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { ErrorState, SectionCard } from '@/components/business/feedback';
import { fetchHabitMonthLog } from '@/lib/api/endpoints/habit';
import { adjacentMonth, buildMonthGrid } from '@/lib/habits/calendar';
import { monthLabel, toDayKey } from '@/lib/ledger/stats';
import { useRequest } from '@/hooks/useRequest';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];

export default function HabitDetailScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const habitId = params.id ?? '';
  const scheme = useColorScheme() ?? 'light';

  const [month, setMonth] = useState(() => toDayKey(new Date()).slice(0, 7));

  const query = useRequest(() => fetchHabitMonthLog(habitId, month), [habitId, month]);
  const checked = useMemo(() => new Set(query.data ?? []), [query.data]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const today = toDayKey(new Date());

  const navMonth = useCallback((delta: number) => {
    setMonth((prev) => adjacentMonth(prev, delta));
  }, []);

  if (!habitId) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ErrorState error={{ message: '缺少习惯 ID' } as never} onRetry={() => undefined} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-xl font-bold">{params.title ?? '打卡日历'}</Text>
        </View>

        <Card className="mb-3 p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="上一月"
              onPress={() => navMonth(-1)}
              className="p-2"
            >
              <Icon as={ChevronLeft} size={18} className="text-muted-foreground" />
            </Pressable>
            <Text className="text-base font-semibold">{monthLabel(month)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="下一月"
              onPress={() => navMonth(1)}
              className="p-2"
            >
              <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
            </Pressable>
          </View>

          <View className="flex-row">
            {WEEKDAY_HEADERS.map((label) => (
              <View key={label} className="flex-1 items-center">
                <Text className="text-muted-foreground text-xs">{label}</Text>
              </View>
            ))}
          </View>

          <View className="mt-2 flex-row flex-wrap">
            {cells.map((cell, index) => {
              if (cell.key === null || cell.day === null) {
                return <View key={`pad:${index}`} className="items-center py-1" style={{ width: '14.28%' }} />;
              }
              const isChecked = checked.has(cell.key);
              const isToday = cell.key === today;
              const isFuture = cell.key > today;
              return (
                <View key={cell.key} className="items-center py-1" style={{ width: '14.28%' }}>
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isChecked
                        ? token('primary', scheme)
                        : isFuture
                          ? 'transparent'
                          : token('muted', scheme),
                      borderWidth: isToday && !isChecked ? 1.5 : 0,
                      borderColor: token('primary', scheme),
                    }}
                  >
                    <Text
                      className={`text-xs ${isChecked ? 'text-primary-foreground font-bold' : isFuture ? 'text-muted-foreground/50' : 'text-foreground'}`}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {query.isInitialLoading ? (
          <SectionCard title="加载打卡记录…">{null}</SectionCard>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : (
          <Text className="text-muted-foreground text-center text-xs">
            本月打卡 {checked.size} 天
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
