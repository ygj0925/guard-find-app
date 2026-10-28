/**
 * 日期计算器:两日期间隔(含周末数)/ N 天后是哪天 / 当年进度,纯本地。
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { SectionCard } from '@/components/business/feedback';
import { dateAfterDays, daysBetween, weekendDaysBetween, yearProgress } from '@/lib/calc/dates';
import { toDayKey } from '@/lib/ledger/stats';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function DateCalcScreen() {
  const scheme = useColorScheme() ?? 'light';
  const today = useMemo(() => toDayKey(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [base, setBase] = useState(today);
  const [days, setDays] = useState('100');

  const interval = useMemo(
    () => (DAY_RE.test(from) && DAY_RE.test(to) ? daysBetween(from, to) : null),
    [from, to],
  );
  const weekends = useMemo(
    () => (DAY_RE.test(from) && DAY_RE.test(to) ? weekendDaysBetween(from, to) : null),
    [from, to],
  );
  const after = useMemo(
    () => (DAY_RE.test(base) && /^\d+$/.test(days.trim()) ? dateAfterDays(base, Number(days)) : null),
    [base, days],
  );
  const progress = useMemo(() => yearProgress(new Date()), []);

  const inputStyle = { color: token('foreground', scheme), borderColor: token('border', scheme) } as const;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">日期计算器</Text>
          <Text className="text-muted-foreground mt-1 text-sm">间隔天数 · N 天后 · 当年进度 · 离线可用</Text>
        </View>

        <SectionCard title="两日期间隔" description="格式 yyyy-MM-dd">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
              value={from}
              onChangeText={setFrom}
              accessibilityLabel="开始日期"
            />
            <Text className="text-muted-foreground">→</Text>
            <TextInput
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
              value={to}
              onChangeText={setTo}
              accessibilityLabel="结束日期"
            />
          </View>
          {interval !== null ? (
            <View className="mt-3 flex-row">
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">间隔天数</Text>
                <Text className="text-foreground mt-1 text-2xl font-bold">{interval} 天</Text>
              </View>
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">其中周末</Text>
                <Text className="text-primary mt-1 text-2xl font-bold">{weekends} 天</Text>
              </View>
            </View>
          ) : (
            <Text className="text-urgent mt-2 text-xs">请输入有效的 yyyy-MM-dd 日期</Text>
          )}
        </SectionCard>

        <SectionCard title="N 天后是哪天">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
              value={base}
              onChangeText={setBase}
              accessibilityLabel="基准日期"
            />
            <TextInput
              className="w-20 rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
              accessibilityLabel="天数"
            />
          </View>
          {after ? (
            <Text className="text-foreground mt-3 text-lg font-bold">{after}</Text>
          ) : (
            <Text className="text-urgent mt-2 text-xs">请输入有效日期与天数</Text>
          )}
        </SectionCard>

        <SectionCard title={`${progress.dayOfYear === 1 ? '' : ''}当年进度`} description={`${progress.dayOfYear} / ${progress.totalDays} 天`}>
          <View
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: token('muted', scheme) }}
          >
            <View
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(1, Math.round(progress.percent * 100))}%`,
                backgroundColor: token('primary', scheme),
              }}
            />
          </View>
          <Text className="text-muted-foreground mt-2 text-xs">
            今年已过 {Math.round(progress.percent * 100)}%
          </Text>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
