/**
 * 记账预算管理:设置月度总预算/分类预算,预算 vs 支出对比,超支预警。
 * 从记账页「预算」按钮进入。
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, SectionCard } from '@/components/business/feedback';
import { SkeletonList } from '@/components/ui/skeleton-loader';
import { fetchBudgetSummary, setBudget } from '@/lib/api/endpoints/budget';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { EXPENSE_CATEGORIES } from '@/lib/ledger/categories';
import { loginHref } from '@/lib/nav';

const ALERT_COLOR: Record<string, string> = { normal: 'text-found', warn: 'text-pending', over: 'text-urgent' };

export default function BudgetScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const { period = '2026-10' } = useLocalSearchParams<{ period?: string }>();

  const summary = useRequest(() => fetchBudgetSummary(period), [signedIn, period]);
  const summaryData = summary.data;

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const saveBudget = useCallback(async (category: string, amount: number) => {
    if (saving || amount <= 0) { toast('请输入有效金额', 'warn'); return; }
    setSaving(true);
    try {
      await setBudget(period, category, amount);
      toast('预算已保存', 'success');
      setEditingCategory(null);
      await summary.reload();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '保存失败', 'error');
    } finally { setSaving(false); }
  }, [period, saving, summary, toast]);

  const categoryLabel = (code: string) => code === 'total' ? '总预算' : EXPENSE_CATEGORIES.find((c) => c.code === code)?.label ?? code;

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState title="登录后设置预算" description="控制每月花销,超支预警"
          actionLabel="去登录" onAction={() => router.push(loginHref({ href: '/tools/budget', from: 'budget' }))} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">预算管理</Text>
          <Text className="text-muted-foreground mt-1 text-sm">{period} · 超 80% 预警 · 超 100% 标超支</Text>
        </View>

        {summary.isInitialLoading ? (
          <SkeletonList rows={4} scheme={scheme} />
        ) : summary.error ? (
          <ErrorState error={summary.error} onRetry={() => void summary.reload()} />
        ) : summaryData ? (
          <>
            {/* 总预算卡 */}
            <Card className="mb-3 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold">总预算</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="编辑总预算"
                  onPress={() => { setEditingCategory('total'); setEditAmount(String(summaryData.totalBudget || '')); }}>
                  <Text className="text-primary text-xs font-semibold">编辑</Text>
                </Pressable>
              </View>
              {editingCategory === 'total' ? (
                <View className="mt-2">
                  <Input value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" aria-label="总预算金额" />
                  <Button size="sm" className="mt-2" onPress={() => void saveBudget('total', Number(editAmount))} disabled={saving}>
                    <Text>保存</Text>
                  </Button>
                </View>
              ) : (
                <View className="mt-2">
                  <View className="flex-row items-baseline" style={{ gap: 4 }}>
                    <Text className="text-foreground text-xl font-bold">{summaryData.totalBudget || 0}</Text>
                    <Text className="text-muted-foreground text-xs">元/月</Text>
                  </View>
                  <View className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: token('muted', scheme) }}>
                    <View className="h-2 rounded-full" style={{
                      width: `${Math.min(100, summaryData.totalBudget > 0 ? Math.round((summaryData.totalSpent / summaryData.totalBudget) * 100) : 0)}%`,
                      backgroundColor: summaryData.totalBudget > 0 && summaryData.totalSpent >= summaryData.totalBudget ? token('urgent', scheme) : token('primary', scheme),
                    }} />
                  </View>
                  <Text className="text-muted-foreground mt-1 text-xs">
                    已花 {summaryData.totalSpent} / 剩 {summaryData.totalRemaining}
                  </Text>
                </View>
              )}
            </Card>

            {/* 分类预算列表 */}
            {summaryData.categories.length > 0 ? (
              <SectionCard title="分类预算">
                {summaryData.categories.map((cat) => (
                  <View key={cat.category} className="mb-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-foreground text-sm font-medium">{categoryLabel(cat.category)}</Text>
                      <Text className={`text-xs font-semibold ${ALERT_COLOR[cat.alertLevel]}`}>
                        {cat.alertLevel === 'over' ? '已超支' : cat.alertLevel === 'warn' ? '接近预算' : `${Math.round(cat.ratio * 100)}%`}
                      </Text>
                    </View>
                    <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: token('muted', scheme) }}>
                      <View className="h-1.5 rounded-full" style={{
                        width: `${Math.min(100, Math.round(cat.ratio * 100))}%`,
                        backgroundColor: cat.alertLevel === 'over' ? token('urgent', scheme) : cat.alertLevel === 'warn' ? token('pending', scheme) : token('primary', scheme),
                      }} />
                    </View>
                    <View className="mt-1 flex-row items-center justify-between">
                      <Text className="text-muted-foreground text-xs">
                        已花 {cat.spent} / 预算 {cat.budgetAmount}
                      </Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`编辑 ${categoryLabel(cat.category)} 预算`}
                        onPress={() => { setEditingCategory(cat.category); setEditAmount(String(cat.budgetAmount || '')); }}>
                        <Text className="text-primary text-xs">编辑</Text>
                      </Pressable>
                    </View>
                    {editingCategory === cat.category ? (
                      <View className="mt-2">
                        <Input value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" aria-label="预算金额" />
                        <Button size="sm" className="mt-2" onPress={() => void saveBudget(cat.category, Number(editAmount))} disabled={saving}>
                          <Text>保存</Text>
                        </Button>
                      </View>
                    ) : null}
                  </View>
                ))}
              </SectionCard>
            ) : (
              <SectionCard title="分类预算" description="还没有设置分类预算">
                <Text className="text-muted-foreground text-xs">在上方编辑总预算后,可以进一步设置各分类的独立预算。</Text>
              </SectionCard>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
