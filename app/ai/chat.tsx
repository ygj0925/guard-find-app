/**
 * AI 对话 · 聊天页:气泡流 + 输入条 + 预设快捷语。
 * 一期非流式:发送后显示"对方正在输入",回包后渲染完整回复;
 * 乐观气泡先上屏,失败时移除并 Toast。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpCircle, Bot } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, SectionCard } from '@/components/business/feedback';
import {
  fetchAiMessages,
  sendAiMessage,
} from '@/lib/api/endpoints/ai';
import { AI_PRESETS, buildBubbleRows, pendingBubbleKey, type AiBubbleRow } from '@/lib/ai/helpers';
import { useRequest } from '@/hooks/useRequest';
import { useToast } from '@/providers/ToastProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

export default function AiChatScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';

  const [rows, setRows] = useState<AiBubbleRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const query = useRequest(() => fetchAiMessages(conversationId), [conversationId], {
    onData: (messages) => setRows(buildBubbleRows(messages ?? [])),
  });

  useEffect(() => {
    if (!conversationId) router.back();
  }, [conversationId, router]);

  const listData = useMemo(() => {
    if (!sending) return rows;
    return [
      ...rows,
      { key: pendingBubbleKey(), role: 'assistant' as const, content: '对方正在输入…' },
    ];
  }, [rows, sending]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      setSending(true);
      setDraft('');
      try {
        const resp = await sendAiMessage(conversationId, content);
        setRows((prev) => [
          ...prev,
          { key: `local:${Date.now()}`, role: 'user', content },
          { key: `m:${resp.reply.id}`, role: 'assistant', content: resp.reply.content },
        ]);
      } catch (cause) {
        setDraft(content);
        toast(cause instanceof Error && cause.message ? cause.message : '发送失败,请稍后再试', 'error');
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, toast],
  );

  const messages = query.data;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior="height">
        <FlatList
          data={listData}
          keyExtractor={(row) => row.key}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 16 }}
          ListHeaderComponent={
            messages === null && query.isInitialLoading ? (
              <SectionCard title="加载会话…">{null}</SectionCard>
            ) : query.error ? (
              <ErrorState error={query.error} onRetry={() => void query.reload()} />
            ) : messages?.length === 0 ? (
              <View className="mb-3">
                <EmptyState
                  title="开始对话吧"
                  description="试试下面的快捷指令,或直接输入问题"
                />
                <View className="flex-row flex-wrap justify-center">
                  {AI_PRESETS.map((preset) => (
                    <Pressable
                      key={preset.key}
                      accessibilityRole="button"
                      accessibilityLabel={preset.label}
                      onPress={() => setDraft(preset.prompt)}
                      className="bg-accent mr-2 mb-2 rounded-full px-3 py-1.5"
                    >
                      <Text className="text-accent-foreground text-xs font-medium">{preset.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => <Bubble row={item} scheme={scheme} />}
        />

        <View className="border-border border-t px-4 py-2">
          <View className="flex-row items-end" style={{ gap: 8 }}>
            <TextInput
              className="border-border text-foreground flex-1 rounded-2xl border px-3 py-2 text-sm"
              style={{ color: token('foreground', scheme), maxHeight: 96 }}
              value={draft}
              onChangeText={setDraft}
              placeholder="输入消息…"
              placeholderTextColor={token('muted-foreground', scheme)}
              multiline
              accessibilityLabel="消息输入框"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="发送"
              onPress={() => void send(draft)}
              disabled={sending || !draft.trim()}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: draft.trim() && !sending
                  ? token('primary', scheme)
                  : token('muted', scheme),
              }}
            >
              <Icon
                as={ArrowUpCircle}
                size={22}
                className={draft.trim() && !sending ? 'text-primary-foreground' : 'text-muted-foreground'}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** 单个气泡:用户右对齐主色底,助手左对齐卡片底。 */
function Bubble({ row, scheme }: { row: AiBubbleRow; scheme: 'light' | 'dark' }) {
  const isUser = row.role === 'user';
  return (
    <View className={`mb-2 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <View
          className="mt-1 h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: token('accent', scheme) }}
        >
          <Icon as={Bot} size={14} className="text-accent-foreground" />
        </View>
      ) : null}
      <View
        className="mx-1 max-w-[78%] rounded-2xl px-3 py-2"
        style={{
          backgroundColor: isUser ? token('primary', scheme) : token('card', scheme),
          borderWidth: isUser ? 0 : 1,
          borderColor: token('border', scheme),
        }}
      >
        <Text
          className={`text-sm leading-5 ${isUser ? 'text-primary-foreground' : 'text-foreground'}`}
        >
          {row.content}
        </Text>
      </View>
    </View>
  );
}
