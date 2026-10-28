/**
 * 动态详情:正文 + 图片全览 + 评论列表 + 评论输入条 + 点赞。
 * 评论过敏感词;删除仅本人(长按自己的评论提示,一期仅支持删整条动态)。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, MapPin, Send } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RemoteImage } from '@/components/business/RemoteImage';
import { ErrorState, SectionCard } from '@/components/business/feedback';
import {
  createPostComment,
  fetchPostComments,
  fetchPostDetail,
  togglePostLike,
  type CommunityComment,
} from '@/lib/api/endpoints/post';
import { relativeTime } from '@/app/(tabs)/community';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const postId = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const detail = useRequest(() => fetchPostDetail(postId), [postId, signedIn]);
  const commentsQuery = useRequest(() => fetchPostComments(postId), [postId, signedIn]);
  const comments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // 楼中楼:正在回复的评论(评论 ID + 目标昵称)
  const [replyTo, setReplyTo] = useState<{ commentId: string; nickname: string } | null>(null);

  const post = detail.data;

  const like = useCallback(async () => {
    if (!post) return;
    if (!signedIn) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/community/detail?id=${postId}`)}`);
      return;
    }
    try {
      await togglePostLike(post.id);
      await detail.reload();
    } catch {
      toast('操作失败,请稍后再试', 'error');
    }
  }, [detail, post, postId, router, signedIn, toast]);

  const sendComment = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    if (!signedIn) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/community/detail?id=${postId}`)}`);
      return;
    }
    setSending(true);
    try {
      await createPostComment(postId, content, replyTo?.commentId);
      setDraft('');
      setReplyTo(null);
      toast('评论已发表', 'success');
      // 计数在动态详情里,评论列表和详情都要刷新
      await Promise.all([commentsQuery.reload(), detail.reload()]);
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '评论失败,请稍后再试', 'error');
    } finally {
      setSending(false);
    }
  }, [commentsQuery, detail, draft, postId, replyTo, router, sending, signedIn, toast]);

  const renderComment = useCallback(
    ({ item }: { item: CommunityComment }) => (
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

  if (detail.error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ErrorState error={detail.error} onRetry={() => void detail.reload()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 96 }}
        ListHeaderComponent={
          detail.isInitialLoading || !post ? (
            <SectionCard title="加载中…">{null}</SectionCard>
          ) : (
            <View className="px-4">
              <View className="flex-row items-center">
                <Avatar alt={post.nickname ?? '用户'} className="size-11">
                  {post.avatar ? <AvatarImage source={{ uri: post.avatar }} /> : null}
                  <AvatarFallback>
                    <Text>{(post.nickname ?? '用').slice(0, 1)}</Text>
                  </AvatarFallback>
                </Avatar>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold">{post.nickname ?? '用户'}</Text>
                  <Text className="text-muted-foreground text-xs">{relativeTime(post.createTime)}</Text>
                </View>
              </View>
              <Text className="text-foreground mt-3 text-sm leading-5">{post.content}</Text>
              {post.images.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap" style={{ gap: 6 }}>
                  {post.images.map((uri) => (
                    <RemoteImage key={uri} uri={uri} style={{ width: 110, height: 110, borderRadius: 8 }} />
                  ))}
                </View>
              ) : null}
              {post.locationName ? (
                <View className="mt-3 flex-row items-center" style={{ gap: 4 }}>
                  <Icon as={MapPin} size={14} className="text-primary" />
                  <Text className="text-primary text-xs">{post.locationName}</Text>
                </View>
              ) : null}
              <Card className="mt-3 flex-row items-center p-3" style={{ gap: 16 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={post.likedByMe ? '取消点赞' : '点赞'}
                  onPress={() => void like()}
                  className="flex-row items-center"
                  style={{ gap: 4 }}
                >
                  <Icon as={Heart} size={18} className={post.likedByMe ? 'text-urgent' : 'text-muted-foreground'} />
                  <Text className={`text-sm ${post.likedByMe ? 'text-urgent' : 'text-muted-foreground'}`}>
                    {post.likedByMe ? '已赞' : '点赞'} · {post.likeCount}
                  </Text>
                </Pressable>
                <Text className="text-muted-foreground text-sm">评论 · {post.commentCount}</Text>
              </Card>
              <Text className="text-muted-foreground mb-2 mt-4 text-xs font-semibold">
                评论({comments.length})
              </Text>
              {comments.length === 0 && !commentsQuery.isInitialLoading ? (
                <Text className="text-muted-foreground px-4 pb-2 text-xs">还没有评论,来说两句</Text>
              ) : null}
            </View>
          )
        }
        renderItem={renderComment}
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
          placeholder={signedIn ? '说点什么…' : '登录后评论'}
          placeholderTextColor={token('muted-foreground', scheme)}
          accessibilityLabel="评论输入框"
          onSubmitEditing={() => void sendComment()}
          returnKeyType="send"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="发送评论"
          onPress={() => void sendComment()}
          disabled={!draft.trim() || sending}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: draft.trim() && !sending ? token('primary', scheme) : token('muted', scheme),
          }}
        >
          <Icon
            as={Send}
            size={18}
            className={draft.trim() && !sending ? 'text-primary-foreground' : 'text-muted-foreground'}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
