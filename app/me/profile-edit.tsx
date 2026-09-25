/**
 * 编辑资料(spec: 资料与账号安全 / 契约 1 节 `PUT /app/auth/profile`)。
 *
 * 三条约束:
 *   1. `AppProfileReq` 全字段可选,只提交真正改过的键,避免把没动的字段清空;
 *   2. 头像走能力分派层:选图 → 客户端压缩 → 统一上传接口拿 url。
 *      能力不可用时(鸿蒙一期)按钮禁用并说明原因,页面其余部分照常可存;
 *   3. 性别与身份的选项文案优先取 `/app/plaza/filters` 字典,字典不可用时才用契约枚举兜底。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Field, OptionSheetField, TextField } from '@/components/form/fields';
import { NoticeBar, SectionCard } from '@/components/business/feedback';
import { RegionPicker, type RegionSelection } from '@/components/business/pickers';
import { useFilters } from '@/providers/FiltersProvider';
import { useToast } from '@/providers/ToastProvider';
import { toUserMessage } from '@/lib/api/error';
import { uploadApi } from '@/lib/api/endpoints/upload';
import type { AppProfileReq, Gender, IdentityType } from '@/lib/api/endpoints/auth';
import { GENDER_LABEL, IDENTITY_LABEL, REAL_NAME_STATUS_LABEL } from '@/lib/format';
import {
  imagePicker,
  imageCompress,
  IMAGE_PICKER_UNAVAILABLE,
} from '@/lib/capabilities';
import { useSession } from '@/store/session';

const IDENTITY_OPTIONS = (Object.keys(IDENTITY_LABEL) as IdentityType[]).map((value, index) => ({
  value,
  label: IDENTITY_LABEL[value],
  order: index,
}));

export default function ProfileEditScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { optionsOf, regionLabel } = useFilters();

  const user = useSession((state) => state.user);
  const updateProfile = useSession((state) => state.updateProfile);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'UNKNOWN');
  const [identityType, setIdentityType] = useState<IdentityType | ''>(user?.identityType ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [region, setRegion] = useState<RegionSelection>({
    provinceCode: user?.provinceCode ?? null,
    cityCode: user?.cityCode ?? null,
    districtCode: user?.districtCode ?? null,
    label: '',
  });
  const [regionOpen, setRegionOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickerAvailable = imagePicker.isAvailable();

  // 区划码翻成文字:字典是异步的,渲染期直接派生,不用 effect 回写 state。
  const derivedRegionLabel = useMemo(
    () =>
      [region.provinceCode, region.cityCode, region.districtCode]
        .map((code) => regionLabel(code))
        .filter(Boolean)
        .join(' '),
    [region.cityCode, region.districtCode, region.provinceCode, regionLabel],
  );
  const regionSelection = useMemo<RegionSelection>(
    () => ({ ...region, label: region.label || derivedRegionLabel }),
    [derivedRegionLabel, region],
  );

  const genderOptions = useMemo(() => {
    const fromDict = optionsOf('genders');
    if (fromDict.length) return fromDict;
    return (Object.keys(GENDER_LABEL) as Gender[]).map((value, index) => ({
      value,
      label: GENDER_LABEL[value],
      order: index,
    }));
  }, [optionsOf]);

  const pickAvatar = useCallback(async () => {
    setUploadNote(null);
    if (!pickerAvailable) {
      setUploadNote(IMAGE_PICKER_UNAVAILABLE);
      return;
    }
    const picked = await imagePicker.pickImages(1);
    if (!picked.ok) {
      // 能力层返回可识别的 unsupported / denied / cancelled,这里只做文案降级,不弹错误框。
      setUploadNote(
        picked.reason === 'unsupported' ? IMAGE_PICKER_UNAVAILABLE : picked.message,
      );
      return;
    }
    const image = picked.value[0];
    if (!image) return;
    setUploading(true);
    try {
      const compressed = await imageCompress.compress(image);
      const target = compressed.ok ? compressed.value : image;
      const resp = await uploadApi.file(
        {
          uri: target.uri,
          name: target.fileName ?? `avatar-${Date.now()}.jpg`,
          type: target.mimeType ?? 'image/jpeg',
        },
        'avatar',
      );
      setAvatar(resp.url);
      toast('头像已上传,记得点保存', 'success');
    } catch (caught) {
      setUploadNote(toUserMessage(caught));
    } finally {
      setUploading(false);
    }
  }, [pickerAvailable, toast]);

  const save = useCallback(async () => {
    setError(null);
    const trimmed = nickname.trim();
    if (trimmed && trimmed.length < 2) {
      setError('昵称至少 2 个字');
      return;
    }
    if (trimmed.length > 32) {
      setError('昵称最多 32 个字');
      return;
    }
    // 只提交改过的键:契约里 PUT 是全量覆盖语义,漏传即清空。
    const req: AppProfileReq = {};
    if (trimmed && trimmed !== (user?.nickname ?? '')) req.nickname = trimmed;
    if (gender !== (user?.gender ?? 'UNKNOWN')) req.gender = gender;
    if (identityType && identityType !== (user?.identityType ?? '')) req.identityType = identityType;
    if (avatar !== (user?.avatar ?? null)) {
      // 契约里 `avatar` 是不可缺省的空串:清空头像只能回传空字符串。
      req.avatar = avatar ?? '';
    }
    if (region.provinceCode && region.provinceCode !== (user?.provinceCode ?? '')) {
      req.provinceCode = region.provinceCode;
    }
    if (region.cityCode && region.cityCode !== (user?.cityCode ?? '')) req.cityCode = region.cityCode;
    if (region.districtCode && region.districtCode !== (user?.districtCode ?? '')) {
      req.districtCode = region.districtCode;
    }

    setSaving(true);
    try {
      if (Object.keys(req).length) await updateProfile(req);
      toast('资料已保存', 'success');
      router.back();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [avatar, gender, identityType, nickname, region, router, toast, updateProfile, user]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-muted-foreground pb-3 pt-2 text-xs">
          资料只用于入口排序、「就近」默认城市与线索联络,不会公开显示你的联系方式。
        </Text>

        <SectionCard title="头像与昵称">
          <View className="flex-row items-center gap-3">
            <Avatar alt="头像" className="size-16">
              {avatar ? <AvatarImage source={{ uri: avatar }} /> : null}
              <AvatarFallback>
                <Text>{(nickname || '无').slice(0, 1)}</Text>
              </AvatarFallback>
            </Avatar>
            <View className="flex-1">
              <View className="flex-row gap-2">
                <Button
                  testID="profile-avatar-pick"
                  variant="outline"
                  size="sm"
                  disabled={uploading || !pickerAvailable}
                  onPress={() => void pickAvatar()}
                >
                  <Text>{uploading ? '上传中' : avatar ? '更换头像' : '选择头像'}</Text>
                </Button>
                {avatar ? (
                  <Button variant="ghost" size="sm" onPress={() => setAvatar(null)}>
                    <Text>移除</Text>
                  </Button>
                ) : null}
              </View>
              {!pickerAvailable ? (
                <Text className="text-muted-foreground mt-1 text-xs">
                  当前设备未接入图片选择能力,头像暂不可改;昵称、性别与常驻地仍可正常保存。
                </Text>
              ) : null}
            </View>
          </View>
          {uploadNote ? <NoticeBar tone="warn" title={uploadNote} /> : null}
          <TextField
            label="昵称"
            testID="profile-nickname"
            value={nickname}
            maxLength={32}
            hint="2–32 个字;留空则保持现有昵称"
            onChangeText={setNickname}
          />
        </SectionCard>

        <SectionCard title="身份与性别" className="mt-3" description="身份类型影响入口展示,不影响浏览">
          <OptionSheetField
            label="身份类型"
            testID="profile-identity"
            options={IDENTITY_OPTIONS}
            value={identityType || undefined}
            placeholder="请选择身份"
            onChange={(value) => setIdentityType(value as IdentityType)}
          />
          <OptionSheetField
            label="性别"
            testID="profile-gender"
            options={genderOptions}
            value={gender}
            onChange={(value) => setGender(value as Gender)}
          />
          <View className="flex-row flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline">
              <Text>
                手机号:{user?.phone ?? '未绑定'}
              </Text>
            </Badge>
            <Badge variant="outline">
              <Text>实名认证:{REAL_NAME_STATUS_LABEL[user?.realNameStatus ?? 'UNCHECKED']}</Text>
            </Badge>
          </View>
        </SectionCard>

        <SectionCard title="常驻地区" className="mt-3" description={'用于"就近"流的默认城市与发布页预填'}>
          <Field label="省 / 市 / 区县" hint="只存到区划码,不申请定位权限">
            <Pressable
              accessibilityRole="button"
              onPress={() => setRegionOpen(true)}
              className="border-input bg-background flex-row items-center gap-2 rounded-md border px-3 py-2"
            >
              <Icon as={MapPin} size={15} className="text-muted-foreground" />
              <Text className={region.provinceCode ? 'flex-1 text-sm' : 'text-muted-foreground flex-1 text-sm'}>
                {regionSelection.label || '未选择'}
              </Text>
            </Pressable>
          </Field>
        </SectionCard>

        {error ? (
          <Text accessibilityRole="alert" className="text-urgent mt-2 text-sm">
            {error}
          </Text>
        ) : null}

        <View className="mt-4 flex-row gap-3">
          <Button variant="outline" className="flex-1" onPress={() => router.back()}>
            <Text>返回</Text>
          </Button>
          <Button testID="profile-save" className="flex-1" disabled={saving} onPress={() => void save()}>
            <Text>{saving ? '保存中' : '保存'}</Text>
          </Button>
        </View>
      </ScrollView>

      <RegionPicker
        visible={regionOpen}
        level={3}
        value={regionSelection}
        onClose={() => setRegionOpen(false)}
        onChange={(next) => setRegion(next)}
      />
    </SafeAreaView>
  );
}
