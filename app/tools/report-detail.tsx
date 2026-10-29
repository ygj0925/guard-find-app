/**
 * 汇报详情:填报人提交状态列表(全成员可见)。
 * 我的行 → 填报/查看我的月报;他人行 → 阅读其月报+评论。
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SkeletonList } from '@/components/ui/skeleton-loader';
import { EmptyState, ErrorState } from '@/components/business/feedback';
import { fetchReportDetail, type ToolReport } from '@/lib/api/endpoints/report';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';

const STATUS_LABEL: Record<number, string> = { 0: '未开始', 1: '草稿', 2: '已提交' };

export default function ReportDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const activityId = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const myUserId = useSession((state) => state.user?.id ?? null);

  const query = useRequest(() => fetchReportDetail(activityId), [activityId, signedIn]);
  const activity = query.data;

  const openEntry = (reporter: NonNullable<ToolReport['reporters']>[number]) => {
    router.push(`/tools/report-entry?id=${activityId}&userId=${reporter.userId}` as never);
  };

  if (query.error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ErrorState error={query.error} onRetry={() => void query.reload()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-2xl font-bold">{activity?.title ?? '汇报'}</Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            周期 {activity?.period}
            {activity?.dueDate ? ` · 截止 ${activity.dueDate.slice(5, 16)}` : ''}
          </Text>
          {activity?.dueDate ? (
            <Text className="text-muted-foreground mt-0.5 text-xs">晚于截止提交会标记「迟交」</Text>
          ) : null}
        </View>

        {query.isInitialLoading || !activity ? (
          <SkeletonList rows={4} scheme={scheme} />
        ) : (
          <>
            <Text className="text-muted-foreground mb-2 text-xs font-semibold">
              填报状态({activity.submittedCount}/{activity.reporterCount})
            </Text>
            {(activity.reporters ?? []).length === 0 ? (
              <EmptyState title="还没有填报人" description="发起时指定填报人,或联系发起人添加" />
            ) : (
              (activity.reporters ?? []).map((reporter) => (
                <Pressable
                  key={reporter.userId}
                  accessibilityRole="button"
                  accessibilityLabel={`查看 ${reporter.nickname ?? ''} 的月报`}
                  onPress={() => openEntry(reporter)}
                  className="mb-2"
                >
                  <Card className="flex-row items-center p-3">
                    <Avatar alt={reporter.nickname ?? '成员'} className="size-10">
                      {reporter.avatar ? <AvatarImage source={{ uri: reporter.avatar }} /> : null}
                      <AvatarFallback>
                        <Text>{(reporter.nickname ?? '成').slice(0, 1)}</Text>
                      </AvatarFallback>
                    </Avatar>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-medium">
                        {reporter.nickname ?? '成员'}
                        {reporter.userId === myUserId ? '（我）' : ''}
                      </Text>
                      <Text className="text-muted-foreground mt-0.5 text-xs">
                        {STATUS_LABEL[reporter.entryStatus] ?? '未开始'}
                        {reporter.late ? ' · 迟交' : ''}
                      </Text>
                    </View>
                    <Text
                      className={`text-xs font-semibold ${
                        reporter.entryStatus === 2
                          ? 'text-found'
                          : reporter.entryStatus === 1
                            ? 'text-pending'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {STATUS_LABEL[reporter.entryStatus] ?? '未开始'}
                    </Text>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
