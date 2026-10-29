/**
 * 月报阅读/填报/评论。
 * 我自己的月报:可编辑提交(草稿/提交);他人已提交:只读+评论回复(楼中楼)。
 * 草稿仅本人可读(服务端强制)。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState, ErrorState } from '@/components/business/feedback';
import {
  createReportComment,
  fetchReportComments,
  fetchReportEntry,
  saveReportEntry,
  type ReportComment,
} from '@/lib/api/endpoints/report';
import { relativeTime } from '@/app/(tabs)/community';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';

export default function ReportEntryScreen() {
  const params = useLocalSearchParams<{ id: string; userId: string }>();
  const activityId = params.id ?? '';
  const entryUserId = params.userId ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const myUserId = useSession((state) => state.user?.id ?? null);

  const query = useRequest(() => fetchReportEntry(activityId, entryUserId), [activityId, entryUserId, signedIn]);
  const commentsQuery = useRequest(() => fetchReportComments(activityId, entryUserId), [
    activityId,
    entryUserId,
    signedIn,
  ]);
  const comments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);

  const isMine = myUserId === entryUserId;
  const entry = query.data;
  const canEdit = isMine;
  const canComment = signedIn && !!entry?.content;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState<null | 'draft' | 'submit'>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ commentId: string; nickname: string } | null>(null);
  const [sending, setSending] = useState(false);

  const startEdit = useCallback(() => {
    setDraft(entry?.content ?? '');
    setEditing(true);
  }, [entry]);

  const save = useCallback(
    async (submit: boolean) => {
      if (saving || !draft.trim()) {
        toast('正文不能为空', 'warn');
        return;
      }
      setSaving(submit ? 'submit' : 'draft');
      try {
        await saveReportEntry(activityId, draft.trim(), submit);
        toast(submit ? '已提交,全员可读' : '草稿已保存', 'success');
        setEditing(false);
        await query.reload();
      } catch (cause) {
        toast(cause instanceof Error && cause.message ? cause.message : '保存失败,请稍后再试', 'error');
      } finally {
        setSaving(null);
      }
    },
    [activityId, draft, query, saving, toast],
  );

  const sendComment = useCallback(async () => {
    const content = commentDraft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await createReportComment(activityId, entryUserId, content, replyTo?.commentId);
      setCommentDraft('');
      setReplyTo(null);
      toast('评论已发表', 'success');
      await commentsQuery.reload();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '评论失败,请稍后再试', 'error');
    } finally {
      setSending(false);
    }
  }, [activityId, commentsQuery, commentDraft, entryUserId, replyTo, sending, toast]);

  const renderComment = useCallback(
    ({ item }: { item: ReportComment }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`回复 ${item.nickname ?? '用户'} 的评论`}
        onLongPress={() => setReplyTo({ commentId: item.id, nickname: item.nickname ?? '用户' })}
        className="mb-3 flex-row px-4"
      >
        <Avatar alt={item.nickname ?? '用户'} className="size-8">
          {item.avatar ? <AvatarImage source={{ uri: item.avatar }} /> : null}
          <AvatarFallback>
            <Text>{(item.nickname ?? '用').slice(0, 1)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="ml-2 flex-1">
          <Text className="text-muted-foreground text-xs">
            {item.nickname ?? '用户'}
            {item.replyToUserId ? ' · 回复了评论' : ''} · {relativeTime(item.createTime)}
          </Text>
          <Text className="text-foreground mt-0.5 text-sm leading-5">{item.content}</Text>
        </View>
      </Pressable>
    ),
    [],
  );

  if (query.error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ErrorState error={query.error} onRetry={() => void query.reload()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 96 }}>
        <View className="px-4">
          <View className="mb-3 mt-2 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold">{entry?.nickname ?? '月报'}</Text>
              <Text className="text-muted-foreground mt-1 text-xs">
                {entry?.activityTitle} · {entry?.period}
                {entry?.late ? ' · 迟交' : ''}
              </Text>
            </View>
            {entry?.status === 2 ? (
              <Text className="text-found text-sm font-semibold">已提交</Text>
            ) : entry?.status === 1 ? (
              <Text className="text-pending text-sm font-semibold">草稿</Text>
            ) : null}
          </View>

          {/* 正文:编辑态 / 阅读态 / 未创建 */}
          {editing && canEdit ? (
            <Card className="p-4">
              <TextInput
                className="text-foreground min-h-64 text-sm leading-5"
                style={{ color: token('foreground', scheme) }}
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={5000}
                placeholder="本月完成、数据、下月计划…"
                accessibilityLabel="汇报正文"
              />
              <Text className="text-muted-foreground mt-1 self-end text-xs">{draft.length}/5000</Text>
              <View className="mt-3 flex-row" style={{ gap: 12 }}>
                <Button variant="outline" className="flex-1" onPress={() => void save(false)} disabled={!!saving}>
                  <Text>{saving === 'draft' ? '保存中…' : '存草稿'}</Text>
                </Button>
                <Button className="flex-1" onPress={() => void save(true)} disabled={!!saving}>
                  <Text>{saving === 'submit' ? '提交中…' : '提交'}</Text>
                </Button>
              </View>
            </Card>
          ) : entry?.content ? (
            <Card className="p-4">
              <Text className="text-foreground text-sm leading-6" selectable>
                {entry.content}
              </Text>
              {canEdit ? (
                <Button variant="outline" size="sm" className="mt-3 self-start" onPress={startEdit}>
                  <Text>{entry.status === 2 ? '修改并重新提交' : '继续编辑'}</Text>
                </Button>
              ) : null}
            </Card>
          ) : canEdit ? (
            <Card className="p-4">
              <Text className="text-muted-foreground mb-3 text-sm">还没有内容,点击开始填写本月汇报</Text>
              <Button onPress={startEdit}>
                <Text>开始填写</Text>
              </Button>
            </Card>
          ) : (
            <EmptyState title="该成员尚未提交" description="提交后全员可读" />
          )}

          {/* 评论 */}
          <Text className="text-muted-foreground mb-2 mt-5 px-4 text-xs font-semibold">
            评论({comments.length})
          </Text>
          {canComment ? null : (
            <Text className="text-muted-foreground px-4 pb-2 text-xs">登录后可评论</Text>
          )}
          {comments.length === 0 ? (
            <Text className="text-muted-foreground px-4 pb-2 text-xs">还没有评论</Text>
          ) : null}
        </View>
      </ScrollView>

      {replyTo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消回复"
          onPress={() => setReplyTo(null)}
          className="bg-accent mx-4 mb-1 flex-row items-center justify-between rounded-lg px-3 py-1.5"
        >
          <Text className="text-accent-foreground text-xs">回复 @{replyTo.nickname}</Text>
          <Text className="text-accent-foreground text-xs font-semibold">取消</Text>
        </Pressable>
      ) : null}

      {canComment ? (
        <View
          className="border-border flex-row items-center px-4 pb-4 pt-2"
          style={{ borderTopWidth: 1, backgroundColor: token('background', scheme), gap: 8 }}
        >
          <TextInput
            className="border-border text-foreground flex-1 rounded-full border px-4 py-2 text-sm"
            style={{ color: token('foreground', scheme) }}
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder={replyTo ? `回复 @${replyTo.nickname}` : '说点什么…'}
            placeholderTextColor={token('muted-foreground', scheme)}
            accessibilityLabel="评论输入框"
            onSubmitEditing={() => void sendComment()}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送评论"
            onPress={() => void sendComment()}
            disabled={!commentDraft.trim() || sending}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: commentDraft.trim() && !sending ? token('primary', scheme) : token('muted', scheme),
            }}
          >
            <Text
              className={`text-sm font-semibold ${commentDraft.trim() && !sending ? 'text-primary-foreground' : 'text-muted-foreground'}`}
            >
              发送
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
