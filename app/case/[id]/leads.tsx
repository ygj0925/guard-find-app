/**
 * 家属侧线索列表(spec: 家属侧线索列表与处置 / 契约 4 节)。
 *
 * 权限:接口只放行"档案所有人 / 志愿者",越权时服务端回 403 ——
 * 页面必须显示无权限态且 NOT 渲染任何线索内容(包括缓存)。
 *
 * 高风险线索(`highRisk`)排在其群组内并给"待核实"三字徽标 + 防骗提示,
 * 不允许只靠颜色区分,也不与普通线索混成一样(spec 场景)。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ArrowDownUp } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, TextField } from '@/components/form/fields';
import { RemoteImage } from '@/components/business/RemoteImage';
import { HighRiskBadge, LeadStatusBadge } from '@/components/business/status-badges';
import { EmptyState, ErrorState, InlineRow, ListFooter, NoticeBar } from '@/components/business/feedback';
import { useRequest } from '@/hooks/useRequest';
import { leadApi, type Lead, type LeadStatus } from '@/lib/api/endpoints/lead';
import { ApiError, toUserMessage } from '@/lib/api/error';
import { formatDateTime, formatRelative, leadHighRiskText, toServerTime } from '@/lib/format';
import { useToast } from '@/providers/ToastProvider';

const PAGE_SIZE = 10;

const STATUS_ACTIONS: { status: Exclude<LeadStatus, 'PENDING'>; label: string }[] = [
  { status: 'ACCEPTED', label: '采纳' },
  { status: 'CONTACTED', label: '已联系' },
  { status: 'REJECTED', label: '忽略' },
];

export default function CaseLeadsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = Array.isArray(id) ? id[0] : id;
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [ascending, setAscending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const request = useRequest(
    () => leadApi.byCase(caseId, { page, size: PAGE_SIZE }),
    [caseId, page],
    {
      // 分页合并写在数据落地回调里:它随本次响应触发(异步续体),
      // 不再放在 effect 同步体里写 state,避免每次拿到数据都多一轮渲染。
      onData: (data) => {
        setTotal(data.total ?? 0);
        setItems((current) => {
          const base = page === 1 ? [] : current;
          const seen = new Set(base.map((lead) => lead.id));
          const merged = base.slice();
          for (const lead of data.records ?? []) {
            if (seen.has(lead.id)) continue;
            seen.add(lead.id);
            merged.push(lead);
          }
          return merged;
        });
      },
    },
  );

  const forbidden = request.error instanceof ApiError && request.error.code === 403;
  const ordered = useMemo(
    () =>
      [...items].sort((a, b) => {
        const diff = (b.createTime ?? '').localeCompare(a.createTime ?? '');
        return ascending ? -diff : diff;
      }),
    [ascending, items],
  );
  const highRiskCount = items.filter((lead) => lead.highRisk).length;
  const hasMore = items.length < total;

  const markStatus = useCallback(
    async (lead: Lead, status: Exclude<LeadStatus, 'PENDING'>) => {
      setActionError(null);
      setBusy(true);
      try {
        await leadApi.updateStatus(lead.id, { status });
        setItems((current) =>
          current.map((current2) => (current2.id === lead.id ? { ...current2, status } : current2)),
        );
        toast(`线索已标记为${status === 'ACCEPTED' ? '采纳' : status === 'CONTACTED' ? '已联系' : '忽略'}`, 'success');
      } catch (error) {
        setActionError(toUserMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const sendReply = useCallback(async () => {
    if (!replyTarget) return;
    const content = replyText.trim();
    if (!content || content.length > 500) {
      setActionError('回复内容需为 1–500 字');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await leadApi.reply(replyTarget, content);
      setItems((current) =>
        current.map((lead) =>
          lead.id === replyTarget
            ? {
                ...lead,
                replies: [
                  ...(lead.replies ?? []),
                  {
                    id: `local-${Date.now()}`,
                    content,
                    from: 'OWNER',
                    time: toServerTime(new Date()),
                  },
                ],
              }
            : lead,
        ),
      );
      setReplyTarget(null);
      setReplyText('');
      toast('回复已送出', 'success');
    } catch (error) {
      setActionError(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  }, [replyTarget, replyText, toast]);

  if (forbidden) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <EmptyState
          title="没有权限查看线索"
          description="线索列表只对档案本人与已认证志愿者开放。若你是家属但看到这条提示,请联系运营方核对账号身份。"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-base font-semibold">线索({total || items.length})</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAscending((current) => !current)}
          className="border-border flex-row items-center gap-1 rounded-md border px-2 py-1"
        >
          <Icon as={ArrowDownUp} size={13} className="text-muted-foreground" />
          <Text className="text-muted-foreground text-xs">
            {ascending ? '最早在前' : '最新在前'}
          </Text>
        </Pressable>
      </View>

      {highRiskCount ? (
        <View className="px-4">
          <NoticeBar
            tone="danger"
            title={`${highRiskCount} 条线索标记为"待核实"`}
            lines={['请先自行核实,任何要求转账、垫付、缴纳核实费的都是诈骗。']}
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

      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        data={ordered}
        keyExtractor={(lead) => lead.id}
        ListEmptyComponent={
          request.isInitialLoading ? (
            <View>
              <Skeleton className="mb-3 h-40 rounded-xl" />
              <Skeleton className="mb-3 h-40 rounded-xl" />
            </View>
          ) : request.error ? (
            <ErrorState error={request.error} onRetry={() => void request.reload()} />
          ) : (
            <EmptyState
              title="还没有收到线索"
              description="可先分享档案,让更多人看到;新线索到达时会通过站内信通知你。"
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={request.status === 'loading' && page > 1}
            hasMore={hasMore}
            error={items.length ? request.error : null}
            onRetry={() => void request.reload()}
            empty={!ordered.length}
          />
        }
        onEndReached={() => {
          if (hasMore && request.status !== 'loading') setPage((current) => current + 1);
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={page === 1 && request.status === 'loading' && items.length > 0}
            onRefresh={() => void request.reload()}
          />
        }
        renderItem={({ item: lead }) => (
          <LeadCard
            lead={lead}
            busy={busy}
            expanded={replyTarget === lead.id}
            replyText={replyText}
            onReplyText={setReplyText}
            onOpenReply={() => setReplyTarget((current) => (current === lead.id ? null : lead.id))}
            onStatus={(status) => void markStatus(lead, status)}
            onSendReply={() => void sendReply()}
          />
        )}
      />
    </SafeAreaView>
  );
}

function LeadCard({
  lead,
  busy,
  expanded,
  replyText,
  onReplyText,
  onOpenReply,
  onStatus,
  onSendReply,
}: {
  lead: Lead;
  busy: boolean;
  expanded: boolean;
  replyText: string;
  onReplyText: (next: string) => void;
  onOpenReply: () => void;
  onStatus: (status: Exclude<LeadStatus, 'PENDING'>) => void;
  onSendReply: () => void;
}) {
  return (
    <Card className="mb-3 p-4">
      <CardContent>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold">{lead.submitterMasked || '好心人'}</Text>
          <LeadStatusBadge status={lead.status} />
          {lead.highRisk ? <HighRiskBadge /> : null}
          <View className="flex-1" />
          <Text className="text-muted-foreground text-xs">{formatRelative(lead.createTime)}</Text>
        </View>

        {lead.highRisk ? (
          <Text className="text-pending mt-1 text-xs">{leadHighRiskText(lead)}:请先自行核实再联系对方</Text>
        ) : null}

        <View className="mt-2">
          <InlineRow label="发现时间" value={formatDateTime(lead.occurTime)} />
          <InlineRow label="发现地点" value={lead.occurAddress} selectable />
          <InlineRow label="描述" value={lead.description} selectable />
          <InlineRow
            label="联络方式"
            value={
              lead.contactMode === 'PHONE'
                ? lead.contactValue
                  ? `电话 ${lead.contactValue}`
                  : '电话(仅所有人可见,服务端未下发)'
                : '仅 App 内转达'
            }
            selectable
          />
        </View>

        {lead.mediaUrls?.length ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {lead.mediaUrls.map((url) => (
              <RemoteImage
                key={url}
                uri={url}
                fallbackLabel="图片不可见"
                style={{ width: 72, height: 72 }}
              />
            ))}
          </View>
        ) : null}

        {lead.replies?.length ? (
          <View className="bg-muted mt-2 rounded-md p-2">
            {lead.replies.map((reply) => (
              <Text key={reply.id} className="mt-1 text-xs leading-4">
                {`${reply.from === 'OWNER' ? '家属' : '提交人'} ${formatDateTime(reply.time)}:${reply.content}`}
              </Text>
            ))}
          </View>
        ) : null}

        <View className="mt-3 flex-row flex-wrap gap-2">
          {STATUS_ACTIONS.map((action) => (
            <Button
              key={action.status}
              testID={`lead-status-${action.status}`}
              variant={lead.status === action.status ? 'default' : 'outline'}
              size="sm"
              disabled={busy}
              onPress={() => onStatus(action.status)}
            >
              <Text>{action.label}</Text>
            </Button>
          ))}
          <Button variant="ghost" size="sm" onPress={onOpenReply}>
            <Text>{expanded ? '收起回复' : '回复'}</Text>
          </Button>
        </View>

        {expanded ? (
          <View className="mt-2">
            <Field label="回复内容" hint="1–500 字,仅该线索提交人可见">
              <TextField
                label=""
                value={replyText}
                multiline
                maxLength={500}
                testID="lead-reply-input"
                onChangeText={onReplyText}
              />
            </Field>
            <Button size="sm" disabled={busy} onPress={onSendReply}>
              <Text>{busy ? '处理中' : '发送回复'}</Text>
            </Button>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
