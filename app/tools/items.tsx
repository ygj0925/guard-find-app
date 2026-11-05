/**
 * 物品收纳:按位置分组、关键词检索、数量调整、归档与分页编辑。
 * 云端按用户隔离;修改携带 version,冲突时提示刷新,避免静默覆盖。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Archive,
  ArchiveRestore,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/business/feedback';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  changeItemQuantity,
  createItem,
  deleteItem,
  fetchItems,
  toggleItemArchive,
  updateItem,
  type ToolItem,
} from '@/lib/api/endpoints/tools';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const PAGE_SIZE = 20;
const MAX_QUANTITY = 999999;

function locationLabel(item: ToolItem): string {
  return item.location.trim() || '未分类';
}

function mergePage(previous: ToolItem[], incoming: ToolItem[]): ToolItem[] {
  const seen = new Set(previous.map((item) => item.id));
  return [...previous, ...incoming.filter((item) => !seen.has(item.id))];
}

function parseQuantity(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(MAX_QUANTITY, parsed);
}

export default function ItemsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const [items, setItems] = useState<ToolItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [archived, setArchived] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ToolItem | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftQuantity, setDraftQuantity] = useState('1');
  const [draftNote, setDraftNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const inFlight = useRef(false);
  const itemsRef = useRef<ToolItem[]>([]);
  const totalRef = useRef(0);
  const pageRef = useRef(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const load = useCallback(
    async (reset: boolean) => {
      if (!signedIn || inFlight.current) return;
      if (!reset && itemsRef.current.length >= totalRef.current) return;
      inFlight.current = true;
      setLoading(true);
      if (reset) {
        setError(null);
        setInitial(true);
      }
      try {
        const target = reset ? 1 : pageRef.current + 1;
        const page = await fetchItems({
          page: target,
          size: PAGE_SIZE,
          keyword: debounced || undefined,
          archived,
        });
        const next = reset ? page.list : mergePage(itemsRef.current, page.list);
        pageRef.current = target;
        itemsRef.current = next;
        totalRef.current = page.total;
        setItems(next);
        setTotal(page.total);
      } catch (reason) {
        if (reset) setError(reason);
        else toast('加载更多失败,请稍后再试', 'error');
      } finally {
        inFlight.current = false;
        setLoading(false);
        setInitial(false);
      }
    },
    [archived, debounced, signedIn, toast],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (signedIn) {
        void load(true);
        return;
      }
      itemsRef.current = [];
      totalRef.current = 0;
      pageRef.current = 1;
      setItems([]);
      setTotal(0);
      setInitial(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [load, signedIn]);

  const reload = useCallback(() => {
    void load(true);
  }, [load]);

  const openEditor = useCallback((item?: ToolItem) => {
    setEditing(item ?? null);
    setDraftName(item?.name ?? '');
    setDraftLocation(item?.location ?? '');
    setDraftQuantity(String(item?.quantity ?? 1));
    setDraftNote(item?.note ?? '');
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (saving) return;
    setEditorOpen(false);
  }, [saving]);

  const save = useCallback(async () => {
    const name = draftName.trim();
    if (!name || saving) return;
    const quantity = parseQuantity(draftQuantity);
    setSaving(true);
    try {
      if (editing) {
        await updateItem(editing.id, {
          name,
          location: draftLocation,
          quantity,
          note: draftNote,
          archived: editing.archived,
          version: editing.version,
        });
      } else {
        await createItem({ name, location: draftLocation, quantity, note: draftNote });
      }
      setEditorOpen(false);
      toast(editing ? '已保存' : '已添加', 'success');
      await load(true);
    } catch {
      toast('保存失败,物品可能已在其他设备修改', 'error');
    } finally {
      setSaving(false);
    }
  }, [draftLocation, draftName, draftNote, draftQuantity, editing, load, saving, toast]);

  const adjustQuantity = useCallback(
    async (item: ToolItem, delta: number) => {
      if (adjustingId) return;
      const next = item.quantity + delta;
      if (next < 0 || next > MAX_QUANTITY) return;
      setAdjustingId(item.id);
      const optimistic = itemsRef.current.map((row) =>
        row.id === item.id ? { ...row, quantity: next, version: row.version + 1 } : row,
      );
      itemsRef.current = optimistic;
      setItems(optimistic);
      try {
        await changeItemQuantity(item.id, delta);
      } catch {
        toast('数量已变化,请刷新后重试', 'error');
        await load(true);
      } finally {
        setAdjustingId(null);
      }
    },
    [adjustingId, load, toast],
  );

  const flipArchive = useCallback(
    async (item: ToolItem) => {
      try {
        await toggleItemArchive(item.id);
        toast(item.archived ? '已恢复' : '已归档', 'success');
        await load(true);
      } catch {
        toast('操作失败,请稍后再试', 'error');
      }
    },
    [load, toast],
  );

  const confirmDelete = useCallback(
    (item: ToolItem) => {
      Alert.alert('删除这件物品?', item.name, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteItem(item.id);
                toast('已删除');
                await load(true);
              } catch {
                toast('删除失败,请稍后再试', 'error');
              }
            })();
          },
        },
      ]);
    },
    [load, toast],
  );

  const renderItem = (item: ToolItem, index: number) => {
    const previous = index > 0 ? items[index - 1] : null;
    const showGroup = !previous || locationLabel(previous) !== locationLabel(item);
    return (
      <View>
        {showGroup ? (
          <View className="mb-1.5 mt-3 flex-row items-center" style={{ gap: 4 }}>
            <Icon as={MapPin} size={12} className="text-muted-foreground" />
            <Text className="text-muted-foreground text-xs font-semibold">{locationLabel(item)}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`编辑物品:${item.name}`}
          onPress={() => openEditor(item)}
          onLongPress={() => confirmDelete(item)}
          className="mb-2"
        >
          <Card className="p-3.5">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <View className="flex-1">
                <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                  {item.name}
                </Text>
                {item.note ? (
                  <Text className="text-muted-foreground mt-1 text-sm leading-5" numberOfLines={2}>
                    {item.note}
                  </Text>
                ) : null}
                <Text className="text-muted-foreground/70 mt-1.5 text-[10px]">
                  {item.archived ? '已归档 · ' : ''}
                  {locationLabel(item)}
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} 数量减一`}
                  accessibilityState={{ disabled: item.quantity <= 0 || adjustingId === item.id }}
                  disabled={item.quantity <= 0 || adjustingId === item.id}
                  onPress={() => void adjustQuantity(item, -1)}
                  className={`bg-muted h-8 w-8 items-center justify-center rounded-full ${
                    item.quantity <= 0 ? 'opacity-40' : ''
                  }`}
                >
                  <Icon as={Minus} size={14} className="text-foreground" />
                </Pressable>
                <Text className="text-foreground min-w-[28px] text-center text-sm font-semibold">
                  {item.quantity}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} 数量加一`}
                  accessibilityState={{ disabled: adjustingId === item.id }}
                  disabled={adjustingId === item.id || item.quantity >= MAX_QUANTITY}
                  onPress={() => void adjustQuantity(item, 1)}
                  className="bg-muted h-8 w-8 items-center justify-center rounded-full"
                >
                  <Icon as={Plus} size={14} className="text-foreground" />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.archived ? `恢复 ${item.name}` : `归档 ${item.name}`}
                onPress={() => void flipArchive(item)}
                className="p-1"
              >
                <Icon
                  as={item.archived ? ArchiveRestore : Archive}
                  size={16}
                  className="text-muted-foreground"
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`删除 ${item.name}`}
                onPress={() => confirmDelete(item)}
                className="p-1"
              >
                <Icon as={Trash2} size={16} className="text-muted-foreground" />
              </Pressable>
            </View>
          </Card>
        </Pressable>
      </View>
    );
  };

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用物品收纳"
          description="记下东西放在哪,云端同步,换设备也能找"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/items', from: 'items' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={initial ? false : loading}
            onRefresh={() => {
              void load(true);
            }}
          />
        }
        onEndReached={() => {
          if (!loading && items.length < total) void load(false);
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View className="mb-1 mt-2">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Icon as={Package} size={22} className="text-primary" />
              <Text className="text-2xl font-bold">物品收纳</Text>
            </View>
            <Text className="text-muted-foreground mt-1 text-sm">
              {archived ? `归档 ${total} 件` : `${total} 件物品 · 按位置归类`}
            </Text>

            <View
              className="border-border bg-card mt-3 flex-row items-center rounded-full border px-3"
              style={{ gap: 6 }}
            >
              <Icon as={Search} size={16} className="text-muted-foreground" />
              <TextInput
                className="text-foreground flex-1 py-2 text-sm"
                style={{ color: token('foreground', scheme) }}
                value={keyword}
                onChangeText={setKeyword}
                placeholder="搜索名称、位置或备注"
                placeholderTextColor={token('muted-foreground', scheme)}
                returnKeyType="search"
                accessibilityLabel="搜索物品"
              />
              {keyword ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="清空搜索"
                  onPress={() => setKeyword('')}
                  className="p-1"
                >
                  <Icon as={X} size={14} className="text-muted-foreground" />
                </Pressable>
              ) : null}
            </View>

            <View className="mt-3 flex-row" style={{ gap: 8 }}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: !archived }}
                onPress={() => setArchived(false)}
                className={`rounded-full px-3 py-1.5 ${!archived ? 'bg-primary' : 'bg-muted'}`}
              >
                <Text className={`text-xs font-semibold ${!archived ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                  在用
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: archived }}
                onPress={() => setArchived(true)}
                className={`rounded-full px-3 py-1.5 ${archived ? 'bg-primary' : 'bg-muted'}`}
              >
                <Text className={`text-xs font-semibold ${archived ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                  归档
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          initial ? (
            <SkeletonList rows={4} />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <EmptyState
              title={archived ? '归档是空的' : keyword ? '没有匹配的物品' : '还没有物品'}
              description={archived ? '归档的物品会出现在这里' : '点右下角记下第一件物品'}
            />
          )
        }
        ListFooterComponent={
          items.length > 0 && items.length < total ? (
            <Text className="text-muted-foreground py-3 text-center text-xs">
              {loading ? '加载中…' : '继续下滑加载更多'}
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => renderItem(item, index)}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="新增物品"
        onPress={() => openEditor()}
        className="bg-primary absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full"
      >
        <Icon as={Plus} size={26} className="text-primary-foreground" />
      </Pressable>

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={closeEditor}>
        <KeyboardAvoidingView behavior="height" className="flex-1 justify-end bg-overlay/40">
          <View className="bg-background max-h-[85%] rounded-t-2xl px-4 pb-6 pt-4">
            <View className="mb-3 flex-row items-center">
              <Text className="flex-1 text-lg font-bold">{editing ? '编辑物品' : '新增物品'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭编辑"
                onPress={closeEditor}
                className="p-1"
              >
                <Icon as={X} size={20} className="text-muted-foreground" />
              </Pressable>
            </View>
            <TextInput
              className="border-border text-foreground rounded-xl border px-3 py-2.5 text-base font-semibold"
              style={{ color: token('foreground', scheme) }}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="物品名称"
              placeholderTextColor={token('muted-foreground', scheme)}
              maxLength={100}
              accessibilityLabel="物品名称"
            />
            <View className="mt-2 flex-row" style={{ gap: 8 }}>
              <TextInput
                className="border-border text-foreground flex-1 rounded-xl border px-3 py-2.5 text-sm"
                style={{ color: token('foreground', scheme) }}
                value={draftLocation}
                onChangeText={setDraftLocation}
                placeholder="存放位置,如:冰箱"
                placeholderTextColor={token('muted-foreground', scheme)}
                maxLength={100}
                accessibilityLabel="存放位置"
              />
              <TextInput
                className="border-border text-foreground w-24 rounded-xl border px-3 py-2.5 text-sm"
                style={{ color: token('foreground', scheme) }}
                value={draftQuantity}
                onChangeText={setDraftQuantity}
                placeholder="数量"
                placeholderTextColor={token('muted-foreground', scheme)}
                keyboardType="number-pad"
                maxLength={6}
                accessibilityLabel="数量"
              />
            </View>
            <TextInput
              className="border-border text-foreground mt-2 rounded-xl border px-3 py-2.5 text-sm"
              style={{ color: token('foreground', scheme), minHeight: 96, textAlignVertical: 'top' }}
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder="备注(可选)"
              placeholderTextColor={token('muted-foreground', scheme)}
              maxLength={500}
              multiline
              accessibilityLabel="物品备注"
            />
            <View className="mt-3 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={closeEditor} disabled={saving}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void save()} disabled={!draftName.trim() || saving}>
                <Text>{saving ? '保存中…' : '保存'}</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
