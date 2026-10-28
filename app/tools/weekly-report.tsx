/**
 * AI 周报:把本周记账/待办/打卡的真实数据喂给服务端 AI,生成一段周报。
 * 入口在工具箱页顶部横幅;未配置 Key 时服务端返回测试模式底稿。
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Newspaper } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, SectionCard } from '@/components/business/feedback';
import { fetchAiWeeklyReport, type AiTextResp } from '@/lib/api/endpoints/ai';
import { toDayKey } from '@/lib/ledger/stats';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

export default function WeeklyReportScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const [report, setReport] = useState<AiTextResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchAiWeeklyReport(toDayKey(new Date())));
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      toast('生成失败,请稍后再试', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, toast]);

  const regenerateAndClose = useCallback(() => {
    setReport(null);
  }, []);

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后生成 AI 周报"
          description="周报会汇总你本周的记账、待办与打卡数据"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/weekly-report', from: 'report' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-2xl font-bold">AI 周报</Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            汇总本周记账 · 待办 · 打卡,只读事实不编造
          </Text>
        </View>

        {error ? (
          <ErrorState error={error as never} onRetry={() => void generate()} />
        ) : report ? (
          <>
            <Card className="mb-3 p-4">
              <View className="mb-2 flex-row items-center" style={{ gap: 6 }}>
                <Icon as={Newspaper} size={16} className="text-primary" />
                <Text className="text-sm font-semibold">本周周报</Text>
                {report.mockMode ? <Text className="text-pending text-xs">· 测试模式</Text> : null}
              </View>
              <Text className="text-foreground text-sm leading-5" selectable>
                {report.text}
              </Text>
            </Card>
            <Button variant="outline" onPress={() => void generate()}>
              <Text>{loading ? '生成中…' : '重新生成'}</Text>
            </Button>
          </>
        ) : (
          <SectionCard title={loading ? '正在汇总本周数据…' : '还没有生成周报'} description="点击下方按钮,基于本周真实数据生成">
            <Button onPress={() => void generate()} disabled={loading}>
              <Text>{loading ? '生成中…' : '生成本周周报'}</Text>
            </Button>
          </SectionCard>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel="清空周报" onPress={regenerateAndClose} className="mt-4 self-center">
          <Text className="text-muted-foreground text-xs">清空当前周报</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
