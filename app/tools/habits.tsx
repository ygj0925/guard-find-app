/**
 * 习惯打卡:卡片列表(streak + 今日打卡按钮)+ 新建/编辑弹层。
 * 统计口径服务端出;详情月历在 habit-detail 页。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Flame, Pencil, Plus } from 'lucide-react-native';

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
} from '@/components/business/feedback';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  createHabit,
  deleteHabit,
  fetchHabits,
  toggleHabitCheckin,
  updateHabit,
  type ToolHabit,
} from '@/lib/api/endpoints/habit';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

export default function HabitsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const query = useRequest(() => fetchHabits(), [signedIn]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ToolHabit | null>(null);
  const [title, setTitle] = useState('');
  const [remark, setRemark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const records = useMemo(() => query.data ?? [], [query.data]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setTitle('');
    setRemark('');
    setErrors({});
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((habit: ToolHabit) => {
    setEditing(habit);
    setTitle(habit.title);
    setRemark(habit.remark ?? '');
    setErrors({});
    setEditorOpen(true);
  }, []);

  const save = useCallback(async () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = '请填写习惯名称';
    else if (title.trim().length > 50) next.title = '名称不能超过 50 字';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      const payload = { title: title.trim(), remark: remark.trim() || undefined };
      if (editing) await updateHabit(editing.id, payload);
      else await createHabit(payload);
      toast(editing ? '已更新' : '已添加');
      setEditorOpen(false);
      await query.reload();
    } catch {
      toast('保存失败,请稍后再试', 'error');
    }
  }, [editing, query, remark, title, toast]);

  const flip = useCallback(
    async (habit: ToolHabit) => {
      if (busyId) return;
      setBusyId(habit.id);
      // 乐观翻转 todayChecked 与 streak(+1/-1),失败回滚
      const apply = (delta: number) =>
        query.setData(
          records.map((item) =>
            item.id === habit.id
              ? {
                  ...item,
                  todayChecked: delta > 0,
                  currentStreak: Math.max(0, item.currentStreak + delta),
                  totalDays: Math.max(0, item.totalDays + delta),
                }
              : item,
          ),
        );
      apply(habit.todayChecked ? -1 : 1);
      try {
        await toggleHabitCheckin(habit.id);
      } catch {
        apply(habit.todayChecked ? 1 : -1);
        toast('打卡失败,请稍后再试', 'error');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, query, records, toast],
  );

  const confirmDelete = useCallback(
    (habit: ToolHabit) => {
      Alert.alert('删除这个习惯?', '打卡记录会一起删除', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteHabit(habit.id);
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
          title="登录后使用习惯打卡"
          description="打卡记录云端同步,连续天数不丢"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/habits', from: 'habits' }))}
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
              <Text className="text-2xl font-bold">习惯打卡</Text>
              <Text className="text-muted-foreground mt-1 text-sm">每天一点点,连续看得见</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="新增习惯"
              onPress={openCreate}
              className="bg-accent h-10 w-10 items-center justify-center rounded-full"
            >
              <Icon as={Plus} size={20} className="text-primary" />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SkeletonList rows={3} />
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : (
            <EmptyState
              title="还没有习惯"
              description="点右上角 + 建一个,比如「每天喝够 8 杯水」"
              actionLabel="新建习惯"
              onAction={openCreate}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看 ${item.title} 的打卡日历`}
            onPress={() => router.push(`/tools/habit-detail?id=${item.id}&title=${encodeURIComponent(item.title)}`)}
            onLongPress={() => confirmDelete(item)}
            className="mb-2"
          >
            <Card className="p-3">
              <View className="flex-row items-center">
                <View className="bg-pending/15 mr-3 h-9 w-9 items-center justify-center rounded-full">
                  <Icon as={Flame} size={16} className="text-pending" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium">{item.title}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    连续 {item.currentStreak} 天 · 最长 {item.bestStreak} 天 · 累计 {item.totalDays} 次
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`编辑 ${item.title}`}
                  onPress={() => openEdit(item)}
                  className="p-1"
                >
                  <Icon as={Pencil} size={14} className="text-muted-foreground" />
                </Pressable>
              </View>
              <Button
                size="sm"
                variant={item.todayChecked ? 'outline' : 'default'}
                className="mt-2"
                onPress={() => void flip(item)}
                disabled={busyId === item.id}
              >
                <Text>{item.todayChecked ? '今天已打卡 ✓ 点此撤销' : '今天打卡'}</Text>
              </Button>
            </Card>
          </Pressable>
        )}
      />

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View className="flex-1 justify-end bg-overlay/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-3 text-lg font-bold">{editing ? '编辑习惯' : '新建习惯'}</Text>
            <Field label="习惯名称" error={errors.title} required>
              <Input value={title} onChangeText={setTitle} placeholder="比如:每天走 6000 步" aria-label="习惯名称" />
            </Field>
            <Field label="备注" error={errors.remark}>
              <Input value={remark} onChangeText={setRemark} placeholder="选填" aria-label="备注" />
            </Field>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setEditorOpen(false)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void save()}>
                <Text>保存</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
