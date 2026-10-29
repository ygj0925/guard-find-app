/**
 * 月度工作汇报:我相关的活动列表(角色徽标 + 提交进度) + 新建弹层。
 * 填报人/接收人从「我的关注」列表选人(一期边界,文档 12.4)。
 */
import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/fields';
import { EmptyState, ErrorState, RefreshingControl, SectionCard } from '@/components/business/feedback';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  createReport,
  deleteReport,
  fetchMyReports,
  type ToolReport,
} from '@/lib/api/endpoints/report';
import { fetchFollowing } from '@/lib/api/endpoints/social';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const ROLE_LABEL: Record<number, string> = { 1: '我发起', 2: '待我填', 3: '抄送我' };

export default function ReportScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const scheme = useColorScheme() ?? 'light';

  const query = useRequest(() => fetchMyReports(), [signedIn]);
  const activities = query.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dueDate, setDueDate] = useState('');
  const [picking, setPicking] = useState<'assignee' | 'viewer' | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [viewers, setViewers] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // 选人来源:我的关注列表(一期边界,文档 12.4)
  const followingQuery = useRequest(() => fetchFollowing(1, 50), [picking !== null], {
    enabled: picking !== null,
  });
  const candidates = followingQuery.data?.records ?? [];

  const create = useCallback(async () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = '请填写汇报标题';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.trim())) next.period = '周期格式应为 yyyy-MM';
    if (assignees.length === 0) next.assignees = '请至少选择 1 名填报人';
    setErrors(next);
    if (Object.keys(next).length > 0 || busy) return;
    setBusy(true);
    try {
      await createReport({
        title: title.trim(),
        period: period.trim(),
        dueDate: dueDate.trim() ? `${dueDate.trim()}:00` : undefined,
        assigneeUserIds: assignees,
        viewerUserIds: viewers.length > 0 ? viewers : undefined,
      });
      toast('汇报已发起,填报人已收到通知', 'success');
      setCreateOpen(false);
      setTitle('');
      setAssignees([]);
      setViewers([]);
      await query.reload();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '创建失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [assignees, busy, dueDate, period, query, title, viewers, toast]);

  const confirmDelete = useCallback(
    (activity: ToolReport) => {
      Alert.alert('删除这个汇报?', '成员与月报会一起删除', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteReport(activity.id);
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
          title="登录后使用工作汇报"
          description="发起月度汇报,成员填报,全员可读可评"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/report', from: 'report' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">工作汇报</Text>
            <Text className="text-muted-foreground mt-1 text-sm">月度汇报 · 全员可读 · 评论回复</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发起汇报"
            onPress={() => setCreateOpen(true)}
            className="bg-accent h-10 w-10 items-center justify-center rounded-full"
          >
            <Icon as={Plus} size={20} className="text-primary" />
          </Pressable>
        </View>

        {query.isInitialLoading ? (
          <SectionCard title="加载中…">{null}</SectionCard>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : activities.length === 0 ? (
          <EmptyState
            title="还没有汇报"
            description="点右上角 + 发起月度汇报,指定填报人"
            actionLabel="发起汇报"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          activities.map((activity) => (
            <PressableScale
              key={activity.id}
              accessibilityRole="button"
              accessibilityLabel={`查看 ${activity.title}`}
              onPress={() => router.push(`/tools/report-detail?id=${activity.id}` as never)}
              onLongPress={activity.myRole === 1 ? () => confirmDelete(activity) : undefined}
              className="mb-2"
            >
              <Card className="p-3">
                <View className="flex-row items-center">
                  <View className="bg-accent mr-3 h-9 w-9 items-center justify-center rounded-full">
                    <Icon as={FileText} size={16} className="text-accent-foreground" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium">{activity.title}</Text>
                    <Text className="text-muted-foreground mt-0.5 text-xs">
                      {activity.period} · 已交 {activity.submittedCount}/{activity.reporterCount}
                      {activity.myEntryStatus === 1 ? ' · 我的草稿未交' : ''}
                    </Text>
                  </View>
                  <Text className="text-primary text-xs font-semibold">{ROLE_LABEL[activity.myRole]}</Text>
                </View>
              </Card>
            </PressableScale>
          ))
        )}
      </ScrollView>

      {/* 新建弹层 */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <ScrollView style={{ maxHeight: 520 }}>
              <Text className="mb-3 text-lg font-bold">发起月度汇报</Text>
              <Field label="汇报标题" error={errors.title} required>
                <Input value={title} onChangeText={setTitle} placeholder="比如:10 月月度工作汇报" aria-label="汇报标题" />
              </Field>
              <Field label="汇报周期" error={errors.period} required hint="yyyy-MM">
                <Input value={period} onChangeText={setPeriod} placeholder="2026-10" aria-label="汇报周期" />
              </Field>
              <Field label="截止时间" hint="yyyy-MM-dd HH:mm,选填;超期提交标迟交">
                <Input value={dueDate} onChangeText={setDueDate} placeholder="2026-11-05 18:00" aria-label="截止时间" />
              </Field>
              <Field label={`填报人(${assignees.length})`} error={errors.assignees} required>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="选择填报人"
                  onPress={() => setPicking('assignee')}
                  className="border-border rounded-lg border px-3 py-2"
                >
                  <Text className="text-muted-foreground text-sm">
                    {assignees.length > 0 ? `已选 ${assignees.length} 人` : '从我的关注中选择'}
                  </Text>
                </Pressable>
              </Field>
              <Field label={`接收人(${viewers.length})`} hint="只读+评论">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="选择接收人"
                  onPress={() => setPicking('viewer')}
                  className="border-border rounded-lg border px-3 py-2"
                >
                  <Text className="text-muted-foreground text-sm">
                    {viewers.length > 0 ? `已选 ${viewers.length} 人` : '从我的关注中选择(选填)'}
                  </Text>
                </Pressable>
              </Field>
              <View className="mb-2 mt-2 flex-row" style={{ gap: 12 }}>
                <Button variant="outline" className="flex-1" onPress={() => setCreateOpen(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="flex-1" onPress={() => void create()} disabled={busy}>
                  <Text>{busy ? '发起中…' : '发起汇报'}</Text>
                </Button>
              </View>
            </ScrollView>
          </View>

          {/* 选人弹层 */}
          <Modal visible={picking !== null} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
            <View className="flex-1 justify-end bg-black/40">
              <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
                <Text className="mb-3 text-lg font-bold">
                  {picking === 'assignee' ? '选择填报人' : '选择接收人'}
                </Text>
                {candidates.length === 0 ? (
                  <EmptyState
                    title="关注列表为空"
                    description="先在社区关注同事,再来选择填报人"
                  />
                ) : (
                  (picking === 'assignee' ? assignees : viewers) && (
                    <ScrollView style={{ maxHeight: 320 }}>
                      {candidates.map((user) => {
                        const list = picking === 'assignee' ? assignees : viewers;
                        const selected = list.includes(user.userId);
                        return (
                          <Pressable
                            key={user.userId}
                            accessibilityRole="checkbox"
                            accessibilityState={selected ? { checked: true } : { checked: false }}
                            accessibilityLabel={`选择 ${user.nickname ?? ''}`}
                            onPress={() => {
                              const setter = picking === 'assignee' ? setAssignees : setViewers;
                              setter((prev) =>
                                selected ? prev.filter((id) => id !== user.userId) : [...prev, user.userId],
                              );
                            }}
                            className="mb-1 flex-row items-center rounded-lg px-2 py-2"
                            style={{ gap: 8 }}
                          >
                            <View
                              className="h-5 w-5 items-center justify-center rounded-full border"
                              style={{
                                borderColor: selected ? token('primary', scheme) : token('border', scheme),
                                backgroundColor: selected ? token('primary', scheme) : 'transparent',
                              }}
                            >
                              {selected ? <Text className="text-primary-foreground text-[10px]">✓</Text> : null}
                            </View>
                            <Text className="text-foreground flex-1 text-sm">
                              {user.nickname ?? '用户'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )
                )}
                <Button className="mt-3" onPress={() => setPicking(null)}>
                  <Text>完成</Text>
                </Button>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
