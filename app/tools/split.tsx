/**
 * AA 分账:实时计算(每人金额,余数前 N 人多 1 分)+ 历史记录 + 一键写回记账。
 * 写回走现有 ledger 接口(支出/人情分类),成功后标记 writtenBack。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CircleDollarSign, Users } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  ErrorState,
  RefreshingControl,
  SectionCard,
} from '@/components/business/feedback';
import {
  createSplit,
  deleteSplit,
  fetchSplits,
  markSplitWrittenBack,
  type ToolSplit,
} from '@/lib/api/endpoints/split';
import { createLedgerRecord } from '@/lib/api/endpoints/ledger';
import { splitAmount } from '@/lib/split/calc';
import { formatAmount, toDayKey } from '@/lib/ledger/stats';
import { useRequest } from '@/hooks/useRequest';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

export default function SplitScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const query = useRequest(() => fetchSplits(), [signedIn]);
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [people, setPeople] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedTotal = Number(total.trim());
  const parsedPeople = Number(people.trim());
  const result = useMemo(
    () => (total.trim() && people.trim() ? splitAmount(parsedTotal, parsedPeople) : null),
    [parsedTotal, parsedPeople, total, people],
  );

  const history = query.data ?? [];

  const save = useCallback(
    async (writeBack: boolean) => {
      if (!result || saving) {
        toast('请先输入有效金额和人数', 'warn');
        return;
      }
      setSaving(true);
      try {
        const id = await createSplit({
          title: title.trim() || undefined,
          totalAmount: parsedTotal,
          peopleCount: parsedPeople,
          splitDate: toDayKey(new Date()),
        });
        if (writeBack) {
          await createLedgerRecord({
            type: 1,
            amount: parsedTotal,
            category: 'social',
            recordDate: toDayKey(new Date()),
            remark: `AA分账:${title.trim() || '未命名'}(每人 ${result.perHead.toFixed(2)} 元)`,
          });
          await markSplitWrittenBack(String(id));
          toast('已保存并记入账本');
        } else {
          toast('已保存');
        }
        setTotal('');
        setPeople('');
        setTitle('');
        await query.reload();
      } catch {
        toast('保存失败,请稍后再试', 'error');
      } finally {
        setSaving(false);
      }
    },
    [parsedPeople, parsedTotal, query, result, saving, title, toast],
  );

  const confirmDelete = useCallback(
    (record: ToolSplit) => {
      Alert.alert('删除这条分账?', record.title, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteSplit(record.id);
                toast('已删除');
                await query.reload();
              } catch {
                toast('删除失败,请稍后再试', 'error');
              }
            })();
          },
        },
      ]);
    },
    [query, toast],
  );

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用 AA 分账"
          description="分账历史云端同步,可一键写回记账"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/split', from: 'split' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
        ListHeaderComponent={
          <View className="mb-4 mt-2">
            <Text className="text-2xl font-bold">AA 分账</Text>
            <Text className="text-muted-foreground mt-1 text-sm">算完一键记进账本,余数自动分配</Text>
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : (
            <EmptyState title="还没有分账记录" description="在上面算一笔,保存后这里会留档" />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`分账 ${item.title},${item.totalAmount} 元`}
            onLongPress={() => confirmDelete(item)}
            className="mb-2"
          >
            <Card className="p-3">
              <View className="flex-row items-center">
                <View className="bg-accent h-9 w-9 items-center justify-center rounded-full">
                  <Icon as={Users} size={16} className="text-accent-foreground" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-medium">{item.title}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    {item.splitDate} · {item.peopleCount} 人
                    {item.writtenBack ? ' · 已记入账本' : ''}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-bold">{formatAmount(item.totalAmount)} 元</Text>
                  <Text className="text-muted-foreground text-xs">
                    每人 {item.perHead.toFixed(2)} 元{item.remainderCents > 0 ? ` +余${item.remainderCents}分` : ''}
                  </Text>
                </View>
              </View>
              {!item.writtenBack ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onPress={() => {
                    void (async () => {
                      try {
                        await createLedgerRecord({
                          type: 1,
                          amount: item.totalAmount,
                          category: 'social',
                          recordDate: item.splitDate,
                          remark: `AA分账:${item.title}(每人 ${item.perHead.toFixed(2)} 元)`,
                        });
                        await markSplitWrittenBack(item.id);
                        toast('已记入账本');
                        await query.reload();
                      } catch {
                        toast('写回失败,请稍后再试', 'error');
                      }
                    })();
                  }}
                >
                  <Text>记入账本(支出 · 人情)</Text>
                </Button>
              ) : null}
            </Card>
          </Pressable>
        )}
      />

      {/* 计算器:固定在顶部输入区(放 ListHeader 之后由内容滚动,改用绝对定位浮层太挤,直接首屏卡片) */}
      <Card className="mx-4 mb-2 p-4">
        <View className="flex-row" style={{ gap: 8 }}>
          <View className="flex-1">
            <Text className="text-muted-foreground mb-1 text-xs">事由</Text>
            <TextInput
              className="border-border text-foreground rounded-lg border px-3 py-2 text-sm"
              style={{ color: token('foreground', scheme) }}
              value={title}
              onChangeText={setTitle}
              placeholder="聚餐"
              placeholderTextColor={token('muted-foreground', scheme)}
              accessibilityLabel="分账事由"
            />
          </View>
          <View className="flex-1">
            <Text className="text-muted-foreground mb-1 text-xs">总金额(元)</Text>
            <TextInput
              className="border-border text-foreground rounded-lg border px-3 py-2 text-sm"
              style={{ color: token('foreground', scheme) }}
              value={total}
              onChangeText={setTotal}
              placeholder="312.60"
              placeholderTextColor={token('muted-foreground', scheme)}
              keyboardType="decimal-pad"
              accessibilityLabel="总金额"
            />
          </View>
          <View className="w-20">
            <Text className="text-muted-foreground mb-1 text-xs">人数</Text>
            <TextInput
              className="border-border text-foreground rounded-lg border px-3 py-2 text-sm"
              style={{ color: token('foreground', scheme) }}
              value={people}
              onChangeText={setPeople}
              placeholder="5"
              placeholderTextColor={token('muted-foreground', scheme)}
              keyboardType="number-pad"
              accessibilityLabel="参与人数"
            />
          </View>
        </View>

        {result ? (
          <View className="mt-3 flex-row items-center" style={{ gap: 10 }}>
            <Icon as={CircleDollarSign} size={18} className="text-primary" />
            <Text className="text-foreground text-sm font-semibold">
              每人 {result.perHead.toFixed(2)} 元
              {result.remainderCents > 0
                ? `(前 ${result.remainderCents} 人各多 1 分)`
                : ''}
            </Text>
          </View>
        ) : null}

        <View className="mt-3 flex-row" style={{ gap: 12 }}>
          <Button variant="outline" className="flex-1" onPress={() => void save(false)} disabled={saving || !result}>
            <Text>{saving ? '保存中…' : '仅保存'}</Text>
          </Button>
          <Button className="flex-1" onPress={() => void save(true)} disabled={saving || !result}>
            <Text>保存并记入账本</Text>
          </Button>
        </View>
      </Card>
    </SafeAreaView>
  );
}
