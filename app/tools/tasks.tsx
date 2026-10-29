/**
 * 任务分派:家庭组内互相派任务。两个视图「指派给我的 / 组内全部」,
 * 创建弹层从组成员里选负责人;状态流转 待办→进行中→已完成(负责人或创建者)。
 * 需要先加入家庭组(与记账共用组)。
 */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/form/fields';
import { EmptyState, ErrorState, RefreshingControl } from '@/components/business/feedback';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTaskStatus,
  type ToolTask,
  type TaskStatus,
} from '@/lib/api/endpoints/task';
import { fetchLedgerGroupMembers, fetchLedgerGroups } from '@/lib/api/endpoints/ledger';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const PRIORITY_LABEL: Record<number, string> = { 1: '高', 2: '中', 3: '低' };
const STATUS_LABEL: Record<number, string> = { 1: '待办', 2: '进行中', 3: '已完成' };
/** 状态流转下一步:待办→进行中→已完成;已完成为终态。 */
const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = { 1: 2, 2: 3 };

export default function TasksScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const myUserId = useSession((state) => state.user?.id ?? null);

  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const groupsQuery = useRequest(() => fetchLedgerGroups(), [signedIn]);
  const groups = groupsQuery.data ?? [];
  const activeGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) : null;

  // 组内全部视图必须先选中组,否则不发请求(服务端会拒绝缺 groupId 的查询)
  const tasksQuery = useRequest(
    () => fetchTasks(scope, activeGroup?.id),
    [signedIn, scope, activeGroup?.id],
    { enabled: scope === 'mine' || !!activeGroup },
  );
  const tasks = tasksQuery.data ?? [];

  // 创建弹层状态
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const membersQuery = useRequest(
    () => fetchLedgerGroupMembers(activeGroup?.id ?? ''),
    [createOpen, activeGroup?.id],
    { enabled: createOpen && !!activeGroup },
  );
  const members = membersQuery.data ?? [];

  const openCreate = useCallback(() => {
    if (!activeGroup) {
      toast('请先切换到「组内全部」并选择一个家庭组', 'warn');
      return;
    }
    setTitle('');
    setDetail('');
    setDueDate('');
    setPriority(2);
    setAssignee(myUserId);
    setErrors({});
    setCreateOpen(true);
  }, [activeGroup, myUserId, toast]);

  const create = useCallback(async () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = '请填写任务标题';
    if (!activeGroup) next.group = '缺少家庭组';
    if (!assignee) next.assignee = '请选择负责人';
    setErrors(next);
    if (Object.keys(next).length > 0 || !activeGroup || !assignee || busy) return;
    setBusy(true);
    try {
      await createTask({
        groupId: activeGroup.id,
        assigneeUserId: assignee,
        title: title.trim(),
        detail: detail.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        priority,
      });
      toast('任务已分派', 'success');
      setCreateOpen(false);
      await tasksQuery.reload();
    } catch {
      toast('创建失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [activeGroup, assignee, busy, detail, dueDate, priority, tasksQuery, title, toast]);

  const advance = useCallback(
    async (task: ToolTask) => {
      const next = NEXT_STATUS[task.status];
      if (!next) return;
      try {
        await updateTaskStatus(task.id, next);
        await tasksQuery.reload();
      } catch {
        toast('状态更新失败,请稍后再试', 'error');
      }
    },
    [tasksQuery, toast],
  );

  const confirmDelete = useCallback(
    (task: ToolTask) => {
      Alert.alert('删除这个任务?', task.title, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteTask(task.id);
                toast('已删除');
                await tasksQuery.reload();
              } catch {
                toast('删除失败,请稍后再试', 'error');
              }
            })();
          },
        },
      ]);
    },
    [tasksQuery, toast],
  );

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用任务分派"
          description="和家人互派任务,进度共享"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/tasks', from: 'tasks' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(tasksQuery.status === 'loading', () => void tasksQuery.reload())}
        ListHeaderComponent={
          <View className="mb-3 mt-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold">任务分派</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="新建任务"
                onPress={openCreate}
                className="bg-accent h-10 w-10 items-center justify-center rounded-full"
              >
                <Icon as={Plus} size={20} className="text-primary" />
              </Pressable>
            </View>
            {/* 视图切换 */}
            <View className="mt-3 flex-row rounded-full bg-muted p-1">
              {(['mine', 'all'] as const).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key === 'mine' ? '指派给我的' : '组内全部'}
                  onPress={() => setScope(key)}
                  className={`flex-1 items-center rounded-full py-2 ${scope === key ? 'bg-primary' : ''}`}
                >
                  <Text
                    className={`text-sm font-semibold ${scope === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    {key === 'mine' ? '指派给我的' : '组内全部'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {scope === 'all' ? (
              <View className="mt-2 flex-row flex-wrap" style={{ gap: 6 }}>
                {groups.map((group) => (
                  <Pressable
                    key={group.id}
                    accessibilityRole="button"
                    accessibilityLabel={`选择 ${group.name}`}
                    onPress={() => setSelectedGroupId(group.id)}
                    className="rounded-full border px-3 py-1"
                    style={{
                      borderColor: selectedGroupId === group.id ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: selectedGroupId === group.id ? token('accent', scheme) : 'transparent',
                    }}
                  >
                    <Text
                      className={`text-xs ${selectedGroupId === group.id ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                    >
                      {group.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          tasksQuery.isInitialLoading ? (
            <SkeletonList rows={3} />
          ) : tasksQuery.error ? (
            <ErrorState error={tasksQuery.error} onRetry={() => void tasksQuery.reload()} />
          ) : scope === 'all' && !activeGroup ? (
            <EmptyState
              title="选择一个家庭组"
              description="组内全部视图需要先选中组;还没有组可先去记账页创建"
              actionLabel="去创建家庭组"
              onAction={() => router.push('/tools/ledger/groups')}
            />
          ) : (
            <EmptyState title="没有任务" description="点右上角 + 给家人派个任务" />
          )
        }
        renderItem={({ item }) => {
          const done = item.status === 3;
          const canAdvance = NEXT_STATUS[item.status] !== undefined;
          return (
            <Card className="mb-2 p-3">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${done ? 'text-muted-foreground line-through' : ''}`}>
                    {item.title}
                  </Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    {item.assigneeNickname ?? '成员'} · 优先级 {PRIORITY_LABEL[item.priority] ?? '中'}
                    {item.dueDate ? ` · 截止 ${item.dueDate}` : ''}
                    {!done && item.dueDate && item.dueDate < toDayKeySafe() ? ' · 已过期' : ''}
                  </Text>
                  {item.detail ? (
                    <Text className="text-muted-foreground mt-1 text-xs" numberOfLines={2}>
                      {item.detail}
                    </Text>
                  ) : null}
                </View>
                <View className="ml-2 items-center" style={{ gap: 4 }}>
                  <Text
                    className={`text-xs font-semibold ${done ? 'text-found' : item.status === 2 ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              <View className="mt-2 flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  {canAdvance ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`把任务推进到${STATUS_LABEL[NEXT_STATUS[item.status]!]}`}
                      onPress={() => void advance(item)}
                      className="bg-accent rounded-full px-3 py-1.5"
                    >
                      <Text className="text-accent-foreground text-xs font-semibold">
                        → {STATUS_LABEL[NEXT_STATUS[item.status]!]}
                      </Text>
                    </Pressable>
                  ) : null}
                  {item.creatorUserId === myUserId ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`删除任务 ${item.title}`}
                      onPress={() => confirmDelete(item)}
                      className="p-1.5"
                    >
                      <Icon as={Trash2} size={15} className="text-muted-foreground" />
                    </Pressable>
                  ) : null}
                </View>
                <Text className="text-muted-foreground text-[10px]">
                  {scope === 'all' ? `#${item.groupId}` : ''}
                </Text>
              </View>
            </Card>
          );
        }}
      />

      {/* 创建弹层 */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View className="flex-1 justify-end bg-overlay/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <ScrollView style={{ maxHeight: 480 }}>
              <Text className="mb-3 text-lg font-bold">新建任务</Text>
              <Field label="任务标题" error={errors.title} required>
                <TextInput
                  className="border-border rounded-lg border px-3 py-2 text-sm"
                  style={{ color: token('foreground', scheme) }}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="比如:周末大扫除"
                  accessibilityLabel="任务标题"
                />
              </Field>
              <Field label="详情" error={errors.detail}>
                <TextInput
                  className="border-border rounded-lg border px-3 py-2 text-sm"
                  style={{ color: token('foreground', scheme) }}
                  value={detail}
                  onChangeText={setDetail}
                  placeholder="选填"
                  multiline
                  accessibilityLabel="任务详情"
                />
              </Field>
              <Field label="负责人" error={errors.assignee} required>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {members.map((member) => (
                    <Pressable
                      key={member.userId}
                      accessibilityRole="button"
                      accessibilityLabel={`负责人 ${member.nickname ?? ''}`}
                      onPress={() => setAssignee(member.userId)}
                      className="rounded-full border px-3 py-1.5"
                      style={{
                        borderColor: assignee === member.userId ? token('primary', scheme) : token('border', scheme),
                        backgroundColor: assignee === member.userId ? token('primary', scheme) : 'transparent',
                      }}
                    >
                      <Text
                        className={`text-xs ${assignee === member.userId ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}
                      >
                        {member.nickname ?? '成员'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Field label="截止日期" hint="yyyy-MM-dd,选填">
                    <TextInput
                      className="border-border rounded-lg border px-3 py-2 text-sm"
                      style={{ color: token('foreground', scheme) }}
                      value={dueDate}
                      onChangeText={setDueDate}
                      placeholder="2026-11-05"
                      accessibilityLabel="截止日期"
                    />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="优先级">
                    <View className="flex-row" style={{ gap: 6 }}>
                      {([1, 2, 3] as const).map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityLabel={`优先级${PRIORITY_LABEL[value]}`}
                          onPress={() => setPriority(value)}
                          className="flex-1 items-center rounded-lg border py-2"
                          style={{
                            borderColor: priority === value ? token('primary', scheme) : token('border', scheme),
                            backgroundColor: priority === value ? token('accent', scheme) : 'transparent',
                          }}
                        >
                          <Text
                            className={`text-xs ${priority === value ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                          >
                            {PRIORITY_LABEL[value]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </Field>
                </View>
              </View>
              <View className="mb-2 mt-2 flex-row" style={{ gap: 12 }}>
                <Button variant="outline" className="flex-1" onPress={() => setCreateOpen(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="flex-1" onPress={() => void create()} disabled={busy}>
                  <Text>{busy ? '分派中…' : '分派任务'}</Text>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function toDayKeySafe(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
