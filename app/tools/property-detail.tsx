/**
 * 房产详情:图片列表 + 全字段展示 + 收藏/预约/联系 + 上下架(仅房东)。
 */
import React, { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarCheck, Heart, MapPin, MessageCircle, Phone } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RemoteImage } from '@/components/business/RemoteImage';
import { SkeletonList } from '@/components/ui/skeleton-loader';
import { ErrorState } from '@/components/business/feedback';
import { createBooking, fetchPropertyDetail, toggleFavorite } from '@/lib/api/endpoints/property';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
const TYPE_LABEL: Record<string, string> = { house: '住宅', apartment: '公寓', villa: '别墅', shop: '商铺' };

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
function bookingDate(offsetDays: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(hour)}:00:00`;
}

export default function PropertyDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const myUserId = useSession((state) => state.user?.id ?? null);

  const query = useRequest(() => fetchPropertyDetail(id), [id]);
  const property = query.data;

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [favorited, setFavorited] = useState<boolean | null>(null);
  const [favBusy, setFavBusy] = useState(false);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState(1);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isFavorited = favorited ?? (property?.isFavorited === true);

  const onToggleFavorite = async () => {
    if (favBusy) return;
    setFavBusy(true);
    try {
      const next = await toggleFavorite(id);
      setFavorited(next);
      toast(next ? '已收藏' : '已取消收藏', 'success');
    } catch {
      toast('操作失败,请稍后再试', 'error');
    } finally {
      setFavBusy(false);
    }
  };

  const onBooking = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      toast('请填写联系人和电话', 'error');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const slotHours = [10, 14, 18];
      await createBooking(id, {
        bookingTime: bookingDate(dayIdx, slotHours[slotIdx]),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        remark: remark.trim() || undefined,
      });
      setBookingVisible(false);
      toast('预约成功,等待房东确认', 'success');
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '预约失败,请稍后再试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (query.error) {
    return (
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
        <ErrorState error={query.error} onRetry={() => void query.reload()} />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
        <SkeletonList rows={5} />
      </SafeAreaView>
    );
  }

  const isMine = property.userId === myUserId;

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
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

        <View className="flex-row items-start justify-between">
          <Text className="text-foreground shrink grow text-xl font-bold">{property.title}</Text>
          {/* 收藏 */}
          <Pressable accessibilityRole="button" accessibilityLabel={isFavorited ? '取消收藏' : '收藏'}
            onPress={() => void onToggleFavorite()} className="ml-2 p-1">
            <Icon as={Heart} size={22}
              className={isFavorited ? 'text-urgent' : 'text-muted-foreground'}
              fill={isFavorited ? token('urgent', scheme) : 'transparent'} />
          </Pressable>
        </View>
        <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="text-urgent text-2xl font-bold">
              ¥{property.price}
              <Text className="text-muted-foreground text-sm font-normal">
                {property.priceType === 'rent' ? '/月' : ''}
              </Text>
            </Text>
            {property.ownerIsManager ? (
              <View className="bg-accent rounded-full px-2 py-0.5">
                <Text className="text-accent-foreground text-[10px] font-bold">认证管家</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-muted-foreground flex-1 text-sm" numberOfLines={1}>
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
          {property.community ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.community}</Text> : null}
          {property.rentalMode ? (
            <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.rentalMode === 'whole' ? '整租' : '合租'}</Text>
          ) : null}
          {property.floorInfo ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.floorInfo}层</Text> : null}
          {property.orientation ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.orientation}</Text> : null}
          {property.decoration ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{property.decoration}</Text> : null}
          {property.availableFrom ? <Text className="bg-muted rounded-full px-3 py-1 text-xs">{String(property.availableFrom).slice(0, 10)} 可入住</Text> : null}
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

        {property.contactPhone || !isMine ? (
          <Card className="mt-3 p-4">
            <Text className="text-muted-foreground mb-2 text-xs font-semibold">联系方式</Text>
            {property.contactPhone ? (
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
            ) : null}
            {!isMine ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="发私信"
                onPress={() => router.push(`/im/chat?peerId=${property.userId}&peerName=${encodeURIComponent(property.contactName ?? '房东')}` as never)}
                className="mt-2 flex-row items-center"
                style={{ gap: 6 }}
              >
                <Icon as={MessageCircle} size={14} className="text-primary" />
                <Text className="text-primary text-xs font-semibold">发私信聊</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {/* 预约看房(非本人 + 已上架) */}
        {!isMine && property.status === 2 ? (
          <Button className="mt-4" onPress={() => setBookingVisible(true)}>
            <Icon as={CalendarCheck} size={16} className="text-primary-foreground" />
            <Text className="text-primary-foreground">预约看房</Text>
          </Button>
        ) : null}

        {isMine ? (
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

        {/* 预约弹窗 */}
        <Modal visible={bookingVisible} transparent animationType="slide" onRequestClose={() => setBookingVisible(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setBookingVisible(false)}>
            <Pressable style={{ backgroundColor: token('card', scheme), borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }} onPress={(e) => e.stopPropagation()}>
              <Text className="text-foreground text-base font-bold">预约看房</Text>
              <Text className="text-muted-foreground mt-1 text-xs">选择看房时间,房东确认后即可赴约</Text>

              {/* 日期:今天/明天/后天 */}
              <Text className="text-muted-foreground mt-4 mb-2 text-xs font-semibold">日期</Text>
              <View className="flex-row" style={{ gap: 8 }}>
                {['今天', '明天', '后天'].map((label, i) => {
                  const active = dayIdx === i;
                  return (
                    <Pressable key={label} accessibilityRole="button" accessibilityLabel={`预约日期${label}`}
                      onPress={() => setDayIdx(i)}
                      className="flex-1 items-center rounded-xl border py-2"
                      style={{
                        borderColor: active ? token('primary', scheme) : token('border', scheme),
                        backgroundColor: active ? token('accent', scheme) : 'transparent',
                      }}>
                      <Text className={`text-xs font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 时间段 */}
              <Text className="text-muted-foreground mt-3 mb-2 text-xs font-semibold">时间段</Text>
              <View className="flex-row" style={{ gap: 8 }}>
                {['上午 10:00', '下午 14:00', '傍晚 18:00'].map((label, i) => {
                  const active = slotIdx === i;
                  return (
                    <Pressable key={label} accessibilityRole="button" accessibilityLabel={`预约时间${label}`}
                      onPress={() => setSlotIdx(i)}
                      className="flex-1 items-center rounded-xl border py-2"
                      style={{
                        borderColor: active ? token('primary', scheme) : token('border', scheme),
                        backgroundColor: active ? token('accent', scheme) : 'transparent',
                      }}>
                      <Text className={`text-xs font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 联系方式 */}
              <Input
                className="mt-4"
                placeholder="联系人姓名"
                value={contactName}
                onChangeText={setContactName}
                accessibilityLabel="预约联系人"
              />
              <Input
                className="mt-2"
                placeholder="联系电话"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                accessibilityLabel="预约联系电话"
              />
              <Input
                className="mt-2"
                placeholder="备注(选填,如想了解周边配套)"
                value={remark}
                onChangeText={setRemark}
                accessibilityLabel="预约备注"
              />

              <View className="mt-4 flex-row" style={{ gap: 10 }}>
                <Button variant="outline" className="flex-1" onPress={() => setBookingVisible(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="flex-1" disabled={submitting} onPress={() => void onBooking()}>
                  <Text className="text-primary-foreground">{submitting ? '提交中…' : '确认预约'}</Text>
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
