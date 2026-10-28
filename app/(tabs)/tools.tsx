/**
 * 工具箱:大众工具型 App 的功能入口(转型规划 doc/大众工具箱App产品规划.md 3.2 节)。
 * 已上线工具走路由,规划中的置灰 + Toast;记账概要卡取月度汇总;
 * 长按工具可置顶(排序持久化在 store/tools-order.ts);顶部 AI 周报横幅。
 */
import React, { useCallback } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { SectionCard, EmptyState, ErrorState } from '@/components/business/feedback';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToolsOrder, pinTools } from '@/store/tools-order';
import { fetchLedgerSummary, type LedgerSummary } from '@/lib/api/endpoints/ledger';
import { formatAmount } from '@/lib/ledger/stats';
import { useToast } from '@/providers/ToastProvider';
import { token } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Newspaper } from 'lucide-react-native';
import { useCircularReveal } from '@/components/ui/circular-reveal';
import { TOOL_REGISTRY as TOOLS, type ToolEntry } from '@/lib/tools/registry';




export default function ToolsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const pinnedKeys = useToolsOrder((state) => state.pinned);
  const loadOrder = useToolsOrder((state) => state.load);
  const summary = useRequest<LedgerSummary>(() => fetchLedgerSummary({ period: 'month' }), [
    signedIn,
  ]);

  React.useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  // 置顶的工具排前面,其余保持默认序
  const ordered = React.useMemo(() => {
    const pinned = TOOLS.filter((tool) => pinnedKeys.includes(tool.key));
    const rest = TOOLS.filter((tool) => !pinnedKeys.includes(tool.key));
    return [...pinned, ...rest];
  }, [pinnedKeys]);

  const { revealPush, overlay } = useCircularReveal(router);
  const scheme = useColorScheme() ?? 'light';
  const openTool = (tool: ToolEntry, eventPageX = 200, eventPageY = 400) => {
    if (!tool.href) {
      toast(`${tool.title}即将上线,敬请期待`);
      return;
    }
    revealPush(tool.href, eventPageX, eventPageY, token('primary', scheme));
  };

  const longPressTool = useCallback(
    (tool: ToolEntry) => {
      const isPinned = pinnedKeys.includes(tool.key);
      Alert.alert(tool.title, undefined, [
        {
          text: isPinned ? '取消置顶' : '置顶',
          onPress: () => {
            void pinTools(isPinned ? pinnedKeys.filter((key) => key !== tool.key) : [tool.key, ...pinnedKeys]);
          },
        },
        { text: '取消', style: 'cancel' },
      ]);
    },
    [pinnedKeys],
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-2xl font-bold">工具箱</Text>
          <Text className="text-muted-foreground mt-1 text-sm">高频小工具,一个就够</Text>
        </View>

        {signedIn ? (
          summary.data ? (
            <SectionCard title="本月概要" description={summary.data.recordCount + ' 笔记录'}>
              <View className="flex-row">
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">支出</Text>
                  <Text className="mt-1 text-xl font-bold">{formatAmount(summary.data.totalExpense)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">收入</Text>
                  <Text className="text-found mt-1 text-xl font-bold">{formatAmount(summary.data.totalIncome)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">结余</Text>
                  <Text className="mt-1 text-xl font-bold">{formatAmount(summary.data.balance)}</Text>
                </View>
              </View>
            </SectionCard>
          ) : summary.isInitialLoading ? (
            <Card className="mb-3 p-4">
              <Text className="text-muted-foreground text-sm">正在加载本月概要…</Text>
            </Card>
          ) : summary.error ? (
            <ErrorState error={summary.error} onRetry={() => void summary.reload()} />
          ) : null
        ) : (
          <EmptyState
            title="登录后同步你的数据"
            description="记账、AI 对话等工具的数据会跟随账号云端同步"
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="AI 周报"
          onPress={() => (signedIn ? router.push('/tools/weekly-report') : toast('登录后生成周报', 'warn'))}
          className="mb-3"
        >
          <Card className="flex-row items-center p-4">
            <View className="bg-accent h-10 w-10 items-center justify-center rounded-xl">
              <Icon as={Newspaper} size={20} className="text-primary" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold">AI 周报</Text>
              <Text className="text-muted-foreground mt-0.5 text-xs">
                本周记账 · 待办 · 打卡,一键生成专属总结
              </Text>
            </View>
          </Card>
        </Pressable>

        <View className="flex-row flex-wrap justify-between">
          {ordered.map((tool) => (
            <Pressable
              key={tool.key}
              accessibilityRole="button"
              accessibilityLabel={tool.title}
              onPress={(event) => openTool(tool, event.nativeEvent.pageX, event.nativeEvent.pageY)}
              onLongPress={() => longPressTool(tool)}
              className="mb-3 w-[48%]"
            >
              <Card className={`p-4 ${tool.href ? '' : 'opacity-60'}`}>
                <View className="bg-accent mb-2 h-10 w-10 items-center justify-center rounded-xl">
                  <Icon
                    as={tool.icon}
                    size={20}
                    className={tool.href ? 'text-primary' : 'text-muted-foreground'}
                  />
                </View>
                <Text className="text-base font-semibold">{tool.title}</Text>
                <Text className="text-muted-foreground mt-0.5 text-xs">{tool.description}</Text>
                {tool.href ? null : (
                  <Text className="text-pending mt-1 text-[10px] font-medium">即将上线</Text>
                )}
              </Card>
            </Pressable>
          ))}
        </View>

        {overlay}
        <Text className="text-muted-foreground mt-2 text-center text-xs">
          长按工具可置顶 · 更多工具持续上线
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
