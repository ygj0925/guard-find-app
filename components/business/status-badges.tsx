/**
 * 状态与紧急度标记。
 *
 * 无障碍硬约束(spec 卡片要求):紧急程度 MUST NOT 只靠颜色区分,
 * 每个色块都必须同时给出文字,并且倒计时要用分钟粒度自己推进,不能只渲染服务端快照。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import {
  CASE_STATUS_LABEL,
  LEAD_STATUS_LABEL,
  URGENCY_LABEL,
  formatMissingHours,
} from '@/lib/format';
import type { CaseStatus, UrgencyLevel } from '@/lib/api/endpoints/case';
import type { LeadStatus } from '@/lib/api/endpoints/lead';

const CASE_STATUS_TONE: Record<CaseStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_REVIEW: 'outline',
  PUBLISHED: 'default',
  REJECTED: 'destructive',
  ARCHIVED: 'secondary',
  FOUND: 'default',
  WITHDRAWN: 'secondary',
  OFFLINE: 'secondary',
  ERASED: 'destructive',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const isFound = status === 'FOUND';
  return (
    <Badge
      variant={CASE_STATUS_TONE[status]}
      className={
        isFound
          ? 'bg-found'
          : status === 'REJECTED' || status === 'ERASED'
            ? 'bg-urgent'
            : undefined
      }
    >
      <Text>{CASE_STATUS_LABEL[status] ?? status}</Text>
    </Badge>
  );
}

export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  if (level === 'NORMAL') return null;
  return (
    <Badge variant="destructive" className="bg-urgent">
      <Text>{URGENCY_LABEL[level]}</Text>
    </Badge>
  );
}

/**
 * 已失踪时长。服务端给的是"取数时刻的整数小时",这里按分钟推进,
 * 保证用户停在页面上时数字会自己走,而不是永远停在 18720。
 */
export function MissingDuration({
  hours,
  fetchedAt = Date.now(),
  urgent,
}: {
  hours: number | null | undefined;
  fetchedAt?: number;
  urgent?: boolean;
}) {
  const elapsed = useElapsedHours(hours, fetchedAt);
  return (
    <View className="flex-row items-center gap-1">
      <Text className={`text-xs font-medium ${urgent ? 'text-urgent' : 'text-muted-foreground'}`}>
        {formatMissingHours(elapsed)}
      </Text>
    </View>
  );
}

/** 每 30 秒重算一次经过的小时数;分钟级足够,再快只是白烧渲染。 */
export function useElapsedHours(baseHours: number | null | undefined, fetchedAt: number): number {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (baseHours === null || baseHours === undefined) return undefined;
    const timer = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [baseHours, fetchedAt]);

  return useMemo(() => {
    if (baseHours === null || baseHours === undefined) return 0;
    const extra = Math.max(0, Date.now() - fetchedAt) / 3_600_000;
    return Math.floor(baseHours + extra);
  }, [baseHours, fetchedAt]);
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge
      variant={status === 'REJECTED' ? 'destructive' : status === 'PENDING' ? 'outline' : 'default'}
    >
      <Text>{LEAD_STATUS_LABEL[status]}</Text>
    </Badge>
  );
}

/** 高风险线索:必须"待核实"三字 + 警示色,不能与普通线索混排(spec 场景)。 */
export function HighRiskBadge() {
  return (
    <Badge variant="destructive" className="bg-pending">
      <Text className="text-pending-foreground">待核实</Text>
    </Badge>
  );
}
