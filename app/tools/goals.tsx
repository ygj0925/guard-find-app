/**
 * 目标 OKR lite:目标(O) + KR 量化进度。周期筛选(季度/全年),
 * KR 进度条 = 当前值/目标值;达成自动完成;可手动标记完成/恢复。
 */
import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Target, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/form/fields';
import { EmptyState, ErrorState } from '@/components/business/feedback';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  createGoal,
  createKeyResult,
  deleteGoal,
  deleteKeyResult,
  fetchGoals,
  toggleKeyResult,
  updateKrProgress,
  type ToolGoal,
} from '@/lib/api/endpoints/goal';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

/** 周期选项:今年四季度 + 全年。 */
function periodOptions(): string[] {
  const year = new Date().getFullYear();
  return [`${year}Q1`, `${year}Q2`, `${year}Q3`, `${year}Q4`, String(year)];
}

export default function GoalsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const [period, setPeriod] = useState<string | null>(null);
  const query = useRequest(() => fetchGoals(period ?? undefined), [signedIn, period]);
  const goals = query.data ?? [];

  // 新建目标弹层
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalPeriod, setGoalPeriod] = useState(periodOptions()[3]);
  const [goalError, setGoalError] = useState('');
  const [busy, setBusy] = useState(false);
  // KR 弹层
  const [krTarget, setKrTarget] = useState<ToolGoal | null>(null);
  const [krTitle, setKrTitle] = useState('');
  const [krValue, setKrValue] = useState('');
  const [krUnit, setKrUnit] = useState('');
  const [krError, setKrError] = useState('');
  // 进度弹层
  const [progressTarget, setProgressTarget] = useState<{ krId: string; title: string; unit: string | null } | null>(null);
  const [progressValue, setProgressValue] = useState('');

  const submitGoal = useCallback(async () => {
    const title = goalTitle.trim();
    if (!title) {
      setGoalError('请填写目标描述');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await createGoal(title, goalPeriod);
      toast('目标已创建,添加可量化的 KR 吧', 'success');
      setGoalOpen(false);
      setGoalTitle('');
      await query.reload();
    } catch {
      toast('创建失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, goalPeriod, goalTitle, query, toast]);

  const addKr = useCallback(async () => {
    const title = krTitle.trim();
    const value = Number(krValue);
    if (!title) {
      setKrError('请填写 KR 描述');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setKrError('目标值必须是大于 0 的数字');
      return;
    }
    if (busy || !krTarget) return;
    setBusy(true);
    try {
      await createKeyResult(krTarget.id, { title, targetValue: value, unit: krUnit.trim() || undefined });
      toast('KR 已添加', 'success');
      setKrTarget(null);
      setKrTitle('');
      setKrValue('');
      setKrUnit('');
      await query.reload();
    } catch {
      toast('添加失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, krTarget, krTitle, krUnit, krValue, query, toast]);

  const saveProgress = useCallback(async () => {
    const value = Number(progressValue);
    if (!Number.isFinite(value) || value < 0) {
      toast('请输入有效的数字', 'warn');
      return;
    }
    if (busy || !progressTarget) return;
    setBusy(true);
    try {
      await updateKrProgress(progressTarget.krId, value);
      toast('进度已更新', 'success');
      setProgressTarget(null);
      await query.reload();
    } catch {
      toast('更新失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, progressTarget, progressValue, query, toast]);

  const confirmDeleteGoal = useCallback(
    (goal: ToolGoal) => {
      Alert.alert('删除这个目标?', '目标下的 KR 会一起删除', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteGoal(goal.id);
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

  const percentText = useCallback((progress: number) => `${Math.round(progress * 100)}%`, []);

  const inputStyle = { color: token('foreground', scheme), borderColor: token('border', scheme) } as const;

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用目标管理"
          description="个人 OKR:定目标,拆 KR,量化进度"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/goals', from: 'goals' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">目标 OKR</Text>
            <Text className="text-muted-foreground mt-1 text-sm">定目标 · 拆 KR · 量化进度</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新建目标"
            onPress={() => setGoalOpen(true)}
            className="bg-accent h-10 w-10 items-center justify-center rounded-full"
          >
            <Icon as={Target} size={20} className="text-primary" />
          </Pressable>
        </View>

        <View className="mb-3 flex-row flex-wrap" style={{ gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="全部周期"
            onPress={() => setPeriod(null)}
            className="rounded-full border px-3 py-1.5"
            style={{
              borderColor: period === null ? token('primary', scheme) : token('border', scheme),
              backgroundColor: period === null ? token('primary', scheme) : 'transparent',
            }}
          >
            <Text className={`text-xs ${period === null ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}>
              全部
            </Text>
          </Pressable>
          {periodOptions().map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={option}
              onPress={() => setPeriod(option)}
              className="rounded-full border px-3 py-1.5"
              style={{
                borderColor: period === option ? token('primary', scheme) : token('border', scheme),
                backgroundColor: period === option ? token('primary', scheme) : 'transparent',
              }}
            >
              <Text className={`text-xs ${period === option ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        {query.isInitialLoading ? (
          <SkeletonList rows={3} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : goals.length === 0 ? (
          <EmptyState
            title="还没有目标"
            description="比如「Q4 养成规律运动」,再拆成可量化的 KR"
            actionLabel="新建目标"
            onAction={() => setGoalOpen(true)}
          />
        ) : (
          goals.map((goal) => (
            <Card key={goal.id} className="mb-3 p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold">{goal.title}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">{goal.period}</Text>
                </View>
                {/* 模块特色:整体进度百分比大字(OKR 的核心读数) */}
                <Text
                  className="text-primary text-2xl font-bold"
                  accessibilityLabel={`整体进度 ${percentText(goal.progress)}`}
                >
                  {percentText(goal.progress)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`删除目标 ${goal.title}`}
                  onPress={() => confirmDeleteGoal(goal)}
                  className="ml-1 p-1"
                >
                  <Icon as={Trash2} size={14} className="text-muted-foreground" />
                </Pressable>
              </View>

              <View
                className="mt-2 h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: token('muted', scheme) }}
              >
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(2, Math.round(goal.progress * 100))}%`,
                    backgroundColor: token('primary', scheme),
                  }}
                />
              </View>

              <View className="mt-3" style={{ gap: 10 }}>
                {goal.keyResults.map((kr) => (
                  <View key={kr.id}>
                    <View className="flex-row items-center justify-between">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`KR:${kr.title},当前 ${kr.currentValue}${kr.status === 2 ? ',已完成,点按可恢复' : ',点按可标记完成'}`}
                        onLongPress={() => {
                          void (async () => {
                            try {
                              await toggleKeyResult(kr.id);
                              await query.reload();
                            } catch {
                              toast('操作失败,请稍后再试', 'error');
                            }
                          })();
                        }}
                        onPress={() => {
                          setProgressTarget({ krId: kr.id, title: kr.title, unit: kr.unit });
                          setProgressValue(String(kr.currentValue));
                        }}
                        className="flex-1"
                      >
                        <Text
                          className={`text-sm ${kr.status === 2 ? 'text-found line-through' : 'text-foreground'}`}
                        >
                          {kr.title}
                          {kr.unit ? `(${kr.unit})` : ''}
                        </Text>
                        <Text className="text-muted-foreground mt-0.5 text-xs">
                          {kr.currentValue} / {kr.targetValue} · {percentText(kr.progress)}
                          {kr.taskTotal && kr.taskTotal > 0 ? ` · 任务 ${kr.taskDone}/${kr.taskTotal}` : ''}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`更新进度:${kr.title}`}
                        onPress={() => {
                          setProgressTarget({ krId: kr.id, title: kr.title, unit: kr.unit });
                          setProgressValue(String(kr.currentValue));
                        }}
                        className="bg-accent mr-1 rounded-full px-3 py-1"
                      >
                        <Text className="text-accent-foreground text-xs font-semibold">更新</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`删除 KR:${kr.title}`}
                        onPress={() => {
                          void (async () => {
                            try {
                              await deleteKeyResult(kr.id);
                              await query.reload();
                            } catch {
                              toast('删除失败,请稍后再试', 'error');
                            }
                          })();
                        }}
                        className="p-1"
                      >
                        <Icon as={Trash2} size={13} className="text-muted-foreground" />
                      </Pressable>
                    </View>
                    <View
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                      style={{ backgroundColor: token('muted', scheme) }}
                    >
                      <View
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.max(2, Math.round(kr.progress * 100))}%`,
                          backgroundColor: kr.status === 2 ? token('found', scheme) : token('primary', scheme),
                        }}
                      />
                    </View>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`给目标 ${goal.title} 添加 KR`}
                  onPress={() => setKrTarget(goal)}
                  className="items-center rounded-lg border border-dashed py-2"
                  style={{ borderColor: token('border', scheme) }}
                >
                  <Text className="text-muted-foreground text-xs">+ 添加关键结果(KR)</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* 新建目标 */}
      <Modal visible={goalOpen} transparent animationType="slide" onRequestClose={() => setGoalOpen(false)}>
        <View className="flex-1 justify-end bg-overlay/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-3 text-lg font-bold">新建目标</Text>
            <Field label="目标描述" error={goalError} required hint="定方向,鼓舞人心,比如「Q4 养成规律运动」">
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={goalTitle}
                onChangeText={setGoalTitle}
                accessibilityLabel="目标描述"
              />
            </Field>
            <Field label="周期" required>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {periodOptions().map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setGoalPeriod(option)}
                    className="rounded-lg border px-3 py-1.5"
                    style={{
                      borderColor: goalPeriod === option ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: goalPeriod === option ? token('accent', scheme) : 'transparent',
                    }}
                  >
                    <Text className={`text-xs ${goalPeriod === option ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setGoalOpen(false)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void submitGoal()} disabled={busy}>
                <Text>{busy ? '创建中…' : '创建目标'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 添加 KR */}
      <Modal visible={krTarget !== null} transparent animationType="slide" onRequestClose={() => setKrTarget(null)}>
        <View className="flex-1 justify-end bg-overlay/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-1 text-lg font-bold">添加关键结果</Text>
            <Text className="text-muted-foreground mb-3 text-xs" numberOfLines={1}>
              {krTarget?.title}
            </Text>
            <Field label="KR 描述" error={krError} required hint="必须可量化,比如「跑步 100 公里」">
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={krTitle}
                onChangeText={setKrTitle}
                accessibilityLabel="KR 描述"
              />
            </Field>
            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <Field label="目标值" required>
                  <TextInput
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={inputStyle}
                    value={krValue}
                    onChangeText={setKrValue}
                    keyboardType="decimal-pad"
                    accessibilityLabel="目标值"
                  />
                </Field>
              </View>
              <View className="w-24">
                <Field label="单位">
                  <TextInput
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={inputStyle}
                    value={krUnit}
                    onChangeText={setKrUnit}
                    placeholder="公里"
                    accessibilityLabel="单位"
                  />
                </Field>
              </View>
            </View>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setKrTarget(null)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void addKr()} disabled={busy}>
                <Text>{busy ? '添加中…' : '添加 KR'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 更新进度 */}
      <Modal
        visible={progressTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setProgressTarget(null)}
      >
        <View className="flex-1 justify-end bg-overlay/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-1 text-lg font-bold">更新进度</Text>
            <Text className="text-muted-foreground mb-3 text-xs" numberOfLines={1}>
              {progressTarget?.title}
              {progressTarget?.unit ? `(${progressTarget.unit})` : ''}
            </Text>
            <TextInput
              className="rounded-lg border px-3 py-3 text-center text-2xl font-bold"
              style={inputStyle}
              value={progressValue}
              onChangeText={setProgressValue}
              keyboardType="decimal-pad"
              accessibilityLabel="当前值"
            />
            <View className="mt-3 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setProgressTarget(null)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void saveProgress()} disabled={busy}>
                <Text>{busy ? '保存中…' : '保存'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
