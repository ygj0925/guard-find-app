/**
 * 签到详情。
 * 发起人:6 位动态码大屏(30 秒自动轮换 + 刷新倒计时)+ 签到名单(时间/地点)。
 * 参与者:输 6 位动态码 + 所在地点 → 签到;防代签由服务端校验(时间窗/码/地点/重复)。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState, ErrorState, SectionCard } from '@/components/business/feedback';
import {
  doCheckin,
  fetchCheckinDetail,
  deleteCheckin,
} from '@/lib/api/endpoints/checkin';
import { currentCheckinCode, secondsToNextWindow } from '@/lib/checkin/code';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';

export default function CheckinDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const activityId = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const query = useRequest(() => fetchCheckinDetail(activityId), [activityId, signedIn]);
  const activity = query.data;

  const [now, setNow] = useState(() => new Date());
  const [code, setCode] = useState('');
  const [locationName, setLocationName] = useState('');
  const [busy, setBusy] = useState(false);

  // 每秒走表:动态码 30 秒自动轮换
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isOwner = activity?.secret !== undefined && activity?.secret !== null;
  const displayCode = isOwner && activity?.secret ? currentCheckinCode(activity.secret, now) : null;
  const refreshIn = secondsToNextWindow(now);

  const submit = useCallback(async () => {
    if (code.trim().length !== 6 || busy) return;
    setBusy(true);
    try {
      await doCheckin(activityId, code.trim(), locationName.trim() || undefined);
      toast('签到成功', 'success');
      await query.reload();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '签到失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [activityId, busy, code, locationName, query, toast]);

  const confirmDelete = useCallback(() => {
    Alert.alert('删除这个签到?', activity?.title ?? '', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
            void (async () => {
              try {
                await deleteCheckin(activityId);
                toast('已删除');
                router.back();
              } catch {
                toast('删除失败,请稍后再试', 'error');
              }
            })();
        },
      },
    ]);
  }, [activity?.title, activityId, router, toast]);

  if (!activityId || detailFailed(query.error)) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : (
          <EmptyState title="缺少活动 ID" />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">{activity?.title ?? '签到'}</Text>
          {activity?.locationName ? (
            <Text className="text-primary mt-1 text-sm">地点:{activity.locationName}</Text>
          ) : null}
          <Text className="text-muted-foreground mt-1 text-xs">
            {activity?.startTime?.slice(5, 16)} ~ {activity?.endTime?.slice(11, 16)}
            {activity?.inWindow ? ' · 进行中' : ' · 窗口外'}
          </Text>
        </View>

        {/* 发起人:动态码大屏 */}
        {isOwner ? (
          <Card className="items-center p-6">
            <Text className="text-muted-foreground text-xs">出示此动态码,大家输码签到</Text>
            <Text
              className="text-primary my-4 text-6xl font-bold tracking-[0.2em]"
              accessibilityLabel="当前签到码"
            >
              {displayCode}
            </Text>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-muted-foreground text-xs">{refreshIn}s 后自动刷新</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="重置邀请码"
                onPress={confirmDelete}
                disabled={!isOwner}
              >
                <Text className="text-urgent text-xs">删除活动</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* 参与者:输码签到 */}
        {!isOwner ? (
          <Card className="p-4">
            {activity?.signedByMe ? (
              <View>
                <Text className="text-found text-base font-semibold">✓ 你已签到</Text>
                <Text className="text-muted-foreground mt-1 text-xs">
                  地点:{activity.myLocationName ?? '未填写'}
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-muted-foreground mb-2 text-xs">
                  输入发起人屏幕上的 6 位动态码
                </Text>
                <TextInput
                  className="border-border text-foreground rounded-lg border px-3 py-3 text-center text-3xl font-bold tracking-[0.4em]"
                  style={{ color: token('foreground', scheme) }}
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="000000"
                  maxLength={6}
                  accessibilityLabel="签到码"
                />
                {activity?.locationName ? (
                  <TextInput
                    className="border-border text-foreground mt-3 rounded-lg border px-3 py-2 text-sm"
                    style={{ color: token('foreground', scheme) }}
                    value={locationName}
                    onChangeText={setLocationName}
                    placeholder={`所在地点(须为「${activity.locationName}」)`}
                    accessibilityLabel="所在地点"
                  />
                ) : null}
                <Button className="mt-4" onPress={() => void submit()} disabled={busy || code.length !== 6}>
                  <Text>{busy ? '签到中…' : '签到'}</Text>
                </Button>
              </>
            )}
          </Card>
        ) : null}

        {/* 名单(发起人) */}
        {isOwner ? (
          <SectionCard title={`签到名单(${activity?.signedCount ?? 0} 人)`}>
            {(activity?.records ?? []).length === 0 ? (
              <Text className="text-muted-foreground text-sm">还没有人签到</Text>
            ) : (
              (activity?.records ?? []).map((record) => (
                <View key={record.userId} className="mb-2 flex-row items-center">
                  <Avatar alt={record.nickname ?? '成员'} className="size-9">
                    {record.avatar ? <AvatarImage source={{ uri: record.avatar }} /> : null}
                    <AvatarFallback>
                      <Text>{(record.nickname ?? '成').slice(0, 1)}</Text>
                    </AvatarFallback>
                  </Avatar>
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-medium">{record.nickname ?? '成员'}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {record.createTime?.slice(11, 16) ?? ''}
                      {record.locationName ? ` · ${record.locationName}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </SectionCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function detailFailed(error: unknown): boolean {
  return !!error;
}
