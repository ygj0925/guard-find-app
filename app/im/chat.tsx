/**
 * IM 聊天页:气泡流 + 输入条 + 3 秒轮询新消息 + WS 实时推送。
 * 三种入口:带 convId(会话列表)、仅带 peerId(房源详情,进入即建会话)、mode=support(联系客服)。
 *
 * 同步规则集中在 lib/im/chat-sync:读请求单飞、消息按 ID 去重、发送不推进读游标;
 * 本页只负责“可见且在前台”的生命周期与 UI 状态。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import {
  fetchImMessages, fetchSupportMessages, getOrCreateConversation, markImRead, sendImMessage, sendSupportMessage,
  type ImMessage,
} from '@/lib/api/endpoints/im';
import { imRealtime } from '@/lib/capabilities';
import { createChatSync } from '@/lib/im/chat-sync';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { useSession } from '@/store/session';

export default function ImChatScreen() {
  const params = useLocalSearchParams<{ convId: string; peerId?: string; peerName?: string; mode?: string }>();
  const paramConvId = params.convId ?? '';
  const peerId = params.peerId ?? '';
  const isSupport = params.mode === 'support';
  const peerName = params.peerName ?? (isSupport ? '官方客服' : '对方');
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const sessionToken = useSession((state) => state.token ?? '');
  const myUserId = useSession((state) => state.user?.id ?? null);

  const [convId, setConvId] = useState(isSupport ? 'support' : paramConvId);
  const [messages, setMessages] = useState<ImMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSendingState] = useState(false);

  const convIdRef = useRef(convId);
  const tokenRef = useRef(sessionToken);
  const draftRef = useRef('');
  const sendingRef = useRef(false);
  const focusedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const toastRef = useRef(toast);
  const [sync, setSync] = useState<ReturnType<typeof createChatSync> | null>(null);

  useEffect(() => {
    convIdRef.current = convId;
  }, [convId]);
  useEffect(() => {
    tokenRef.current = sessionToken;
  }, [sessionToken]);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const setSending = useCallback((value: boolean) => {
    sendingRef.current = value;
    setSendingState(value);
  }, []);

  // 控制器只在挂载时创建一次(持有读游标),回调通过 ref 读取最新身份与可见状态。
  useEffect(() => {
    const controller = createChatSync({
      isSupport,
      conversationId: () => convIdRef.current,
      token: () => tokenRef.current,
      isActive: () => focusedRef.current && appStateRef.current === 'active',
      read: (id, afterId) => isSupport ? fetchSupportMessages(afterId) : fetchImMessages(id, afterId),
      send: (id, content) => isSupport ? sendSupportMessage(content) : sendImMessage(id, content),
      markRead: async (id) => { await markImRead(id); },
      subscribe: (id, refresh) => imRealtime.subscribe({
        conversationId: isSupport ? 'support' : id,
        onPush: refresh,
      }),
      setMessages,
      setSending,
      onError: (message) => toastRef.current(message, 'error'),
    });
    setSync(controller);
    return () => controller.deactivate();
  }, [isSupport, setSending]);

  // 仅带 peerId 进入(房源详情"发私信聊"):先建会话再加载
  useEffect(() => {
    if (isSupport || convId || !peerId) return;
    void (async () => {
      try {
        const conv = await getOrCreateConversation(peerId);
        setConvId(conv.id);
      } catch {
        toast('建立会话失败,请稍后再试', 'error');
      }
    })();
  }, [isSupport, convId, peerId, toast]);

  // 身份或会话变化:清空旧消息,再按当前可见状态决定是否立即读取。
  useEffect(() => {
    if (!sync) return;
    if (!sessionToken || !convId) {
      sync.reset();
      return;
    }
    sync.setIdentity(sessionToken, convId);
    if (focusedRef.current && appStateRef.current === 'active') sync.activate();
  }, [sync, sessionToken, convId]);

  // 页面可见:订阅推送 + 首次全量读取;离开页面立即停读并退订。
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (sync && tokenRef.current && convIdRef.current && appStateRef.current === 'active') {
        sync.setIdentity(tokenRef.current, convIdRef.current);
        sync.activate();
      }
      return () => {
        focusedRef.current = false;
        sync?.deactivate();
      };
    }, [sync]),
  );

  // 前后台切换:后台不读不订,回到前台重建订阅并补拉。
  useEffect(() => {
    if (!sync) return;
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = appStateRef.current;
      appStateRef.current = next;
      if (!focusedRef.current) return;
      if (next === 'active') {
        if (previous !== 'active' && tokenRef.current && convIdRef.current) {
          sync.setIdentity(tokenRef.current, convIdRef.current);
          sync.activate();
        }
        return;
      }
      sync.deactivate();
    });
    return () => subscription.remove();
  }, [sync]);

  // 3 秒轮询兜底(WS 不可用/断开时的最终消息来源);refresh 自带单飞去重。
  useEffect(() => {
    if (!sync) return;
    const timer = setInterval(() => sync.refresh(), 3000);
    return () => clearInterval(timer);
  }, [sync]);

  const updateDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraft(value);
  }, []);

  const send = useCallback(async () => {
    if (!sync) return;
    const content = draftRef.current.trim();
    if (!content || sendingRef.current || !convIdRef.current) return;
    updateDraft('');
    const sent = await sync.send(content);
    // 失败且用户尚未输入新内容时恢复原文,避免覆盖正在输入的新草稿。
    if (!sent && !draftRef.current) {
      updateDraft(content);
    }
  }, [sync, updateDraft]);

  const renderItem = useCallback(({ item }: { item: ImMessage }) => {
    const fromPeer = item.senderId.toString() !== myUserId?.toString();
    return (
      <View className={`mb-2 flex-row px-4 ${fromPeer ? 'justify-start' : 'justify-end'}`}>
        <View
          className="max-w-[78%] rounded-2xl px-3 py-2"
          style={{
            backgroundColor: fromPeer ? token('card', scheme) : token('primary', scheme),
            borderWidth: fromPeer ? 1 : 0,
            borderColor: token('border', scheme),
          }}
        >
          <Text
            className={`text-sm leading-5 ${fromPeer ? 'text-foreground' : 'text-primary-foreground'}`}
            selectable
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  }, [myUserId, scheme]);

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <Stack.Screen options={{ title: peerName }} />
      <KeyboardAvoidingView className="flex-1" behavior="height">
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16, paddingTop: 8 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Text className="text-muted-foreground text-sm">还没有消息,说点什么吧</Text>
            </View>
          }
        />

        <View
          className="border-border flex-row items-center px-4 pb-4 pt-2"
          style={{ borderTopWidth: 1, backgroundColor: token('background', scheme), gap: 8 }}
        >
          <TextInput
            className="border-border text-foreground flex-1 rounded-full border px-4 py-2 text-sm"
            style={{ color: token('foreground', scheme) }}
            value={draft}
            onChangeText={updateDraft}
            placeholder={`回复 ${peerName}…`}
            placeholderTextColor={token('muted-foreground', scheme)}
            accessibilityLabel="消息输入框"
            multiline
            onSubmitEditing={() => void send()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送消息"
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: draft.trim() && !sending ? token('primary', scheme) : token('muted', scheme),
            }}
          >
            <Text
              className={`text-xs font-bold ${draft.trim() && !sending ? 'text-primary-foreground' : 'text-muted-foreground'}`}
            >
              发送
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
