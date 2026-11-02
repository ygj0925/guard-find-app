/**
 * 房产详情:图片列表 + 全字段展示 + 联系按钮 + 上下架(仅房东)。
 */
import React, { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, MessageCircle, Phone } from 'lucide-react-native';

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
const TYPE_LABEL: Record<string, string> = { house: '住宅', apartment: '公寓', villa: '别墅', shop: '商铺' };

export default function PropertyDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';
  const router = useRouter();
  const myUserId = useSession((state) => state.user?.id ?? null);

  const query = useRequest(() => fetchPropertyDetail(id), [id]);
  const property = query.data;

  const [previewUri, setPreviewUri] = useState<string | null>(null);

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
              <Pressable key={uri} onPress={() => setPreviewUri(uri)}>
                <RemoteImage uri={uri} style={{ width: 280, height: 190, borderRadius: 12, marginRight: 8 }} />
              </Pressable>
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

        {property.contactPhone ? (
          <Card className="mt-3 p-4">
            <Text className="text-muted-foreground mb-2 text-xs font-semibold">联系方式</Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Icon as={Phone} size={14} className="text-primary" />
                <Text className="text-foreground text-sm">
                  {property.contactName ?? ''} {property.contactPhone ?? ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="拨打电话"
                onPress={() => Linking.openURL(`tel:${property.contactPhone}`)}
                className="bg-accent flex-row items-center rounded-full px-4 py-2"
                style={{ gap: 4 }}
              >
                <Icon as={Phone} size={14} className="text-accent-foreground" />
                <Text className="text-accent-foreground text-xs font-semibold">打电话</Text>
              </Pressable>
            </View>
            {property.userId !== myUserId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="发私信"
                onPress={() => router.push(`/im/chat?convId=&peerId=${property.userId}&peerName=${encodeURIComponent(property.contactName ?? '房东')}` as never)}
                className="mt-2 flex-row items-center"
                style={{ gap: 6 }}
              >
                <Icon as={MessageCircle} size={14} className="text-primary" />
                <Text className="text-primary text-xs font-semibold">发私信聊</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {property.userId === myUserId ? (
          <Button variant="outline" className="mt-4" onPress={() => router.back()}>
            <Text>返回管理</Text>
          </Button>
        ) : null}

        {/* 大图预览 */}
        <Modal visible={previewUri !== null} transparent onRequestClose={() => setPreviewUri(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' }} onPress={() => setPreviewUri(null)}>
            <RemoteImage uri={previewUri} style={{ width: '100%', height: 300 }} resizeMode="contain" />
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
