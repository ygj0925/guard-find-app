/**
 * 待办清单:未完成在前(截止日升序)、已完成在后,勾选即翻转。
 * 新增走底部输入条(服务端字段少,不值得独立表单页);长按删除。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle2, Circle, Plus, Sparkles, Trash2 } from 'lucide-react-native';

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
  createTodo,
  deleteTodo,
  fetchTodos,
  toggleTodo,
  type ToolTodo,
} from '@/lib/api/endpoints/tools';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';
import { requestAiDecompose } from '@/lib/api/endpoints/ai';

export default function TodoScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const query = useRequest(() => fetchTodos(), [signedIn]);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  // AI 拆解:目标待办 + 拆出的子步骤勾选集
  const [decomposeTarget, setDecomposeTarget] = useState<ToolTodo | null>(null);
  const [decomposeSteps, setDecomposeSteps] = useState<string[]>([]);
  const [pickedSteps, setPickedSteps] = useState<Set<number>>(new Set());
  const [decomposing, setDecomposing] = useState(false);
  const [addingSteps, setAddingSteps] = useState(false);

  const openDecompose = useCallback(
    async (record: ToolTodo) => {
      if (decomposing) return;
      setDecomposeTarget(record);
      setDecomposeSteps([]);
      setPickedSteps(new Set());
      setDecomposing(true);
      try {
        const resp = await requestAiDecompose(record.title);
        setDecomposeSteps(resp.text.split('\n').map((line) => line.trim()).filter(Boolean));
      } catch {
        setDecomposeTarget(null);
        toast('AI 拆解失败,请稍后再试', 'error');
      } finally {
        setDecomposing(false);
      }
    },
    [decomposing, toast],
  );

  const addPickedSteps = useCallback(async () => {
    if (!decomposeTarget || addingSteps) return;
    const picked = decomposeSteps.filter((_, index) => pickedSteps.has(index));
    if (picked.length === 0) return;
    setAddingSteps(true);
    try {
      for (const step of picked) {
        await createTodo({ title: step });
      }
      toast(`已添加 ${picked.length} 条子待办`, 'success');
      setDecomposeTarget(null);
      await query.reload();
    } catch {
      toast('添加失败,请稍后再试', 'error');
    } finally {
      setAddingSteps(false);
    }
  }, [addingSteps, decomposeSteps, decomposeTarget, pickedSteps, query, toast]);

  const records = useMemo(() => query.data ?? [], [query.data]);
  const pending = useMemo(() => records.filter((item) => !item.done), [records]);
  const finished = useMemo(() => records.filter((item) => item.done), [records]);

  const add = useCallback(async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await createTodo({ title });
      setDraft('');
      await query.reload();
    } catch {
      toast('添加失败,请稍后再试', 'error');
    } finally {
      setAdding(false);
    }
  }, [draft, adding, query, toast]);

  const flip = useCallback(
    async (record: ToolTodo) => {
      // 乐观翻转:先改本地,失败回滚
      const next = !record.done;
      query.setData(
        records.map((item) => (item.id === record.id ? { ...item, done: next } : item)) as typeof records,
      );
      try {
        await toggleTodo(record.id);
      } catch {
        query.setData(records);
        toast('操作失败,请稍后再试', 'error');
      }
    },
    [query, records, toast],
  );

  const confirmDelete = useCallback(
    (record: ToolTodo) => {
      Alert.alert('删除这条待办?', record.title, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteTodo(record.id);
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

  const renderItem = (record: ToolTodo) => (
    <View className="mb-1.5 flex-row items-center">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={record.done ? { checked: true } : { checked: false }}
        accessibilityLabel={`${record.done ? '标记未完成' : '标记完成'}:${record.title}`}
        onPress={() => void flip(record)}
        className="p-1"
      >
        <Icon
          as={record.done ? CheckCircle2 : Circle}
          size={22}
          className={record.done ? 'text-found' : 'text-muted-foreground'}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`待办:${record.title}`}
        onLongPress={() => confirmDelete(record)}
        className="flex-1"
      >
        <Card className="flex-1 flex-row items-center justify-between p-3">
          <View className="flex-1">
            <Text
              className={`text-sm ${record.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
            >
              {record.title}
            </Text>
            {record.dueDate ? (
              <Text
                className={`mt-0.5 text-xs ${
                  !record.done && record.dueDate < new Date().toISOString().slice(0, 10)
                    ? 'text-urgent'
                    : 'text-muted-foreground'
                }`}
              >
                截止 {record.dueDate}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`AI 拆解:${record.title}`}
            onPress={() => void openDecompose(record)}
            className="p-1"
          >
            <Icon as={Sparkles} size={15} className={record.done ? 'text-muted-foreground/40' : 'text-primary'} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`删除 ${record.title}`}
            onPress={() => confirmDelete(record)}
            className="p-1"
          >
            <Icon as={Trash2} size={15} className="text-muted-foreground" />
          </Pressable>
        </Card>
      </Pressable>
    </View>
  );

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用待办清单"
          description="待办云端同步,换设备不丢"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/todo', from: 'todo' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={[...pending, ...finished]}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={RefreshingControl(query.status === 'loading', () => void query.reload())}
        ListHeaderComponent={
          <View className="mb-4 mt-2">
            <Text className="text-2xl font-bold">待办清单</Text>
            <Text className="text-muted-foreground mt-1 text-sm">
              {pending.length} 项待办 · {finished.length} 项已完成
            </Text>
          </View>
        }
        ListEmptyComponent={
          query.isInitialLoading ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => void query.reload()} />
          ) : (
            <EmptyState title="清单是空的" description="在下方输入框写下第一件事" />
          )
        }
        ListFooterComponent={
          pending.length > 0 && finished.length > 0 ? (
            <View className="mt-2 mb-1 flex-row items-center px-1">
              <Text className="text-muted-foreground text-xs font-semibold">已完成</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => renderItem(item)}
      />

      {/* AI 拆解弹层:勾选子步骤批量添加 */}
      <Modal visible={decomposeTarget !== null} transparent animationType="slide" onRequestClose={() => setDecomposeTarget(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-1 text-lg font-bold">AI 拆解</Text>
            <Text className="text-muted-foreground mb-3 text-xs" numberOfLines={2}>
              {decomposeTarget?.title}
            </Text>
            {decomposeSteps.length === 0 ? (
              <Text className="text-muted-foreground py-6 text-center text-sm">正在拆解…</Text>
            ) : (
              <View className="mb-2" style={{ gap: 8 }}>
                {decomposeSteps.map((step, index) => (
                  <Pressable
                    key={step}
                    accessibilityRole="checkbox"
                    accessibilityState={pickedSteps.has(index) ? { checked: true } : { checked: false }}
                    accessibilityLabel={`选择步骤:${step}`}
                    onPress={() =>
                      setPickedSteps((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                    className="flex-row items-center"
                    style={{ gap: 8 }}
                  >
                    <Icon
                      as={pickedSteps.has(index) ? CheckCircle2 : Circle}
                      size={20}
                      className={pickedSteps.has(index) ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <Text className="text-foreground flex-1 text-sm">{step}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setDecomposeTarget(null)}>
                <Text>取消</Text>
              </Button>
              <Button
                className="flex-1"
                onPress={() => void addPickedSteps()}
                disabled={pickedSteps.size === 0 || addingSteps}
              >
                <Text>{addingSteps ? '添加中…' : `添加选中(${pickedSteps.size})`}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 底部输入条:键盘上方固定 */}
      <View
        className="border-border flex-row items-center px-4 pb-4 pt-2"
        style={{
          borderTopWidth: 1,
          backgroundColor: token('background', scheme),
          gap: 8,
        }}
      >
        <TextInput
          className="border-border text-foreground flex-1 rounded-full border px-4 py-2 text-sm"
          style={{ color: token('foreground', scheme) }}
          value={draft}
          onChangeText={setDraft}
          placeholder="添加待办,回车确认"
          placeholderTextColor={token('muted-foreground', scheme)}
          onSubmitEditing={() => void add()}
          returnKeyType="done"
          accessibilityLabel="待办内容输入框"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="添加待办"
          onPress={() => void add()}
          disabled={!draft.trim() || adding}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: draft.trim() && !adding ? token('primary', scheme) : token('muted', scheme),
          }}
        >
          <Icon
            as={Plus}
            size={20}
            className={draft.trim() && !adding ? 'text-primary-foreground' : 'text-muted-foreground'}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
