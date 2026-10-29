/**
 * 骨架屏(Loading 状态规范):形状匹配最终布局的占位。
 * 替代"加载中…"文字与通用圆形 spinner。
 */
import React from 'react';
import { View } from 'react-native';

/** 单条骨架。 */
export function Skeleton({ className, scheme = 'light' }: { className?: string; scheme?: 'light' | 'dark' }) {
  return <View className={`overflow-hidden rounded-md bg-muted ${className ?? 'h-4 w-full'}`} />;
}

/** 卡片列表骨架:形状匹配卡片列表(头像行 + 两行文字)。 */
export function SkeletonList({ rows = 3, scheme = 'light' }: { rows?: number; scheme?: 'light' | 'dark' }) {
  void scheme;
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          className="bg-card border-border flex-row items-center rounded-xl border p-3"
          style={{ gap: 12 }}
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <View className="flex-1" style={{ gap: 6 }}>
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** 汇总卡骨架:三列数值占位。 */
export function SkeletonSummary({ scheme = 'light' }: { scheme?: 'light' | 'dark' }) {
  void scheme;
  return (
    <View className="bg-card border-border rounded-xl border p-4">
      <Skeleton className="h-3 w-24" />
      <View className="mt-3 flex-row" style={{ gap: 12 }}>
        {Array.from({ length: 3 }, (_, index) => (
          <View key={index} className="flex-1" style={{ gap: 6 }}>
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-16" />
          </View>
        ))}
      </View>
    </View>
  );
}
