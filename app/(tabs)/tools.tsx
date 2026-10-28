/**
 * 工具箱:大众工具型 App 的功能入口(转型规划 doc/大众工具箱App产品规划.md 3.2 节)。
 * 已上线工具走路由,规划中的置灰 + Toast;记账概要卡取月度汇总;
 * 长按工具可置顶(排序持久化在 store/tools-order.ts);顶部 AI 周报横幅。
 */
import React, { useCallback } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Calculator,
  ClipboardList,
  CalendarClock,
  Flame,
  ListTodo,
  MessagesSquare,
  Newspaper,
  Ruler,
  Sparkles,
  Target,
  SquareDashed,
  Users,
  Wallet,
} from 'lucide-react-native';

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

interface ToolEntry {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>['as'];
  /** 已上线工具的跳转路由;未上线不配置。 */
  href?: string;
}

const TOOLS: ToolEntry[] = [
  { key: 'ledger', title: '记账', description: '记一笔 · 日账单 · 周月年报', icon: Wallet, href: '/tools/ledger' },
  { key: 'ai', title: 'AI 对话', description: '智能助手 · 翻译 · 写作', icon: Sparkles, href: '/ai/conversations' },
  { key: 'habits', title: '习惯打卡', description: '连续天数 · 打卡月历', icon: Flame, href: '/tools/habits' },
  { key: 'countdown', title: '倒数日', description: '考试 · 纪念日 · 还款日', icon: CalendarClock, href: '/tools/countdown' },
  { key: 'todo', title: '待办清单', description: '每日计划 · AI 拆解', icon: ListTodo, href: '/tools/todo' },
  { key: 'split', title: 'AA 分账', description: '聚餐分账 · 一键记入账本', icon: Users, href: '/tools/split' },
  { key: 'mortgage', title: '房贷计算', description: '等额本息 · 等额本金', icon: Calculator, href: '/tools/mortgage' },
  { key: 'text', title: '文本工具', description: '字数 · 时间戳 · 进制 · JSON', icon: SquareDashed, href: '/tools/text-toolkit' },
  { key: 'random', title: '随机决定', description: '转盘 · 骰子 · 硬币', icon: Ruler, href: '/tools/random' },
  { key: 'tasks', title: '任务分派', description: '家人互派 · 状态流转', icon: ClipboardList, href: '/tools/tasks' },
  { key: 'goals', title: '目标 OKR', description: '定目标 · 拆 KR · 量化进度', icon: Target, href: '/tools/goals' },
  { key: 'unit', title: '单位换算', description: '长度 · 重量 · 温度 · 离线可用', icon: Ruler, href: '/tools/unit-convert' },
  { key: 'forum', title: '圈子论坛', description: '发帖 · 交流 · 互助', icon: MessagesSquare },
];

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

  const openTool = (tool: ToolEntry) => {
    if (!tool.href) {
      toast(`${tool.title}即将上线,敬请期待`);
      return;
    }
    router.push(tool.href);
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
              onPress={() => openTool(tool)}
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

        <Text className="text-muted-foreground mt-2 text-center text-xs">
          长按工具可置顶 · 更多工具持续上线
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
