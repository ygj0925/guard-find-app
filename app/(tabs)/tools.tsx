/**
 * 工具箱:大众工具型 App 的功能入口(转型规划 doc/大众工具箱App产品规划.md 3.2 节)。
 * 已上线工具走路由,规划中的置灰 + Toast;记账概要卡取月度汇总。
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  Flame,
  ListTodo,
  MessagesSquare,
  Ruler,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { SectionCard, EmptyState, ErrorState } from '@/components/business/feedback';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
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
  { key: 'todo', title: '待办清单', description: '每日计划 · 截止提醒', icon: ListTodo, href: '/tools/todo' },
  { key: 'split', title: 'AA 分账', description: '聚餐分账 · 一键记入账本', icon: Users, href: '/tools/split' },
  { key: 'unit', title: '单位换算', description: '长度 · 重量 · 温度 · 离线可用', icon: Ruler, href: '/tools/unit-convert' },
  { key: 'forum', title: '圈子论坛', description: '发帖 · 交流 · 互助', icon: MessagesSquare },
];

export default function ToolsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const summary = useRequest<LedgerSummary>(() => fetchLedgerSummary({ period: 'month' }), [
    signedIn,
  ]);

  const openTool = (tool: ToolEntry) => {
    if (!tool.href) {
      toast(`${tool.title}即将上线,敬请期待`);
      return;
    }
    router.push(tool.href);
  };

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

        <View className="flex-row flex-wrap justify-between">
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.key}
              accessibilityRole="button"
              accessibilityLabel={tool.title}
              onPress={() => openTool(tool)}
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
          更多工具持续上线 · 有想法欢迎反馈
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
