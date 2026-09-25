/**
 * 草稿箱(spec: 草稿与离线保护)。
 *
 * 两份草稿分开列:
 *   1. 云端草稿 —— `POST /app/find/case` 携 `submit=false` 产生的 `DRAFT` 档案;
 *   2. 本机副本 —— `store/publish-form` debounce 落的本地草稿,离线/断网时唯一可见的一份。
 *
 * 两者不一致时不在这里静默合并:进入编辑器后由 `publish/case` 的冲突弹层决定以哪一方为准。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CaseStatusBadge } from '@/components/business/status-badges';
import { EmptyState, ErrorState, InlineRow, NoticeBar, SectionCard } from '@/components/business/feedback';
import { useRequest } from '@/hooks/useRequest';
import { caseApi, type CaseDetail } from '@/lib/api/endpoints/case';
import { formatDateTime, formatRelative, toServerTime } from '@/lib/format';
import { toUserMessage } from '@/lib/api/error';
import { DRAFT_KEY, usePublishForm } from '@/store/publish-form';
import { kvRemove } from '@/lib/storage/kv';
import { useToast } from '@/providers/ToastProvider';
import { useSessionGuard } from '@/providers/SessionProvider';

const PAGE_SIZE = 20;

export default function DraftsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { guard, signedIn } = useSessionGuard();

  const [items, setItems] = useState<CaseDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [confirmReset, setConfirmReset] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 逐个字段取,不要在 selector 里拼新对象:zustand v5 用 Object.is 比快照,
  // 每次返回新对象会触发 "getSnapshot should be cached" 的无限渲染。
  const hydrated = usePublishForm((state) => state.hydrated);
  const localName = usePublishForm((state) => state.values.name);
  const localStep = usePublishForm((state) => state.step);
  const localUpdatedAt = usePublishForm((state) => state.updatedAt);
  const localSyncedAt = usePublishForm((state) => state.syncedAt);
  const pendingSync = usePublishForm((state) => state.pendingSync);
  const localCaseId = usePublishForm((state) => state.caseId);
  const localMediaCount = usePublishForm((state) => state.values.media.length);
  const hydrate = usePublishForm((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const request = useRequest(
    () => caseApi.mine({ status: 'DRAFT', page, size: PAGE_SIZE }),
    [page, signedIn],
    {
      // 同线索列表:合并分页结果发生在响应落地的那一刻,不在 effect 同步体里写 state。
      onData: (data) => {
        setTotal(data.total ?? 0);
        setItems((current) => {
          const base = page === 1 ? [] : current;
          const seen = new Set(base.map((item) => item.id));
          const merged = base.slice();
          for (const item of data.records ?? []) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
          }
          return merged;
        });
      },
    },
  );

  const submitDraft = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        await caseApi.submit(id);
        toast('已提交审核,结果会通过站内信通知你', 'success');
        void request.reload();
      } catch (error) {
        setActionError(toUserMessage(error));
      }
    },
    [request, toast],
  );

  const hasLocalDraft = Boolean(localUpdatedAt && (localName || localCaseId));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={undefined}
      >
        {!signedIn ? (
          <NoticeBar
            tone="info"
            title="登录后可同步云端草稿"
            lines={['本机副本仍然可用,离线填写不会丢。']}
          />
        ) : null}

        {actionError ? <NoticeBar tone="danger" title={actionError} /> : null}

        <SectionCard
          title="本机草稿"
          description={'离线也能继续填写;联网后点"存草稿"同步到云端'}
          className="mt-2"
        >
          {hasLocalDraft ? (
            <View>
              <InlineRow label="姓名" value={localName || '未填写'} />
              <InlineRow label="填写进度" value={`第 ${localStep + 1} / 5 步`} />
              <InlineRow label="已选图片" value={`${localMediaCount} 张`} />
              <InlineRow
                label="本机保存"
                value={localUpdatedAt ? stampText(localUpdatedAt) : '未保存'}
              />
              <InlineRow
                label="云端同步"
                value={localSyncedAt ? stampText(localSyncedAt) : '从未同步'}
              />
              {pendingSync ? (
                <Text className="text-pending mt-1 text-xs">标注:待同步</Text>
              ) : null}
              <View className="mt-3 flex-row gap-2">
                <Button className="flex-1" onPress={() => router.push('/publish/case')}>
                  <Text>继续填写</Text>
                </Button>
                <Button variant="outline" onPress={() => setConfirmReset(true)}>
                  <Text>删除本机副本</Text>
                </Button>
              </View>
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm">
              本机没有未完成的内容。{hydrated ? '' : '正在读取…'}
            </Text>
          )}
        </SectionCard>

        <SectionCard title="云端草稿" description="状态为 DRAFT 的档案,可续填或直接提交" className="mt-3">
          {request.isInitialLoading ? (
            <Text className="text-muted-foreground text-sm">加载中</Text>
          ) : request.error && !items.length ? (
            <ErrorState error={request.error} onRetry={() => void request.reload()} compact />
          ) : !items.length ? (
            <Text className="text-muted-foreground text-sm">还没有云端草稿。</Text>
          ) : (
            items.map((item) => (
              <View key={item.id} className="border-border border-b py-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold">{item.name}</Text>
                  <CaseStatusBadge status={item.status} />
                </View>
                <Text className="text-muted-foreground mt-1 text-xs">
                  失踪时间 {formatDateTime(item.missingTime)} · 更新 {formatRelative(item.publishTime)}
                </Text>
                <View className="mt-2 flex-row gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push(`/publish/case?caseId=${item.id}`)}
                  >
                    <Text>续填</Text>
                  </Button>
                  <Button size="sm" onPress={() => void submitDraft(item.id)}>
                    <Text>提交审核</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => router.push(`/case/${item.id}`)}
                  >
                    <Text>查看</Text>
                  </Button>
                </View>
              </View>
            ))
          )}
          {items.length && items.length < total ? (
            <Pressable
              accessibilityRole="button"
              className="py-3"
              onPress={() => setPage((current) => current + 1)}
            >
              <Text className="text-primary text-center text-sm">
                加载更多(已载 {items.length}/{total})
              </Text>
            </Pressable>
          ) : null}
        </SectionCard>

        {signedIn && !request.isInitialLoading && !items.length && !hasLocalDraft ? (
          <EmptyState
            title="草稿箱是空的"
            description={'去发布页填写,随时可以"存草稿"离开。'}
            actionLabel="开始发布"
            onAction={() => router.push('/publish/case')}
          />
        ) : null}

        {!signedIn ? (
          <Button className="mt-4" onPress={() => guard({ href: '/publish/drafts', label: 'drafts' })}>
            <Text>登录以同步云端草稿</Text>
          </Button>
        ) : null}
      </ScrollView>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除本机草稿副本?</AlertDialogTitle>
            <AlertDialogDescription>
              只清除本机保存的未完成内容(存储键 {DRAFT_KEY}),云端草稿不受影响。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>取消</Text>
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onPress={() => {
                void kvRemove(DRAFT_KEY).then(() => usePublishForm.getState().reset());
                setConfirmReset(false);
                toast('本机草稿副本已删除', 'success');
              }}
            >
              <Text>删除</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}

/** 本机时间戳(ms)-> 相对时间文案;`formatRelative` 只认服务端时间格式,先转一次。 */
function stampText(ms: number): string {
  return formatRelative(toServerTime(new Date(ms)));
}
