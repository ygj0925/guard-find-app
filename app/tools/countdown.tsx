/**
 * 倒数日:目标日期列表 + 新增/编辑/删除。
 * daysLeft 服务端算好(负数=已过),本页只渲染;日期输入用 yyyy-MM-dd 文本
 * (与记一笔页同模式,不引日期选择器原生依赖)。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarClock, Pencil, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/fields';
import {
  EmptyState,
  ErrorState,
  RefreshingControl,
  SectionCard,
} from '@/components/business/feedback';
import {
  createCountdown,
  deleteCountdown,
  fetchCountdowns,
  updateCountdown,
  type ToolCountdown,
} from '@/lib/api/endpoints/tools';
import { toDayKey } from '@/lib/ledger/stats';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** daysLeft 展示文案。 */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return '就是今天';
  if (daysLeft > 0) return `还有 ${daysLeft} 天`;
  return `已过 ${Math.abs(daysLeft)} 天`;
}

export default function CountdownScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const query = useRequest(() => fetchCountdowns(), [signedIn]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ToolCountdown | null>(null);
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState(toDayKey(new Date()));
  const [remark, setRemark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openCreate = useCallback(() => {
    setEditing(null);
    setTitle('');
    setTargetDate(toDayKey(new Date()));
    setRemark('');
    setErrors({});
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((record: ToolCountdown) => {
    setEditing(record);
    setTitle(record.title);
    setTargetDate(record.targetDate);
    setRemark(record.remark ?? '');
    setErrors({});
    setEditorOpen(true);
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = '请填写事项名称';
    else if (title.trim().length > 50) next.title = '名称不能超过 50 字';
    if (!DAY_RE.test(targetDate) || Number.isNaN(new Date(targetDate).getTime())) {
      next.targetDate = '日期格式应为 yyyy-MM-dd';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const payload = { title: title.trim(), targetDate, remark: remark.trim() || undefined };
      if (editing) await updateCountdown(editing.id, payload);
      else await createCountdown(payload);
      toast(editing ? '已更新' : '已添加');
      setEditorOpen(false);
      await query.reload();
    } catch {
      toast('保存失败,请稍后再试', 'error');
    } finally {
      setSaving(false);
    }
  }, [editing, query, remark, saving, targetDate, title, toast]);

  const confirmDelete = useCallback(
    (record: ToolCountdown) => {
      Alert.alert('删除这个倒数日?', record.title, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteCountdown(record.id);
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

  const records = useMemo(() => query.data ?? [], [query.data]);

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用倒数日"
          description="重要日子云端同步,换设备不丢"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/countdown', from: 'countdown' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
        ListHeaderComponent={
          <View className="mb-4 mt-2 flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold">倒数日</Text>
              <Text className="text-muted-foreground mt-1 text-sm">考试 · 纪念日 · 还款日</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="新增倒数日"
              onPress={openCreate}
              className="bg-accent h-10 w-10 items-center justify-center rounded-full"
            >
              <Icon as={Plus} size={20} className="text-primary" />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : (
            <EmptyState
              title="还没有倒数日"
              description="点右上角 + 添加一个重要的日子"
              actionLabel="添加"
              onAction={openCreate}
            />
          )
        }
        renderItem={({ item }) => {
          const past = item.daysLeft < 0;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title},${daysLeftLabel(item.daysLeft)}`}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              className="mb-2"
            >
              <Card className="flex-row items-center p-3">
                <View className="bg-accent h-9 w-9 items-center justify-center rounded-full">
                  <Icon as={CalendarClock} size={16} className="text-accent-foreground" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-medium">{item.title}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    {item.targetDate}
                    {item.remark ? ` · ${item.remark}` : ''}
                  </Text>
                </View>
                <Text className={`text-sm font-bold ${past ? 'text-muted-foreground' : 'text-primary'}`}>
                  {daysLeftLabel(item.daysLeft)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`编辑 ${item.title}`}
                  onPress={() => openEdit(item)}
                  className="ml-2 p-1"
                >
                  <Icon as={Pencil} size={14} className="text-muted-foreground" />
                </Pressable>
              </Card>
            </Pressable>
          );
        }}
      />

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-3 text-lg font-bold">{editing ? '编辑倒数日' : '新增倒数日'}</Text>
            <Field label="事项名称" error={errors.title} required>
              <Input value={title} onChangeText={setTitle} placeholder="比如:考研初试" aria-label="事项名称" />
            </Field>
            <Field label="目标日期" error={errors.targetDate} required hint="格式 yyyy-MM-dd">
              <Input value={targetDate} onChangeText={setTargetDate} placeholder="2026-12-20" aria-label="目标日期" />
            </Field>
            <Field label="备注" error={errors.remark}>
              <Input value={remark} onChangeText={setRemark} placeholder="选填" aria-label="备注" />
            </Field>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setEditorOpen(false)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void save()} disabled={saving}>
                <Text>{saving ? '保存中…' : '保存'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
