/**
 * 记账 · 报表:周报/月报/年报 + 分类占比条 + 趋势条形图。
 * 图表用纯 RN View 宽度百分比实现,不引图表库(鸿蒙侧原生依赖需走
 * expo-harmony-cli 审批,一期不值得);汇总与趋势由服务端 /app/ledger/summary 出。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SectionCard } from '@/components/business/feedback';
import {
  fetchLedgerSummary,
  type LedgerPeriod,
  type LedgerSummary,
} from '@/lib/api/endpoints/ledger';
import { fetchAiLedgerInsight, type AiTextResp } from '@/lib/api/endpoints/ai';
import { categoryLabel } from '@/lib/ledger/categories';
import { formatAmount, toDayKey } from '@/lib/ledger/stats';
import { useRequest } from '@/hooks/useRequest';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLedgerScope } from '@/store/ledger-scope';
import { token } from '@/constants/Colors';

const PERIODS: { key: LedgerPeriod; label: string }[] = [
  { key: 'week', label: '周报' },
  { key: 'month', label: '月报' },
  { key: 'year', label: '年报' },
];

export default function LedgerReportScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [period, setPeriod] = useState<LedgerPeriod>('month');
  const anchor = useMemo(() => toDayKey(new Date()), []);
  const scopeGroupId = useLedgerScope((state) => state.groupId);
  const scopeName = useLedgerScope((state) => state.scopeName);
  const loadScope = useLedgerScope((state) => state.load);
  React.useEffect(() => {
    void loadScope();
  }, [loadScope]);
  const [insight, setInsight] = useState<AiTextResp | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const summary = useRequest<LedgerSummary>(() => fetchLedgerSummary({ period, date: anchor, groupId: scopeGroupId ?? undefined }), [
    period,
    anchor,
  ]);

  // 年报没有对应服务端口径,点评只对周/月开放
  const loadInsight = useCallback(async () => {
    if (insightLoading || period === 'year') return;
    setInsightLoading(true);
    try {
      setInsight(await fetchAiLedgerInsight(period, anchor));
    } catch {
      setInsight(null);
    } finally {
      setInsightLoading(false);
    }
  }, [anchor, insightLoading, period]);

  const maxTrend = useCallback((data: LedgerSummary) => {
    return Math.max(1, ...data.trend.map((point) => Math.max(point.expense, point.income)));
  }, []);

  const reload = useCallback(async () => {
    await summary.reload();
  }, [summary]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-xl font-bold">收支报表</Text>
          <Text className="text-muted-foreground mt-1 text-sm">当前账本:{scopeName ?? '个人账本'}</Text>
        </View>

        <View className="mb-3 flex-row rounded-full bg-muted p-1">
          {PERIODS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={period === item.key ? { selected: true } : {}}
              onPress={() => {
                setPeriod(item.key);
                setInsight(null);
              }}
              className={`flex-1 items-center rounded-full py-2 ${period === item.key ? 'bg-primary' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${period === item.key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {summary.data ? (
          <>
            <Card className="mb-3 p-4">
              <Text className="text-muted-foreground text-xs">
                {summary.data.startDate} ~ {summary.data.endDate} · {summary.data.recordCount} 笔
              </Text>
              <View className="mt-3 flex-row">
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">支出</Text>
                  <Text className="text-urgent mt-1 text-xl font-bold">
                    {formatAmount(summary.data.totalExpense)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">收入</Text>
                  <Text className="text-found mt-1 text-xl font-bold">
                    {formatAmount(summary.data.totalIncome)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">结余</Text>
                  <Text className="mt-1 text-xl font-bold">{formatAmount(summary.data.balance)}</Text>
                </View>
              </View>
            </Card>

            <SectionCard title="分类占比" description="按支出金额排序">
              {summary.data.byCategory.length === 0 ? (
                <Text className="text-muted-foreground text-sm">区间内没有支出记录</Text>
              ) : (
                summary.data.byCategory.map((stat) => (
                  <View key={stat.category} className="mb-3">
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="text-sm">
                        {categoryLabel(1, stat.category)}
                        {stat.income > 0 ? ` · 收 ${formatAmount(stat.income)}` : ''}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {formatAmount(stat.expense)} 元 · {Math.round(stat.ratio * 100)}%
                      </Text>
                    </View>
                    <View
                      className="h-2 w-full overflow-hidden rounded-full"
                      style={{ backgroundColor: token('muted', scheme) }}
                    >
                      <View
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(2, Math.round(stat.ratio * 100))}%`,
                          backgroundColor: token('primary', scheme),
                        }}
                      />
                    </View>
                  </View>
                ))
              )}
            </SectionCard>

            <SectionCard
              title="消费趋势"
              description={period === 'year' ? '按月汇总' : '按日汇总'}
            >
              <TrendBars data={summary.data} max={maxTrend(summary.data)} scheme={scheme} />
            </SectionCard>

            {period !== 'year' ? (
              <SectionCard
                title="AI 点评"
                description={insight?.mockMode ? '测试模式 · 服务端未配置 Key' : undefined}
              >
                {insight ? (
                  <Text className="text-foreground text-sm leading-5" selectable>
                    {insight.text}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="生成 AI 点评"
                    onPress={() => void loadInsight()}
                    disabled={insightLoading}
                    className="bg-accent flex-row items-center self-start rounded-full px-4 py-2"
                    style={{ gap: 6 }}
                  >
                    <Icon as={Sparkles} size={14} className="text-accent-foreground" />
                    <Text className="text-accent-foreground text-xs font-semibold">
                      {insightLoading ? '分析中…' : '让 AI 点评这个周期'}
                    </Text>
                  </Pressable>
                )}
              </SectionCard>
            ) : null}
          </>
        ) : summary.isInitialLoading ? (
          <SectionCard title="正在生成报表…">{null}</SectionCard>
        ) : summary.error ? (
          <ErrorState error={summary.error} onRetry={() => void reload()} />
        ) : (
          <EmptyState title="暂无数据" description="先去记一笔,报表立刻就有内容" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 趋势条形图:支出为主条,收入为副条;标签间隔抽稀,窄屏不挤。 */
function TrendBars({
  data,
  max,
  scheme,
}: {
  data: LedgerSummary;
  max: number;
  scheme: 'light' | 'dark';
}) {
  const labelStride = data.trend.length > 16 ? Math.ceil(data.trend.length / 8) : 1;
  return (
    <View className="mt-1 flex-row items-end" style={{ height: 140 }}>
      {data.trend.map((point, index) => {
        const showLabel = index % labelStride === 0;
        return (
          <View key={point.label} className="flex-1 items-center justify-end">
            <View className="h-full w-full flex-row items-end justify-center" style={{ gap: 2 }}>
              <View
                className="w-1.5 rounded-t-sm"
                style={{
                  height: `${Math.max(2, Math.round((point.expense / max) * 100))}%`,
                  backgroundColor: token('primary', scheme),
                }}
              />
              <View
                className="w-1.5 rounded-t-sm"
                style={{
                  height: `${Math.max(2, Math.round((point.income / max) * 100))}%`,
                  backgroundColor: token('found', scheme),
                }}
              />
            </View>
            {showLabel ? (
              <Text className="text-muted-foreground mt-1 text-[8px]">{point.label}</Text>
            ) : (
              <Text className="mt-1 text-[8px]"> </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
