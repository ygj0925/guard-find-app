/**
 * 我的线索(spec: 我的线索与收藏入口 / 契约 4 节 `GET /app/lead/mine`)。
 *
 * 这里列的是"我提交出去的线索"以及对方(档案所有人)的处置结果:
 * `status` 由家属侧改写,页面只读展示,不提供任何改状态或回复的入口 —— 那是档案所有人的动作。
 * 分页用 `useFeed` 承载页码游标,顺带拿到四态与竞态丢弃;没有线索时给"去广场"的可点引导。
 */
import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { HighRiskBadge, LeadStatusBadge } from '@/components/business/status-badges';
import { EmptyState, ErrorState, InlineRow, ListFooter, NoticeBar } from '@/components/business/feedback';
import { useFeed } from '@/hooks/useFeed';
import { leadApi, type Lead } from '@/lib/api/endpoints/lead';
import type { FeedResp } from '@/lib/api/endpoints/common';
import { LEAD_STATUS_LABEL, formatDateTime, formatRelative } from '@/lib/format';
import { useSessionGuard } from '@/providers/SessionProvider';

const PAGE_SIZE = 10;

export default function MyLeadsScreen() {
  const router = useRouter();
  const { guard, signedIn } = useSessionGuard();

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<FeedResp<Lead>> => {
      if (!signedIn) return { records: [], nextCursor: null, hasMore: false };
      const page = cursor ? Number(cursor) : 1;
      const resp = await leadApi.mine({ page, size: PAGE_SIZE });
      const records = resp?.records ?? [];
      const hasMore = page * PAGE_SIZE < (resp?.total ?? 0) && records.length > 0;
      return { records, nextCursor: hasMore ? String(page + 1) : null, hasMore };
    },
    [signedIn],
  );

  const feed = useFeed<Lead>('my-leads', fetchPage, ['my-leads', signedIn]);
  const pendingCount = useMemo(
    () => feed.items.filter((lead) => lead.status === 'PENDING').length,
    [feed.items],
  );

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-4">
          <NoticeBar
            tone="info"
            title="登录后查看我提交的线索"
            lines={['线索的采纳、联系与忽略结果只会发给提交人本人。']}
          />
          <Button testID="leads-login" onPress={() => guard({ href: '/me/leads', label: 'my-leads' })}>
            <Text>去登录</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
        <Text className="text-base font-semibold">我提交的线索</Text>
        <Text className="text-muted-foreground text-xs">
          已载 {feed.items.length} 条 · 待处理 {pendingCount}
        </Text>
      </View>

      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        data={feed.items}
        keyExtractor={(lead) => lead.id}
        renderItem={({ item }) => (
          <LeadRow lead={item} onOpenCase={() => router.push(`/case/${item.caseId}`)} />
        )}
        ListHeaderComponent={
          feed.showSkeleton ? (
            <View className="pt-2">
              <Skeleton className="mb-3 h-36 rounded-xl" />
              <Skeleton className="mb-3 h-36 rounded-xl" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          feed.showSkeleton || feed.error ? null : (
            <EmptyState
              title="还没有提交过线索"
              description="在广场看到与身边情况相符的档案,进入详情点「提交线索」;家属处理后会在这里告诉你结果。"
              actionLabel="去广场看看"
              onAction={() => router.replace('/(tabs)/plaza')}
            />
          )
        }
        ListFooterComponent={
          feed.items.length ? (
            <ListFooter
              loading={feed.phase === 'loadingMore'}
              hasMore={feed.hasMore}
              error={feed.error}
              onRetry={() => void feed.loadMore()}
            />
          ) : null
        }
        onEndReached={() => {
          if (feed.hasMore && feed.phase === 'idle') void feed.loadMore();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={feed.phase === 'refreshing'}
            onRefresh={() => void feed.refresh()}
          />
        }
      />
    </SafeAreaView>
  );
}

function LeadRow({ lead, onOpenCase }: { lead: Lead; onOpenCase: () => void }) {
  const replies = lead.replies ?? [];
  return (
    <Card className="mb-3 p-4">
      <CardContent>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold">{lead.caseName || '寻人档案'}</Text>
          <LeadStatusBadge status={lead.status} />
          {lead.highRisk ? <HighRiskBadge /> : null}
          <View className="flex-1" />
          <Text className="text-muted-foreground text-xs">{formatRelative(lead.createTime)}</Text>
        </View>

        <View className="mt-2">
          <InlineRow label="发现时间" value={formatDateTime(lead.occurTime)} />
          <InlineRow label="发现地点" value={lead.occurAddress} selectable />
          <InlineRow label="我的描述" value={lead.description} selectable />
          <InlineRow
            label="我的联络"
            value={lead.contactMode === 'PHONE' ? '公开电话(仅档案所有人可见)' : '仅 App 内转达'}
          />
          <InlineRow
            label="当前状态"
            value={`${formatDateTime(lead.createTime)} 提交 · ${LEAD_STATUS_LABEL[lead.status]}`}
          />
        </View>

        {replies.length ? (
          <View className="bg-muted mt-2 rounded-md p-2">
            {replies.map((reply) => (
              <Text key={reply.id} className="mt-1 text-xs leading-4">
                {`${reply.from === 'OWNER' ? '家属' : '我'} ${formatDateTime(reply.time)}:${reply.content}`}
              </Text>
            ))}
          </View>
        ) : (
          <Text className="text-muted-foreground mt-2 text-xs">家属还没有回复这条线索。</Text>
        )}

        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button testID={`lead-open-case-${lead.id}`} size="sm" variant="outline" onPress={onOpenCase}>
            <Icon as={MessageSquare} size={14} />
            <Text>查看该档案</Text>
          </Button>
          {lead.contactMode === 'PHONE' ? (
            <Badge variant="outline">
              <Text>号码不在此页回显</Text>
            </Badge>
          ) : null}
        </View>
      </CardContent>
    </Card>
  );
}
