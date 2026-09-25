/**
 * 广场卡片。脱敏字段完全来自 `CasePublic`,页面 MUST NOT 自行拼更细的地址或时间。
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { RemoteImage } from './RemoteImage';
import { MissingDuration, UrgencyBadge } from './status-badges';
import { GENDER_LABEL, caseAgeText, formatMissingMonth } from '@/lib/format';
import type { CasePublic } from '@/lib/api/endpoints/case';

export interface CaseCardProps {
  item: CasePublic;
  onPress: () => void;
  onLongPress?: () => void;
  /** 已收藏标记:必须给文字,不能只靠图标颜色(spec 无障碍要求)。 */
  favorited?: boolean;
}

export function CaseCard({ item, onPress, onLongPress, favorited }: CaseCardProps) {
  const urgent = item.urgencyLevel !== 'NORMAL';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`寻人档案 ${item.name}${onLongPress ? ',长按可收藏或取消收藏' : ''}`}
      className="mb-3 flex-row overflow-hidden rounded-xl border border-border bg-card"
    >
      <RemoteImage
        uri={item.coverUrl}
        fallbackLabel="暂无照片"
        style={{ width: 96, height: 120 }}
        testID={`case-card-cover-${item.id}`}
      />
      <View className="flex-1 p-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {GENDER_LABEL[item.gender]} · {caseAgeText(item)}
          </Text>
        </View>
        {item.aliases?.length ? (
          <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
            别名:{item.aliases.join('、')}
          </Text>
        ) : null}
        <Text className="mt-1 text-xs" numberOfLines={1}>
          {formatMissingMonth(item.missingMonth)} · {item.regionText || '地区未知'}
          {item.districtText ? ` ${item.districtText}` : ''}
        </Text>
        {item.features ? (
          <Text className="text-muted-foreground mt-1 text-xs" numberOfLines={2}>
            {item.features}
          </Text>
        ) : null}
        <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
          <UrgencyBadge level={item.urgencyLevel} />
          <MissingDuration hours={item.missingHours} urgent={urgent} />
          <View className="flex-1" />
          {favorited ? (
            <Badge variant="outline" className="border-found">
              <Text className="text-found">已收藏</Text>
            </Badge>
          ) : null}
          <Badge variant="outline">
            <Text>线索 {item.leadCount}</Text>
          </Badge>
        </View>
      </View>
    </Pressable>
  );
}
