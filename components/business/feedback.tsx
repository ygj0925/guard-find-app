/**
 * 通用反馈态与容器。四态(加载 / 空 / 失败可重试 / 无更多)在广场、搜索、消息、
 * 我的档案里反复出现,统一在这里出,避免每页各写一套文案。
 */
import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toUserMessage } from '@/lib/api/error';

export function SectionCard({
  title,
  description,
  right,
  children,
  className,
}: {
  title?: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className ?? 'mb-3 p-4'}>
      {title || right ? (
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-1">
            {title ? <Text className="text-base font-semibold">{title}</Text> : null}
            {description ? (
              <Text className="text-muted-foreground mt-1 text-xs">{description}</Text>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

/** 常驻提示条:防骗告知、能力降级说明都走它,不允许只在出错时出现一次。 */
export function NoticeBar({
  tone = 'info',
  title,
  lines,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success';
  title: string;
  lines?: string[];
}) {
  return (
    <View className={`mb-3 rounded-lg border p-3 ${TONE_CLASS[tone]}`}>
      <Text className="text-sm font-semibold">{title}</Text>
      {lines?.map((line) => (
        <Text key={line} className="mt-1 text-xs leading-4 opacity-90">
          {line}
        </Text>
      ))}
    </View>
  );
}

const TONE_CLASS: Record<'info' | 'warn' | 'danger' | 'success', string> = {
  info: 'border-primary/25 bg-primary/10 text-foreground',
  warn: 'border-pending/40 bg-pending/10 text-foreground',
  danger: 'border-urgent/40 bg-urgent/10 text-foreground',
  success: 'border-found/40 bg-found/10 text-foreground',
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center px-8 py-14">
      <Text className="text-center text-base font-semibold">{title}</Text>
      {description ? (
        <Text className="text-muted-foreground mt-2 text-center text-sm leading-5">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View className={compact ? 'py-4' : 'items-center px-8 py-12'}>
      <Text className={compact ? 'text-sm text-urgent' : 'text-center text-base font-semibold'}>
        {compact ? toUserMessage(error) : '加载失败'}
      </Text>
      {compact ? null : (
        <Text className="text-muted-foreground mt-2 text-center text-sm">
          {toUserMessage(error)}
        </Text>
      )}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onPress={onRetry}>
          <Text>重试</Text>
        </Button>
      ) : null}
    </View>
  );
}

/** 列表底部:加载中 / 已加载全部 / 触底失败可重试。 */
export function ListFooter({
  loading,
  hasMore,
  error,
  onRetry,
  empty,
}: {
  loading: boolean;
  hasMore: boolean;
  error?: unknown | null;
  onRetry?: () => void;
  empty?: boolean;
}) {
  if (error && !empty) {
    return (
      <Pressable onPress={onRetry} className="py-4">
        <Text className="text-center text-xs text-urgent">
          {toUserMessage(error)} · 点击重试
        </Text>
      </Pressable>
    );
  }
  if (loading) {
    return (
      <View className="flex-row items-center justify-center gap-2 py-4">
        <ActivityIndicator size="small" />
        <Text className="text-muted-foreground text-xs">加载中</Text>
      </View>
    );
  }
  if (!hasMore && !empty) {
    return (
      <View className="py-4">
        <Text className="text-muted-foreground text-center text-xs">已加载全部</Text>
      </View>
    );
  }
  return null;
}

export function RefreshingControl(refreshing: boolean, onRefresh: () => void) {
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;
}

export function InlineRow({
  label,
  value,
  selectable,
}: {
  label: string;
  value: React.ReactNode;
  selectable?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text className="text-muted-foreground w-24 text-sm">{label}</Text>
      <View className="flex-1">
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text selectable={selectable} className="text-sm">
            {String(value)}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
});
