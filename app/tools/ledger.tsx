/**
 * 记账 · 日账单:月度合计 + 按天分组流水 + "记一笔"悬浮按钮 + 报表入口。
 * 分页/分组逻辑在 hooks/useLedgerFeed,本页只管渲染与交互。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  ListFooter,
  RefreshingControl,
  SectionCard,
} from '@/components/business/feedback';
import { deleteLedgerRecord, type LedgerRecord } from '@/lib/api/endpoints/ledger';
import {
  adjacentMonths,
  currentMonth,
  formatAmount,
  monthLabel,
} from '@/lib/ledger/stats';
import { categoryIcon, categoryLabel } from '@/lib/ledger/categories';
import { useLedgerFeed } from '@/hooks/useLedgerFeed';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

type Row =
  | { kind: 'header'; key: string; label: string; expense: number; income: number }
  | { kind: 'record'; key: string; record: LedgerRecord };

export default function LedgerScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const [month, setMonth] = useState(() => currentMonth());
  const feed = useLedgerFeed(month, signedIn);

  // 从"记一笔/编辑"返回时自动刷新:首次挂载交给 hook 的初始加载,避免双请求。
  const { loadedMonth, refresh } = feed;
  useFocusEffect(
    useCallback(() => {
      if (loadedMonth === month) void refresh();
    }, [loadedMonth, month, refresh]),
  );

  const rows = useMemo<Row[]>(
    () =>
      feed.groups.flatMap((group): Row[] => [
        {
          kind: 'header',
          key: `h:${group.key}`,
          label: group.label,
          expense: group.expense,
          income: group.income,
        },
        ...group.records.map((record): Row => ({ kind: 'record', key: `r:${record.id}`, record })),
      ]),
    [feed.groups],
  );

  const openAdd = useCallback(() => {
    if (!signedIn) {
      router.push(loginHref({ href: '/tools/ledger/add', from: 'ledger-fab' }));
      return;
    }
    router.push('/tools/ledger/add');
  }, [signedIn, router]);

  const confirmDelete = useCallback(
    (record: LedgerRecord) => {
      Alert.alert(
        '删除这笔记录?',
        `${categoryLabel(record.type, record.category)} · ${formatAmount(record.amount)} 元`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await deleteLedgerRecord(record.id);
                  toast('已删除');
                  await feed.reload();
                } catch {
                  toast('删除失败,请稍后再试', 'error');
                }
              })();
            },
          },
        ],
      );
    },
    [feed, toast],
  );

  const openEdit = useCallback(
    (record: LedgerRecord) => {
      router.push({
        pathname: '/tools/ledger/add',
        params: { record: JSON.stringify(record) },
      });
    },
    [router],
  );

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后开始记账"
          description="账单跟随账号云端同步,换设备不丢数据"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/ledger', from: 'ledger' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(feed.phase === 'loading', () => void feed.refresh())}
        ListHeaderComponent={
          <Card className="mb-3 mt-2 p-4">
            <View className="flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="上一月"
                onPress={() => setMonth(adjacentMonths(month).prev)}
                className="p-2"
              >
                <Icon as={ChevronLeft} size={18} className="text-muted-foreground" />
              </Pressable>
              <Text className="text-base font-semibold">{monthLabel(month)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="下一月"
                onPress={() => {
                  const next = adjacentMonths(month).next;
                  if (next <= currentMonth()) setMonth(next);
                }}
                className="p-2"
              >
                <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
              </Pressable>
            </View>
            <View className="mt-3 flex-row">
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">支出</Text>
                <Text className="text-urgent mt-1 text-lg font-bold">
                  {formatAmount(feed.monthExpense)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">收入</Text>
                <Text className="text-found mt-1 text-lg font-bold">
                  {formatAmount(feed.monthIncome)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">结余</Text>
                <Text className="mt-1 text-lg font-bold">
                  {formatAmount(feed.monthIncome - feed.monthExpense)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="查看报表"
                onPress={() => router.push('/tools/ledger/report')}
                className="justify-center pl-3"
              >
                <Text className="text-primary text-sm font-semibold">报表</Text>
              </Pressable>
            </View>
          </Card>
        }
        ListEmptyComponent={
          feed.phase === 'loading' ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : feed.phase === 'error' && feed.error ? (
            <ErrorState error={feed.error} onRetry={() => void feed.reload()} />
          ) : (
            <EmptyState
              title="这个月还没有记录"
              description="点击右下角「记一笔」,3 秒完成记账"
              actionLabel="记一笔"
              onAction={openAdd}
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={feed.phase === 'loadingMore'}
            hasMore={feed.hasMore}
            error={feed.phase === 'error' ? feed.error : null}
            onRetry={() => void feed.loadMore()}
            empty={rows.length === 0}
          />
        }
        onEndReached={() => {
          if (feed.phase === 'idle' && feed.hasMore) void feed.loadMore();
        }}
        onEndReachedThreshold={0.2}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View className="mb-1 mt-3 flex-row items-center justify-between px-1">
              <Text className="text-muted-foreground text-xs font-semibold">{item.label}</Text>
              <Text className="text-muted-foreground text-xs">
                {item.expense > 0 ? `支 ${formatAmount(item.expense)}` : ''}
                {item.income > 0 ? ` 收 ${formatAmount(item.income)}` : ''}
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${categoryLabel(item.record.type, item.record.category)} ${formatAmount(item.record.amount)} 元`}
              onPress={() => openEdit(item.record)}
              onLongPress={() => confirmDelete(item.record)}
              className="mb-1.5"
            >
              <Card className="flex-row items-center p-3">
                <RecordGlyph type={item.record.type} category={item.record.category} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-medium">
                    {categoryLabel(item.record.type, item.record.category)}
                  </Text>
                  {item.record.remark ? (
                    <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
                      {item.record.remark}
                    </Text>
                  ) : null}
                </View>
                <Text
                  className={`text-base font-bold ${item.record.type === 2 ? 'text-found' : 'text-foreground'}`}
                >
                  {item.record.type === 2 ? '+' : '-'}
                  {formatAmount(item.record.amount)}
                </Text>
              </Card>
            </Pressable>
          )
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="记一笔"
        onPress={openAdd}
        className="absolute bottom-28 right-5 h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: token('primary', scheme),
          shadowColor: token('primary', scheme),
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Icon as={Plus} size={24} className="text-primary-foreground" />
      </Pressable>
    </SafeAreaView>
  );
}

/** 记录行左侧分类圆标。 */
function RecordGlyph({ type, category }: { type: LedgerRecord['type']; category: string }) {
  const scheme = useColorScheme() ?? 'light';
  const Glyph = categoryIcon(type, category);
  return (
    <View
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: token(type === 2 ? 'found' : 'accent', scheme) }}
    >
      <Icon
        as={Glyph}
        size={16}
        className={type === 2 ? 'text-found-foreground' : 'text-accent-foreground'}
      />
    </View>
  );
}
