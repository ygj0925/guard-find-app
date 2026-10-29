/**
 * 我的档案(spec: 我的档案与生命周期操作 / 契约 2 节)。
 *
 * 取数只有一个来源:`GET /app/find/case/mine`(带 `status` 与 `summary` 各状态计数)。
 * 操作全部走契约里本人可用的六个动作:提交、续期、撤回、标记找回、申请删除、改后重提。
 *
 * 三条硬规则:
 *   1. 驳回必须能看到理由:优先 `auditRemark`,再回落到 `statusHistory` 里进
 *      `REJECTED` 那一条的 `reason`;两处都没有时只说"服务端未给出",不编模板话术;
 *   2. 标记找回必须选确认依据(`POLICE|GUARDIAN|DNA`),没选不发请求;
 *   3. 申请删除不可恢复,必须二次确认(先勾知悉,再点删除)。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, Eye, ShieldAlert, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckboxField, Field, TextField } from '@/components/form/fields';
import { DateTimePicker } from '@/components/business/pickers';
import { RemoteImage } from '@/components/business/RemoteImage';
import { CaseStatusBadge, UrgencyBadge } from '@/components/business/status-badges';
import { EmptyState, ErrorState, InlineRow, NoticeBar, SectionCard } from '@/components/business/feedback';
import { useRequest } from '@/hooks/useRequest';
import { useFeed } from '@/hooks/useFeed';
import type { FeedResp } from '@/lib/api/endpoints/common';
import {
  caseApi,
  type CaseDetail,
  type CaseStatus,
  type ConfirmType,
} from '@/lib/api/endpoints/case';
import { toUserMessage } from '@/lib/api/error';
import {
  CASE_STATUS_LABEL,
  CONFIRM_TYPE_LABEL,
  GENDER_LABEL,
  caseAgeText,
  formatDateTime,
  toServerTime,
} from '@/lib/format';
import { useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';

const PAGE_SIZE = 10;

const STATUS_FILTERS: (CaseStatus | '')[] = [
  '',
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
  'FOUND',
  'WITHDRAWN',
  'OFFLINE',
];

/** 分组顺序:先看要动作的,再看结果类的。 */
const GROUP_ORDER: CaseStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'REJECTED',
  'PUBLISHED',
  'FOUND',
  'ARCHIVED',
  'WITHDRAWN',
  'OFFLINE',
  'ERASED',
];

const CONFIRM_TYPES: ConfirmType[] = ['POLICE', 'GUARDIAN', 'DNA'];

export default function MyCasesScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { guard, signedIn } = useSessionGuard();

  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [foundTarget, setFoundTarget] = useState<CaseDetail | null>(null);
  const [foundConfirm, setFoundConfirm] = useState<ConfirmType | ''>('');
  const [foundTime, setFoundTime] = useState('');
  const [foundTimeOpen, setFoundTimeOpen] = useState(false);
  const [foundRemark, setFoundRemark] = useState('');
  const [eraseTarget, setEraseTarget] = useState<CaseDetail | null>(null);
  const [eraseAck, setEraseAck] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<CaseDetail | null>(null);
  const [doneFound, setDoneFound] = useState<string | null>(null);
  // 删除成功后先在本页隐藏:契约的 `mine` 仍可能把 `ERASED` 回给本人。
  const [erasedIds, setErasedIds] = useState<Record<string, true>>({});

  const slotKey = `my-cases|${status || 'all'}`;

  // `mine` 是 `PageResp` 分页,这里用 `useFeed` 把页码当游标承载:
  // 骨架屏 / 空 / 失败可重试 / 无更多四态与竞态丢弃都由这个 hook 统一给。
  const fetchPage = useCallback(
    async (cursor: string | null): Promise<FeedResp<CaseDetail>> => {
      if (!signedIn) return { records: [], nextCursor: null, hasMore: false };
      const page = cursor ? Number(cursor) : 1;
      const resp = await caseApi.mine({ page, size: PAGE_SIZE, status: status || undefined });
      const records = resp?.records ?? [];
      const hasMore = page * PAGE_SIZE < (resp?.total ?? 0) && records.length > 0;
      return { records, nextCursor: hasMore ? String(page + 1) : null, hasMore };
    },
    [signedIn, status],
  );

  const feed = useFeed<CaseDetail>(slotKey, fetchPage, [slotKey, signedIn]);
  const items = useMemo(
    () => feed.items.filter((item) => !erasedIds[item.id]),
    [erasedIds, feed.items],
  );

  // 各状态计数只在"全部"这一视图下取,单独一次 size=1 的请求,不参与列表分页。
  const statistics = useRequest(() => caseApi.mine({ page: 1, size: 1 }), [], {
    enabled: signedIn && status === '',
    keepDataOnError: true,
  });
  const summary = status === '' ? statistics.data?.summary : undefined;

  const groups = useMemo(() => {
    const byStatus = new Map<CaseStatus, CaseDetail[]>();
    for (const item of items) {
      const bucket = byStatus.get(item.status);
      if (bucket) bucket.push(item);
      else byStatus.set(item.status, [item]);
    }
    return GROUP_ORDER.filter((key) => (byStatus.get(key) ?? []).length).map((key) => ({
      status: key,
      rows: byStatus.get(key) ?? [],
    }));
  }, [items]);

  const reload = useCallback(() => {
    void feed.refresh();
  }, [feed]);

  const runAction = useCallback(
    async (item: CaseDetail, label: string, action: () => Promise<unknown>) => {
      setActionError(null);
      setBusyId(item.id);
      try {
        await action();
        toast(`${label}已完成,列表已刷新`, 'success');
        reload();
      } catch (error) {
        setActionError(toUserMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    [reload, toast],
  );

  const submitFound = useCallback(async () => {
    if (!foundTarget) return;
    // 没选确认依据就不发请求(spec 场景「找回确认需选依据」)。
    if (!foundConfirm) {
      setActionError('请选择确认依据:警方、家属确认或 DNA 比对');
      return;
    }
    const item = foundTarget;
    setFoundTarget(null);
    await runAction(item, '标记找回', () =>
      caseApi.found(item.id, {
        confirmType: foundConfirm,
        foundTime: foundTime || toServerTime(new Date()),
        remark: foundRemark.trim() ? foundRemark.trim() : undefined,
      }),
    );
    setDoneFound(item.name || item.id);
  }, [foundConfirm, foundRemark, foundTarget, foundTime, runAction]);

  const confirmErase = useCallback(async () => {
    if (!eraseTarget) return;
    const item = eraseTarget;
    setEraseTarget(null);
    setEraseAck(false);
    await runAction(item, '删除申请', () => caseApi.erase(item.id));
    // 删除后从当前列表立刻摘掉,不等服务端下一次分页结果(spec: 从所有列表消失)。
    setErasedIds((current) => ({ ...current, [item.id]: true }));
  }, [eraseTarget, runAction]);

  const reopenWithPrefill = useCallback(
    (item: CaseDetail) => {
      // 预填走发布表单既有的云端草稿装载:`?caseId=` 会拉全量并保留已上传图片。
      router.push(`/publish/case?caseId=${item.id}`);
    },
    [router],
  );

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-4">
          <NoticeBar
            tone="info"
            title="登录后查看我发布的档案"
            lines={['续期、撤回、标记找回与申请删除都只对档案本人开放。']}
          />
          <Button
            testID="cases-login"
            onPress={() => guard({ href: '/me/cases', label: 'my-cases' })}
          >
            <Text>去登录</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row flex-wrap gap-2 px-4 pb-2 pt-3">
        {STATUS_FILTERS.map((key) => (
          <Pressable
            key={key || 'all'}
            testID={`cases-filter-${key || 'all'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: status === key }}
            onPress={() => {

              setStatus(key);
            }}
            className={`rounded-full px-3 py-1.5 ${status === key ? 'bg-primary' : 'bg-secondary'}`}
          >
            <Text className={status === key ? 'text-primary-foreground text-xs' : 'text-xs'}>
              {key === '' ? '全部' : CASE_STATUS_LABEL[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      {summary ? (
        <View className="px-4 pb-2">
          <Text className="text-muted-foreground text-xs">
            各状态计数(服务端 summary):草稿 {summary.draft} · 待审核 {summary.pendingReview} ·
            已发布 {summary.published} · 已驳回 {summary.rejected} · 已归档 {summary.archived} ·
            已找回 {summary.found} · 已下架 {summary.offline}
          </Text>
        </View>
      ) : null}

      {doneFound ? (
        <View className="px-4">
          <NoticeBar
            tone="success"
            title={`${doneFound} 已标记找回`}
            lines={[
              '档案转为喜报版式,全部线索提交人都会收到站内信通知。',
              '如填错了确认依据,请在撤回前联系运营方核实。',
            ]}
          />
        </View>
      ) : null}

      {actionError ? (
        <View className="px-4 pb-2">
          <Text accessibilityRole="alert" className="text-urgent text-sm">
            {actionError}
          </Text>
        </View>
      ) : null}

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {feed.showSkeleton ? (
          <View>
            <Skeleton className="mb-3 h-36 rounded-xl" />
            <Skeleton className="mb-3 h-36 rounded-xl" />
          </View>
        ) : feed.error && !items.length ? (
          <ErrorState error={feed.error} onRetry={() => void feed.refresh()} />
        ) : !items.length ? (
          <EmptyState
            title={status ? `没有${CASE_STATUS_LABEL[status]}状态的档案` : '还没有发布过档案'}
            description="发布寻人信息后,这里可以续期、撤回、标记找回或申请删除。"
            actionLabel="去发布"
            onAction={() => router.push('/publish/case')}
          />
        ) : (
          groups.map((group) => (
            <SectionCard
              key={group.status}
              title={CASE_STATUS_LABEL[group.status]}
              description={`${group.rows.length} 条${status === '' ? '(当前页)' : ''}`}
            >
              {group.rows.map((item) => (
                <CaseRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onView={() => router.push(`/case/${item.id}`)}
                  onRejectReason={() => {
                    setRejectTarget(item);
                    setActionError(null);
                  }}
                  onRenew={() => void runAction(item, '续期', () => caseApi.renew(item.id))}
                  onWithdraw={() => void runAction(item, '撤回', () => caseApi.withdraw(item.id))}
                  onSubmitDraft={() => void runAction(item, '提交审核', () => caseApi.submit(item.id))}
                  onContinueEdit={() => router.push(`/publish/case?caseId=${item.id}`)}
                  onReopen={() => reopenWithPrefill(item)}
                  onFound={() => {
                    setFoundTarget(item);
                    setFoundConfirm('');
                    setFoundRemark('');
                    setFoundTime(toServerTime(new Date()));
                    setActionError(null);
                  }}
                  onErase={() => {
                    setEraseTarget(item);
                    setEraseAck(false);
                    setActionError(null);
                  }}
                />
              ))}
            </SectionCard>
          ))
        )}

        {items.length && feed.hasMore ? (
          <Pressable
            accessibilityRole="button"
            className="py-3"
            onPress={() => void feed.loadMore()}
          >
            <Text className="text-primary text-center text-sm">
              加载更多(已载 {items.length}/{statistics.data?.total ?? items.length})
            </Text>
          </Pressable>
        ) : items.length ? (
          <Text className="text-muted-foreground py-3 text-center text-xs">已加载全部</Text>
        ) : null}
      </ScrollView>

      {/* 标记找回:确认依据必选。 */}
      <AlertDialog open={Boolean(foundTarget)} onOpenChange={(open) => !open && setFoundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>标记找回</AlertDialogTitle>
            <AlertDialogDescription>
              请选择确认依据。标记后档案状态转为「已找回」,并通知该档案的全部线索提交人。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <View className="flex-row flex-wrap gap-2">
            {CONFIRM_TYPES.map((key) => (
              <Pressable
                key={key}
                testID={`found-confirm-${key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: foundConfirm === key }}
                onPress={() => setFoundConfirm(key)}
                className={`rounded-full border px-3 py-1.5 ${
                  foundConfirm === key ? 'border-primary bg-primary' : 'border-border bg-background'
                }`}
              >
                <Text className={foundConfirm === key ? 'text-primary-foreground text-xs' : 'text-xs'}>
                  {CONFIRM_TYPE_LABEL[key]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="找回时间"
            hint={foundTime || '默认取当前时间'}
            error={foundConfirm ? undefined : '必须选择确认依据'}
          >
            <Button variant="outline" size="sm" onPress={() => setFoundTimeOpen(true)}>
              <Icon as={Calendar} size={14} />
              <Text>{foundTime ? formatDateTime(foundTime) : '选择日期与时间'}</Text>
            </Button>
          </Field>
          <TextField
            label="补充说明"
            value={foundRemark}
            maxLength={200}
            multiline
            hint="可选,会写入档案的状态变更记录"
            onChangeText={setFoundRemark}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>取消</Text>
            </AlertDialogCancel>
            <Button testID="found-submit" onPress={() => void submitFound()}>
              <Text>确认找回</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DateTimePicker
        visible={foundTimeOpen}
        mode="datetime"
        title="找回时间"
        value={foundTime || null}
        onClose={() => setFoundTimeOpen(false)}
        onChange={(next) => setFoundTime(next)}
      />

      {/* 驳回理由:服务端给什么读什么,不给就说明没给。 */}
      <AlertDialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>驳回理由</AlertDialogTitle>
            <AlertDialogDescription>
              理由来自审核环节;修改后重新提交会再生成一个版本快照。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rejectTarget ? (
            <View>
              <InlineRow
                label="审核意见"
                value={rejectTarget.auditRemark ?? '服务端未返回审核意见'}
                selectable
              />
              <InlineRow
                label="状态记录"
                value={rejectReasonFromHistory(rejectTarget) ?? '状态变更历史里没有驳回记录'}
                selectable
              />
              <InlineRow label="档案编号" value={rejectTarget.id} selectable />
              {!rejectTarget.auditRemark ? (
                <Text className="text-muted-foreground mt-2 text-xs">
                  没有理由时请把档案编号发给运营方索取;不要按猜测改内容后重复提交。
                </Text>
              ) : null}
            </View>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>关闭</Text>
            </AlertDialogCancel>
            <Button
              onPress={() => {
                const target = rejectTarget;
                setRejectTarget(null);
                if (target) reopenWithPrefill(target);
              }}
            >
              <Text>修改后重新提交</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 申请删除:二次确认 —— 先勾知悉,再点"确认删除"。 */}
      <AlertDialog open={Boolean(eraseTarget)} onOpenChange={(open) => !open && setEraseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>申请删除该档案?</AlertDialogTitle>
            <AlertDialogDescription>
              删除后档案转为 ERASED:姓名、照片、详细地址、联系电话等识别信息将被永久清除,
              不可恢复,也无法再从广场或搜索里找回。如只是想暂时不展示,请改用「撤回」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CheckboxField
            testID="erase-ack"
            label="我已知悉删除不可恢复"
            description={`档案:${eraseTarget?.name ?? ''}(编号 ${eraseTarget?.id ?? ''})`}
            checked={eraseAck}
            onCheckedChange={setEraseAck}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>取消</Text>
            </AlertDialogCancel>
            <Button variant="destructive" disabled={!eraseAck} onPress={() => void confirmErase()}>
              <Text>确认删除</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}

function CaseRow({
  item,
  busy,
  onView,
  onRejectReason,
  onRenew,
  onWithdraw,
  onSubmitDraft,
  onContinueEdit,
  onReopen,
  onFound,
  onErase,
}: {
  item: CaseDetail;
  busy: boolean;
  onView: () => void;
  onRejectReason: () => void;
  onRenew: () => void;
  onWithdraw: () => void;
  onSubmitDraft: () => void;
  onContinueEdit: () => void;
  onReopen: () => void;
  onFound: () => void;
  onErase: () => void;
}) {
  const history = item.statusHistory ?? [];
  return (
    <Card className="mb-3 p-4">
      <CardContent>
        <View className="flex-row gap-3">
          <RemoteImage
            uri={item.coverUrl}
            fallbackLabel="暂无照片"
            style={{ width: 64, height: 80 }}
            testID={`my-case-cover-${item.id}`}
          />
          <View className="flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-base font-semibold">{item.name}</Text>
              <CaseStatusBadge status={item.status} />
              <UrgencyBadge level={item.urgencyLevel} />
            </View>
            <Text className="text-muted-foreground mt-1 text-xs">
              {GENDER_LABEL[item.gender]} · {caseAgeText(item)} · {item.regionText || '地区未知'}
            </Text>
            <Text className="text-muted-foreground mt-0.5 text-xs">
              线索 {item.leadCount} · 版本 v{item.version} · 发布 {formatDateTime(item.publishTime)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看档案详情"
            onPress={onView}
            className="self-start p-1"
          >
            <Icon as={Eye} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>

        {item.status === 'REJECTED' && item.auditRemark ? (
          <Text className="text-urgent mt-2 text-xs" numberOfLines={2}>
            驳回:{item.auditRemark}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap gap-2">
          {item.status === 'DRAFT' ? (
            <>
              <Button testID={`case-edit-${item.id}`} size="sm" onPress={onContinueEdit}>
                <Text>续填草稿</Text>
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onPress={onSubmitDraft}>
                <Text>提交审核</Text>
              </Button>
            </>
          ) : null}

          {item.status === 'REJECTED' ? (
            <>
              <Button testID={`case-reject-${item.id}`} size="sm" variant="outline" onPress={onRejectReason}>
                <Text>查看驳回理由</Text>
              </Button>
              <Button testID={`case-reopen-${item.id}`} size="sm" disabled={busy} onPress={onReopen}>
                <Text>修改后重新提交</Text>
              </Button>
            </>
          ) : null}

          {item.status === 'PUBLISHED' ? (
            <>
              <Button testID={`case-renew-${item.id}`} size="sm" variant="outline" disabled={busy} onPress={onRenew}>
                <Text>续期</Text>
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onPress={onWithdraw}>
                <Text>撤回</Text>
              </Button>
            </>
          ) : null}

          {item.status === 'PUBLISHED' || item.status === 'ARCHIVED' ? (
            <Button testID={`case-found-${item.id}`} size="sm" disabled={busy} onPress={onFound}>
              <Text>标记找回</Text>
            </Button>
          ) : null}

          {item.status === 'PENDING_REVIEW' ? (
            <Text className="text-muted-foreground self-center text-xs">
              待审核:契约只提供「已发布 → 已撤回」,此处不可撤回,可改期后再操作。
            </Text>
          ) : null}

          {item.status !== 'ERASED' ? (
            <Button
              testID={`case-erase-${item.id}`}
              size="sm"
              variant="ghost"
              disabled={busy}
              onPress={onErase}
            >
              <Icon as={Trash2} size={14} className="text-urgent" />
              <Text>申请删除</Text>
            </Button>
          ) : null}
        </View>

        {item.status === 'ERASED' ? (
          <View className="flex-row items-center gap-1">
            <Icon as={ShieldAlert} size={13} className="text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">该档案已删除,仅保留编号供核。</Text>
          </View>
        ) : null}

        {history.length ? (
          <Text className="text-muted-foreground mt-2 text-xs">
            最近状态变更:{formatDateTime(history[history.length - 1]?.time)} →{' '}
            {CASE_STATUS_LABEL[history[history.length - 1]?.to ?? item.status]}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** 驳回理由的第二处来源:状态变更历史里进 REJECTED 那一条的 reason。 */
function rejectReasonFromHistory(item: CaseDetail): string | null {
  const changes = item.statusHistory ?? [];
  for (let index = changes.length - 1; index >= 0; index -= 1) {
    const change = changes[index];
    if (change?.to === 'REJECTED' && change.reason) return `${formatDateTime(change.time)}:${change.reason}`;
  }
  return null;
}
