/**
 * 灵感便笺:置顶优先、关键词检索、归档与分页编辑。
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
  Pin,
  PinOff,
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
  createNote,
  deleteNote,
  fetchNotes,
  toggleNoteArchive,
  toggleNotePin,
  updateNote,
  type ToolNote,
} from '@/lib/api/endpoints/tools';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const PAGE_SIZE = 20;

function formatTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mergePage(previous: ToolNote[], incoming: ToolNote[]): ToolNote[] {
  const seen = new Set(previous.map((note) => note.id));
  return [...previous, ...incoming.filter((note) => !seen.has(note.id))];
}

export default function NotesScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const [items, setItems] = useState<ToolNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [archived, setArchived] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ToolNote | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);

  const inFlight = useRef(false);
  const itemsRef = useRef<ToolNote[]>([]);
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
        const page = await fetchNotes({
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

  const openEditor = useCallback((note?: ToolNote) => {
    setEditing(note ?? null);
    setDraftTitle(note?.title ?? '');
    setDraftContent(note?.content ?? '');
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (saving) return;
    setEditorOpen(false);
  }, [saving]);

  const save = useCallback(async () => {
    const title = draftTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await updateNote(editing.id, {
          title,
          content: draftContent,
          archived: editing.archived,
          version: editing.version,
        });
      } else {
        await createNote({ title, content: draftContent });
      }
      setEditorOpen(false);
      toast(editing ? '已保存' : '已创建', 'success');
      await load(true);
    } catch {
      toast('保存失败,便笺可能已在其他设备修改', 'error');
    } finally {
      setSaving(false);
    }
  }, [draftContent, draftTitle, editing, load, saving, toast]);

  const flipPin = useCallback(
    async (note: ToolNote) => {
      try {
        await toggleNotePin(note.id);
        await load(true);
      } catch {
        toast('操作失败,请稍后再试', 'error');
      }
    },
    [load, toast],
  );

  const flipArchive = useCallback(
    async (note: ToolNote) => {
      try {
        await toggleNoteArchive(note.id);
        toast(note.archived ? '已恢复' : '已归档', 'success');
        await load(true);
      } catch {
        toast('操作失败,请稍后再试', 'error');
      }
    },
    [load, toast],
  );

  const confirmDelete = useCallback(
    (note: ToolNote) => {
      Alert.alert('删除这张便笺?', note.title, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteNote(note.id);
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

  const renderItem = (note: ToolNote) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`编辑便笺:${note.title}`}
      onPress={() => openEditor(note)}
      onLongPress={() => confirmDelete(note)}
      className="mb-2"
    >
      <Card className="p-3.5">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {note.pinned ? (
            <View className="bg-primary/10 flex-row items-center rounded-full px-2 py-0.5" style={{ gap: 3 }}>
              <Icon as={Pin} size={10} className="text-primary" />
              <Text className="text-primary text-[10px] font-semibold">置顶</Text>
            </View>
          ) : null}
          <Text className="text-foreground flex-1 text-base font-semibold" numberOfLines={1}>
            {note.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={note.pinned ? `取消置顶 ${note.title}` : `置顶 ${note.title}`}
            onPress={() => void flipPin(note)}
            className="p-1"
          >
            <Icon
              as={note.pinned ? PinOff : Pin}
              size={16}
              className={note.pinned ? 'text-primary' : 'text-muted-foreground'}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={note.archived ? `恢复 ${note.title}` : `归档 ${note.title}`}
            onPress={() => void flipArchive(note)}
            className="p-1"
          >
            <Icon
              as={note.archived ? ArchiveRestore : Archive}
              size={16}
              className="text-muted-foreground"
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`删除 ${note.title}`}
            onPress={() => confirmDelete(note)}
            className="p-1"
          >
            <Icon as={Trash2} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
        {note.content ? (
          <Text className="text-muted-foreground mt-1.5 text-sm leading-5" numberOfLines={3}>
            {note.content}
          </Text>
        ) : null}
        <Text className="text-muted-foreground/70 mt-2 text-[10px]">
          {note.archived ? '已归档 · ' : ''}
          {formatTime(note.updateTime || note.createTime)}
        </Text>
      </Card>
    </Pressable>
  );

  if (!signedIn) {
    return (
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
        <EmptyState illustration="signin"
          title="登录后使用灵感便笺"
          description="随手记录,云端同步,换设备不丢"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/notes', from: 'notes' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
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
          <View className="mb-3 mt-2">
            <Text className="text-muted-foreground text-sm">
              {archived ? `归档 ${total} 条` : `${total} 条便笺 · 置顶优先`}
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
                placeholder="搜索标题或正文"
                placeholderTextColor={token('muted-foreground', scheme)}
                returnKeyType="search"
                accessibilityLabel="搜索便笺"
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
                  便笺
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
            <EmptyState illustration="list"
              title={archived ? '归档是空的' : keyword ? '没有匹配的便笺' : '还没有便笺'}
              description={archived ? '归档的便笺会出现在这里' : '点右下角开始记录灵感'}
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
        renderItem={({ item }) => renderItem(item)}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="新建便笺"
        onPress={() => openEditor()}
        className="bg-primary absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full"
      >
        <Icon as={Plus} size={26} className="text-primary-foreground" />
      </Pressable>

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={closeEditor}>
        <KeyboardAvoidingView behavior="height" className="flex-1 justify-end bg-overlay/40">
          <View className="bg-background max-h-[85%] rounded-t-2xl px-4 pb-6 pt-4">
            <View className="mb-3 flex-row items-center">
              <Text className="flex-1 text-lg font-bold">{editing ? '编辑便笺' : '新建便笺'}</Text>
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
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="标题"
              placeholderTextColor={token('muted-foreground', scheme)}
              maxLength={100}
              accessibilityLabel="便笺标题"
            />
            <TextInput
              className="border-border text-foreground mt-2 rounded-xl border px-3 py-2.5 text-sm"
              style={{ color: token('foreground', scheme), minHeight: 160, textAlignVertical: 'top' }}
              value={draftContent}
              onChangeText={setDraftContent}
              placeholder="正文(可选)"
              placeholderTextColor={token('muted-foreground', scheme)}
              maxLength={10000}
              multiline
              accessibilityLabel="便笺正文"
            />
            <View className="mt-3 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={closeEditor} disabled={saving}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void save()} disabled={!draftTitle.trim() || saving}>
                <Text>{saving ? '保存中…' : '保存'}</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
