/**
 * 房产详情:图片列表 + 全字段展示 + 联系按钮 + 上下架(仅房东)。
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Phone } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RemoteImage } from '@/components/business/RemoteImage';
import { SkeletonList } from '@/components/ui/skeleton-loader';
import { ErrorState } from '@/components/business/feedback';
import { fetchPropertyDetail } from '@/lib/api/endpoints/property';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';

const TYPE_LABEL: Record<string, string> = { house: '住宅', apartment: '公寓', villa: '别墅', shop: '商铺' };

export default function PropertyDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const myUserId = useSession((state) => state.user?.id ?? null);

  const query = useRequest(() => fetchPropertyDetail(id), [id]);
  const property = query.data;

  if (query.error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ErrorState error={query.error} onRetry={() => void query.reload()} />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <SkeletonList rows={5} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        {/* 图片列表 */}
        {property.images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 mt-2">
            {property.images.map((uri) => (
              <RemoteImage key={uri} uri={uri} style={{ width: 280, height: 190, borderRadius: 12, marginRight: 8 }} />
            ))}
          </ScrollView>
        ) : (
          <View className="bg-muted mb-3 mt-2 h-48 w-full items-center justify-center rounded-xl">
            <Text className="text-muted-foreground text-sm">暂无图片</Text>
          </View>
        )}

        <Text className="text-foreground text-xl font-bold">{property.title}</Text>
        <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
          <Text className="text-urgent text-2xl font-bold">
            ¥{property.price}
            <Text className="text-muted-foreground text-sm font-normal">
              {property.priceType === 'rent' ? '/月' : ''}
            </Text>
          </Text>
          <Text className="text-muted-foreground text-sm">
            {TYPE_LABEL[property.propertyType] ?? ''} · {property.layout ?? ''} · {property.areaSqm ?? ''}㎡
          </Text>
        </View>

        {property.district || property.address ? (
          <View className="mt-2 flex-row items-center" style={{ gap: 4 }}>
            <Icon as={MapPin} size={14} className="text-primary" />
            <Text className="text-muted-foreground flex-1 text-xs">
              {[property.city, property.district, property.address].filter(Boolean).join(' ')}
            </Text>
          </View>
        ) : null}

        <View className="mt-3 flex-row flex-wrap" style={{ gap: 6 }}>
          {property.floorInfo ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.floorInfo}层</Text> : null}
          {property.orientation ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.orientation}</Text> : null}
          {property.decoration ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.decoration}</Text> : null}
          <Text className="bg-muted rounded-full px-3 py-1 text-xs">浏览 {property.viewCount}</Text>
        </View>

        {property.description ? (
          <Card className="mt-4 p-4">
            <Text className="text-muted-foreground mb-1 text-xs font-semibold">房源描述</Text>
            <Text className="text-foreground text-sm leading-5">{property.description}</Text>
          </Card>
        ) : null}

        {property.facilities.length > 0 ? (
          <Card className="mt-3 p-4">
            <Text className="text-muted-foreground mb-2 text-xs font-semibold">配套设施</Text>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {property.facilities.map((f) => (
                <Text key={f} className="bg-muted rounded-full px-3 py-1 text-xs">{f}</Text>
              ))}
            </View>
          </Card>
        ) : null}

        {property.contactName || property.contactPhone ? (
          <Card className="mt-3 p-4">
            <Text className="text-muted-foreground mb-2 text-xs font-semibold">联系方式</Text>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Icon as={Phone} size={14} className="text-primary" />
              <Text className="text-foreground text-sm">
                {property.contactName ?? ''} {property.contactPhone ?? ''}
              </Text>
            </View>
          </Card>
        ) : null}

        {property.userId === myUserId ? (
          <Button variant="outline" className="mt-4" onPress={() => router.back()}>
            <Text>返回管理</Text>
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
