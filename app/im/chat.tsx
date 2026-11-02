/**
 * IM 聊天页:气泡流 + 输入条 + 3 秒轮询新消息。
 * 对方昵称/头像从路由参数取;发送乐观上屏,轮询同步。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import {
  fetchImMessages, markImRead, sendImMessage, type ImMessage,
} from '@/lib/api/endpoints/im';
import { imRealtime } from '@/lib/capabilities';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { useSession } from '@/store/session';

export default function ImChatScreen() {
  const params = useLocalSearchParams<{ convId: string; peerName?: string }>();
  const convId = params.convId ?? '';
  const peerName = params.peerName ?? '对方';
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const myUserId = useSession((state) => state.user?.id ?? null);

  const [messages, setMessages] = useState<ImMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef<string | null>(null);

  // 初始加载
  useEffect(() => {
    if (!convId) return;
    void (async () => {
      try {
        const msgs = await fetchImMessages(convId);
        setMessages(msgs);
        if (msgs.length > 0) lastIdRef.current = msgs[msgs.length - 1].id;
        await markImRead(convId);
      } catch { /* silent */ }
    })();
  }, [convId]);

  // 增量拉取新消息:轮询与 WS 推送共用同一条追加/去重/标已读路径
  const pollNew = useCallback(async () => {
    try {
      const msgs = await fetchImMessages(convId, lastIdRef.current ?? undefined);
      if (msgs.length > 0) {
        setMessages((prev) => [...prev, ...msgs]);
        lastIdRef.current = msgs[msgs.length - 1].id;
        await markImRead(convId);
      }
    } catch { /* silent */ }
  }, [convId]);

  // 3 秒轮询兜底(WS 不可用/断开时的最终消息来源)
  useEffect(() => {
    if (!convId) return;
    const timer = setInterval(() => void pollNew(), 3000);
    return () => clearInterval(timer);
  }, [convId, pollNew]);

  // WebSocket 实时推送:到达即立刻增量拉取(WS 仅负责提速,不直接改状态)
  useEffect(() => {
    if (!convId) return;
    return imRealtime.subscribe({ conversationId: convId, onPush: () => void pollNew() });
  }, [convId, pollNew]);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft('');
    try {
      const msg = await sendImMessage(convId, content);
      setMessages((prev) => [...prev, msg]);
      lastIdRef.current = msg.id;
    } catch (cause) {
      setDraft(content);
      toast(cause instanceof Error && cause.message ? cause.message : '发送失败,请稍后再试', 'error');
    } finally { setSending(false); }
  }, [convId, draft, sending, toast]);


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
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
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
            onChangeText={setDraft}
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
