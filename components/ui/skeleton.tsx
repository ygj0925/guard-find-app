import { cn } from '@/lib/utils';
import { View } from 'react-native';

function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('bg-accent animate-pulse rounded-md', className)} {...props} />;
}

/** 卡片列表骨架:形状匹配 SectionCard 列表(头像行 + 两行文字)。 */
function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} className="bg-card border-border flex-row items-center rounded-xl border p-3" style={{ gap: 12 }}>
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
function SkeletonSummary() {
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

export { Skeleton, SkeletonList, SkeletonSummary };
