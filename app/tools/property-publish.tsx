/**
 * 房产发布/编辑:图片上传 + 全字段表单 + 保存草稿/直接上架。
 * 编辑模式通过路由参数 id 进入。
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/fields';
import { RemoteImage } from '@/components/business/RemoteImage';
import { RegionPicker, type RegionSelection } from '@/components/business/pickers';
import { createProperty, fetchPropertyDetail, updateProperty, type PropertyType, type PriceType } from '@/lib/api/endpoints/property';
import { uploadApi } from '@/lib/api/endpoints/upload';
import { imagePicker } from '@/lib/capabilities';
import { useRequest } from '@/hooks/useRequest';
import { useToast } from '@/providers/ToastProvider';
import { useFilters } from '@/providers/FiltersProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

const MAX_IMAGES = 9;
const TYPES: { key: PropertyType; label: string }[] = [
  { key: 'house', label: '住宅' }, { key: 'apartment', label: '公寓' },
  { key: 'villa', label: '别墅' }, { key: 'shop', label: '商铺' },
];
const DECORATIONS = ['毛坯', '简装', '精装', '豪装'];
const FACILITIES = ['电梯', '停车位', '阳台', '洗衣机', '空调', '热水器', '宽带', '冰箱'];

export default function PropertyPublishScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ?? null;
  const router = useRouter();
  const { toast } = useToast();
  const { regionLabel } = useFilters();
  const scheme = useColorScheme() ?? 'light';

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // 编辑模式回填:通过 useRequest onData 回调,避免 effect 内同步 setState
  useRequest(
    () => (editId ? fetchPropertyDetail(editId) : Promise.resolve(null)),
    [editId],
    {
      onData: (data) => {
        if (!data || data.title === undefined || data.title === null) return;
        setTitle(data.title); setDescription(data.description ?? '');
        setPropertyType(data.propertyType as PropertyType);
        setLayout(data.layout ?? ''); setAreaSqm(data.areaSqm ? String(data.areaSqm) : '');
        setFloorInfo(data.floorInfo ?? ''); setOrientation(data.orientation ?? '');
        setDecoration(data.decoration ?? '精装'); setPrice(String(data.price));
        setPriceType(data.priceType as PriceType); setAddress(data.address);
        // 区划码未随房源存档,编辑态只回显文本,重新选择后再带码
        setRegion({ provinceCode: null, cityCode: null, districtCode: null, label: [data.city, data.district].filter(Boolean).join(' ') });
        setContactName(data.contactName ?? ''); setContactPhone(data.contactPhone ?? '');
        setCommunity(data.community ?? '');
        setAvailableFrom(data.availableFrom ? String(data.availableFrom).slice(0, 10) : '');
        setRentalMode(data.rentalMode === 'whole' || data.rentalMode === 'shared' ? data.rentalMode : '');
        setSelectedFacilities(data.facilities); setImages(data.images);
      },
    },
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [layout, setLayout] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [floorInfo, setFloorInfo] = useState('');
  const [orientation, setOrientation] = useState('');
  const [decoration, setDecoration] = useState('精装');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<PriceType>('rent');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState<RegionSelection>({ provinceCode: null, cityCode: null, districtCode: null, label: '' });
  const [regionOpen, setRegionOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [community, setCommunity] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [rentalMode, setRentalMode] = useState<'whole' | 'shared' | ''>('');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const pickImages = useCallback(async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast(`最多 ${MAX_IMAGES} 张`, 'warn'); return; }
    const picked = await imagePicker.pickImages(remaining);
    if (!picked.ok) { toast(picked.message, 'warn'); return; }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const image of picked.value) {
        const uploaded = await uploadApi.file(
          { uri: image.uri, name: image.fileName ?? 'property.jpg', type: image.mimeType ?? 'image/jpeg' },
          'post',
        );
        urls.push(uploaded.url);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch { toast('图片上传失败,请稍后再试', 'error'); }
    finally { setBusy(false); }
  }, [images.length, toast]);

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = '请填写标题';
    if (!price.trim() || Number(price) <= 0) next.price = '请填写有效价格';
    if (!address.trim()) next.address = '请填写地址';
    if (availableFrom.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom.trim())) {
      next.availableFrom = '可入住日期格式应为 2026-12-01';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [address, availableFrom, price, title]);

  const save = useCallback(async (targetStatus: 1 | 2) => {
    if (!validate() || busy) return;
    setBusy(true);
    try {
      const payload = {
        title: title.trim(), description: description.trim() || undefined,
        propertyType, layout: layout.trim() || undefined,
        areaSqm: areaSqm.trim() ? Number(areaSqm) : undefined,
        floorInfo: floorInfo.trim() || undefined,
        orientation: orientation.trim() || undefined,
        decoration: decoration.trim() || undefined,
        price: Number(price), priceType, address: address.trim(),
        community: community.trim() || undefined,
        availableFrom: availableFrom.trim() || undefined,
        rentalMode: priceType === 'rent' && rentalMode ? rentalMode : undefined,
        district: region.districtCode ? regionLabel(region.districtCode) : undefined,
        city: region.cityCode ? regionLabel(region.cityCode) : undefined,
        facilities: selectedFacilities.length > 0 ? selectedFacilities : undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        images: images.length > 0 ? images : undefined,
        status: targetStatus,
      };
      if (editId) await updateProperty(editId, payload);
      else await createProperty(payload);
      toast(targetStatus === 2 ? '已上架' : '草稿已保存', 'success');
      router.back();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '保存失败,请稍后再试', 'error');
    } finally { setBusy(false); }
  }, [address, areaSqm, availableFrom, busy, community, contactName, contactPhone, decoration, description, editId, floorInfo, images, layout, orientation, price, priceType, propertyType, region, regionLabel, rentalMode, router, selectedFacilities, title, toast, validate]);

  const inputStyle = { color: token('foreground', scheme), borderColor: token('border', scheme) } as const;
  const chipStyle = (selected: boolean) => ({
    borderColor: selected ? token('primary', scheme) : token('border', scheme),
    backgroundColor: selected ? token('accent', scheme) : 'transparent',
  });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <Text className="text-xl font-bold">{editId ? '编辑房源' : '发布房源'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="取消" onPress={() => router.back()}>
            <Text className="text-muted-foreground text-sm">取消</Text>
          </Pressable>
        </View>

        <Card className="mb-3 p-4">
          <Field label="标题" error={errors.title} required>
            <Input value={title} onChangeText={setTitle} placeholder="比如:精装两房 近地铁 拎包入住" aria-label="标题" />
          </Field>

          <Field label="类型" required>
            <View className="flex-row" style={{ gap: 6 }}>
              {TYPES.map((t) => (
                <Pressable key={t.key} accessibilityRole="button" accessibilityLabel={t.label}
                  onPress={() => setPropertyType(t.key)} className="flex-1 items-center rounded-lg border py-2"
                  style={chipStyle(propertyType === t.key)}>
                  <Text className={`text-xs ${propertyType === t.key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Field label="户型" hint="如 2室1厅1卫">
                <Input value={layout} onChangeText={setLayout} style={inputStyle} aria-label="户型" />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="面积(㎡)">
                <Input value={areaSqm} onChangeText={setAreaSqm} keyboardType="decimal-pad" style={inputStyle} aria-label="面积" />
              </Field>
            </View>
          </View>

          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Field label="楼层" hint="如 5/18">
                <Input value={floorInfo} onChangeText={setFloorInfo} style={inputStyle} aria-label="楼层" />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="朝向">
                <Input value={orientation} onChangeText={setOrientation} style={inputStyle} aria-label="朝向" />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="装修">
                <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                  {DECORATIONS.map((d) => (
                    <Pressable key={d} onPress={() => setDecoration(d)} className="rounded px-2 py-1"
                      style={chipStyle(decoration === d)}>
                      <Text className={`text-xs ${decoration === d ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
            </View>
          </View>

          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Field label="价格(元)" error={errors.price} required>
                <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={inputStyle} aria-label="价格" />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="价格类型" required>
                <View className="flex-row" style={{ gap: 6 }}>
                  {(['rent', 'sale'] as const).map((t) => (
                    <Pressable key={t} onPress={() => setPriceType(t)} className="flex-1 items-center rounded-lg border py-2"
                      style={chipStyle(priceType === t)}>
                      <Text className={`text-xs ${priceType === t ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {t === 'rent' ? '租金/月' : '售价'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
            </View>
          </View>

          <Field label="详细地址" error={errors.address} required>
            <Input value={address} onChangeText={setAddress} placeholder="xx 号楼 xx 单元 xx 室" style={inputStyle} aria-label="详细地址" />
          </Field>
          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Field label="小区名称">
                <Input value={community} onChangeText={setCommunity} style={inputStyle} placeholder="如 阳光花园" aria-label="小区名称" />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="可入住日期" hint="格式 2026-12-01" error={errors.availableFrom}>
                <Input value={availableFrom} onChangeText={setAvailableFrom} style={inputStyle} placeholder="2026-12-01" aria-label="可入住日期" />
              </Field>
            </View>
          </View>

          {/* 所在地区:省市区级联(数据来自服务端区划库,与小程序同源) */}
          <Field label="所在地区" hint="省市区三级选择">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="选择所在地区"
              onPress={() => setRegionOpen(true)}
              className="border-border rounded-lg border px-3 py-2.5"
              style={{ borderColor: token('border', scheme) }}
            >
              <Text className={`text-sm ${region.label ? '' : 'text-muted-foreground'}`}>
                {region.label || '请选择省/市/区'}
              </Text>
            </Pressable>
          </Field>

          {/* 租赁方式(仅出租) */}
          {priceType === 'rent' ? (
            <Field label="租赁方式">
              <View className="flex-row" style={{ gap: 6 }}>
                {([['whole', '整租'], ['shared', '合租']] as const).map(([key, label]) => (
                  <Pressable key={key} accessibilityRole="button" accessibilityLabel={label}
                    onPress={() => setRentalMode(rentalMode === key ? '' : key)}
                    className="flex-1 items-center rounded-lg border py-2"
                    style={chipStyle(rentalMode === key)}>
                    <Text className={`text-xs ${rentalMode === key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          ) : null}

          <Field label="配套设施(选填)">
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {FACILITIES.map((f) => {
                const selected = selectedFacilities.includes(f);
                return (
                  <Pressable key={f} accessibilityRole="button" accessibilityLabel={f}
                    onPress={() => setSelectedFacilities((prev) => selected ? prev.filter((x) => x !== f) : [...prev, f])}
                    className="rounded-full border px-3 py-1"
                    style={{ borderColor: selected ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: selected ? token('accent', scheme) : 'transparent' }}>
                    <Text className={`text-xs ${selected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{f}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="联系人">
            <Input value={contactName} onChangeText={setContactName} style={inputStyle} placeholder="联系人姓名" aria-label="联系人" />
          </Field>
          <Field label="联系电话">
            <Input value={contactPhone} onChangeText={setContactPhone} style={inputStyle} keyboardType="phone-pad" aria-label="联系电话" />
          </Field>

          <Field label={`图片(${images.length}/${MAX_IMAGES})`}>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {images.map((uri) => (
                <View key={uri} style={{ width: 88, height: 88 }}>
                  <RemoteImage uri={uri} style={{ width: 88, height: 88, borderRadius: 8 }} />
                  <Pressable accessibilityRole="button" accessibilityLabel="移除图片"
                    onPress={() => setImages((prev) => prev.filter((x) => x !== uri))}
                    className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-black/50">
                    <Text className="text-primary-foreground text-[10px]">✕</Text>
                  </Pressable>
                </View>
              ))}
              {images.length < MAX_IMAGES ? (
                <Pressable accessibilityRole="button" accessibilityLabel="添加图片"
                  onPress={() => void pickImages()} disabled={busy}
                  className="border-border h-[88px] w-[88px] items-center justify-center rounded-lg border border-dashed">
                  <ImagePlus size={20} color={token('muted-foreground', scheme)} />
                </Pressable>
              ) : null}
            </View>
          </Field>

          <Field label="房源描述" hint="选填,最多 2000 字">
            <TextInput
              className="text-foreground min-h-24 rounded-lg border px-3 py-2 text-sm"
              style={{ color: token('foreground', scheme), borderColor: token('border', scheme) }}
              value={description} onChangeText={setDescription} multiline maxLength={2000}
              placeholder="补充房源亮点…" accessibilityLabel="房源描述"
            />
          </Field>

          <View className="mt-3 flex-row" style={{ gap: 12 }}>
            <Button variant="outline" className="flex-1" onPress={() => void save(1)} disabled={busy}>
              <Text>{busy ? '保存中…' : '存草稿'}</Text>
            </Button>
            <Button className="flex-1" onPress={() => void save(2)} disabled={busy}>
              <Text>{busy ? '提交中…' : '上架'}</Text>
            </Button>
          </View>
        </Card>
      </ScrollView>

      <RegionPicker
        visible={regionOpen}
        level={3}
        value={region}
        onClose={() => setRegionOpen(false)}
        onChange={setRegion}
      />
    </SafeAreaView>
  );
}

