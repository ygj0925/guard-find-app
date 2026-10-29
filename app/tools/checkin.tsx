/**
 * 在线签到:发起人看动态码大屏(30 秒轮换)+ 签到名单;
 * 参与者输码签到(可要求地点一致)。时间用 yyyy-MM-dd HH:mm 文本输入。
 */
import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardCheck, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/fields';
import { EmptyState, ErrorState } from '@/components/business/feedback';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  createCheckin,
  deleteCheckin,
  fetchMyCheckins,
    type ToolCheckin,
  } from '@/lib/api/endpoints/checkin';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

export default function CheckinScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const query = useRequest(() => fetchMyCheckins(), [signedIn]);
  const activities = query.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const create = useCallback(async () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = '请填写签到主题';
    const timeRe = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (startTime.trim() && !timeRe.test(startTime.trim())) next.startTime = '格式应为 yyyy-MM-dd HH:mm';
    if (endTime.trim() && !timeRe.test(endTime.trim())) next.endTime = '格式应为 yyyy-MM-dd HH:mm';
    setErrors(next);
    if (Object.keys(next).length > 0 || busy) return;
    setBusy(true);
    try {
      await createCheckin({
        title: title.trim(),
        locationName: locationName.trim() || undefined,
        startTime: startTime.trim() ? `${startTime.trim()}:00` : undefined,
        endTime: endTime.trim() ? `${endTime.trim()}:00` : undefined,
      });
      toast('签到已发起,把动态码展示给大家', 'success');
      setCreateOpen(false);
      setTitle('');
      setLocationName('');
      setStartTime('');
      setEndTime('');
      await query.reload();
    } catch {
      toast('创建失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, endTime, locationName, query, startTime, title, toast]);

  const confirmDelete = useCallback(
    (activity: ToolCheckin) => {
      Alert.alert('删除这个签到?', activity.title, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteCheckin(activity.id);
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

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用在线签到"
          description="发起签到,家人/同学扫码或输码签到"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/checkin', from: 'checkin' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">签到</Text>
            <Text className="text-muted-foreground mt-1 text-sm">动态码防代签 · 时间窗 · 地点校验</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发起签到"
            onPress={() => setCreateOpen(true)}
            className="bg-accent h-10 w-10 items-center justify-center rounded-full"
          >
            <Icon as={Plus} size={20} className="text-primary" />
          </Pressable>
        </View>

        {query.isInitialLoading ? (
          <SkeletonList rows={3} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : activities.length === 0 ? (
          <EmptyState
            title="还没有发起过签到"
            description="点右上角 + 发起一个,大屏展示动态码让大家输码签到"
            actionLabel="发起签到"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          activities.map((activity) => (
            <Pressable
              key={activity.id}
              accessibilityRole="button"
              accessibilityLabel={`查看 ${activity.title} 的动态码与名单`}
              onPress={() => router.push(`/tools/checkin-detail?id=${activity.id}`)}
              onLongPress={() => confirmDelete(activity)}
              className="mb-2"
            >
              <Card className="flex-row items-center p-3">
                <View className="bg-accent h-9 w-9 items-center justify-center rounded-full">
                  <Icon as={ClipboardCheck} size={16} className="text-accent-foreground" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-medium">{activity.title}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    已签 {activity.signedCount} 人 · {activity.startTime?.slice(5, 16)} 起
                  </Text>
                </View>
                {activity.inWindow ? (
                  <Text className="text-found text-xs font-semibold">进行中</Text>
                ) : (
                  <Text className="text-muted-foreground text-xs">已结束</Text>
                )}
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* 新建弹层 */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-3 text-lg font-bold">发起签到</Text>
            <Field label="签到主题" error={errors.title} required>
              <Input value={title} onChangeText={setTitle} placeholder="比如:周三晚自习" aria-label="签到主题" />
            </Field>
            <Field label="活动地点名" hint="选填;填写后签到人须输入一致的地点名才可签到">
              <Input value={locationName} onChangeText={setLocationName} placeholder="比如:图书馆 302" aria-label="活动地点名" />
            </Field>
            <Field label="开始时间" error={errors.startTime} hint="yyyy-MM-dd HH:mm,缺省=现在">
              <Input value={startTime} onChangeText={setStartTime} placeholder="2026-10-29 18:00" aria-label="开始时间" />
            </Field>
            <Field label="截止时间" error={errors.endTime} hint="缺省=开始后 2 小时">
              <Input value={endTime} onChangeText={setEndTime} placeholder="2026-10-29 20:00" aria-label="截止时间" />
            </Field>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setCreateOpen(false)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void create()} disabled={busy}>
                <Text>{busy ? '创建中…' : '发起'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
