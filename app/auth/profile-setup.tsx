/**
 * 登录后的非阻断资料引导(spec: 自动建档后引导完善资料)。
 *
 * "非阻断"落到两处:本页随时可跳过并写回 `needsProfileSetup=false`;
 * 跳过之后广场、详情、消息与发布都不受影响,只在"我的"顶部保留一条可再次进入的提示。
 *
 * 身份类型 `GUARDIAN|VOLUNTEER|PUBLIC` 与性别枚举由契约 1.3 穷举;
 * 性别展示文案优先用 `/app/plaza/filters` 的 `genders` 字典(前端不硬编码枚举标签),
 * 字典不可用时才回落到契约里的三值。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, OptionSheetField, TextField } from '@/components/form/fields';
import { NoticeBar, SectionCard } from '@/components/business/feedback';
import { RegionPicker, type RegionSelection } from '@/components/business/pickers';
import { useFilters } from '@/providers/FiltersProvider';
import { useToast } from '@/providers/ToastProvider';
import { toUserMessage } from '@/lib/api/error';
import { uploadApi } from '@/lib/api/endpoints/upload';
import { imagePicker, IMAGE_PICKER_UNAVAILABLE, imageCompress } from '@/lib/capabilities';
import { GENDER_LABEL, IDENTITY_LABEL } from '@/lib/format';
import type { Gender, IdentityType } from '@/lib/api/endpoints/auth';
import { useSession } from '@/store/session';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const user = useSession((state) => state.user);
  const updateProfile = useSession((state) => state.updateProfile);
  const dismissProfileSetup = useSession((state) => state.dismissProfileSetup);
  const { optionsOf, regionLabel } = useFilters();
  const { toast } = useToast();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'UNKNOWN');
  const [identityType, setIdentityType] = useState<IdentityType | ''>(
    user?.identityType ?? '',
  );
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

  // 区划码 → 文字:字典由 FiltersProvider 异步加载,这里在渲染期直接派生文案,
  // 不再用 effect 把 label 回写进 state(那会多一轮级联渲染)。
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

  const identityOptions = useMemo(
    () =>
      (Object.keys(IDENTITY_LABEL) as IdentityType[]).map((value, index) => ({
        value,
        label: IDENTITY_LABEL[value],
        order: index,
      })),
    [],
  );

  const regionLabelOfAvatar = regionSelection.label || '未选择';

  const pickAvatar = useCallback(async () => {
    setUploadNote(null);
    if (!imagePicker.isAvailable()) {
      setUploadNote(IMAGE_PICKER_UNAVAILABLE);
      return;
    }
    const picked = await imagePicker.pickImages(1);
    if (!picked.ok) {
      setUploadNote(picked.message);
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
      toast('头像已上传', 'success');
    } catch (caught) {
      setUploadNote(toUserMessage(caught));
    } finally {
      setUploading(false);
    }
  }, [toast]);

  const save = useCallback(async () => {
    setError(null);
    if (nickname.trim() && nickname.trim().length < 2) {
      setError('昵称至少 2 个字');
      return;
    }
    if (!identityType) {
      setError('请选择身份类型,或点右上角"稍后再说"跳过');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        gender,
        identityType,
        ...(avatar ? { avatar } : {}),
        ...(region.provinceCode ? { provinceCode: region.provinceCode } : {}),
        ...(region.cityCode ? { cityCode: region.cityCode } : {}),
        ...(region.districtCode ? { districtCode: region.districtCode } : {}),
      });
      dismissProfileSetup();
      toast('资料已保存', 'success');
      router.back();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [avatar, dismissProfileSetup, gender, identityType, nickname, region, router, toast, updateProfile]);

  const skip = useCallback(() => {
    dismissProfileSetup();
    router.back();
  }, [dismissProfileSetup, router]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-lg font-semibold">完善资料</Text>
        <Button variant="ghost" size="sm" onPress={skip}>
          <Text>稍后再说</Text>
        </Button>
      </View>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <NoticeBar
          tone="info"
          title="这一步是可选的"
          lines={[
            '身份类型与常驻地只用于入口排序与"就近"默认城市,跳过不影响浏览、收藏、线索与发布。',
            '随时可在「我的 - 编辑资料」里补充。',
          ]}
        />

        <Card className="mt-1">
          <CardHeader>
            <CardTitle className="text-base">头像与昵称</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="flex-row items-center gap-3">
              <Avatar alt="头像" className="size-16">
                {avatar ? <AvatarImage source={{ uri: avatar }} /> : null}
                <AvatarFallback>
                  <Text>{(nickname || '无').slice(0, 1)}</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading || !imagePicker.isAvailable()}
                  onPress={() => void pickAvatar()}
                >
                  <Text>{uploading ? '上传中' : avatar ? '更换头像' : '选择头像'}</Text>
                </Button>
                {!imagePicker.isAvailable() ? (
                  <Text className="text-muted-foreground mt-1 text-xs">
                    当前设备未接入图片选择器,可稍后在「编辑资料」补图。
                  </Text>
                ) : null}
              </View>
            </View>
            {uploadNote ? <NoticeBar tone="warn" title={uploadNote} /> : null}
            <TextField
              label="昵称"
              value={nickname}
              maxLength={32}
              testID="profile-nickname"
              hint="留空则保留系统分配的昵称"
              onChangeText={setNickname}
            />
          </CardContent>
        </Card>

        <SectionCard title="身份与常驻地" className="mt-3">
          <OptionSheetField
            label="身份类型"
            required
            testID="profile-identity"
            options={identityOptions}
            value={identityType || undefined}
            onChange={(value) => setIdentityType(value as IdentityType)}
            placeholder="请选择身份"
          />
          <Field label="常驻地" hint={'用于"就近"流的默认城市与发布页预填'}>
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm">{regionLabelOfAvatar}</Text>
              <Button variant="outline" size="sm" onPress={() => setRegionOpen(true)}>
                <Text>选择</Text>
              </Button>
            </View>
          </Field>
          <OptionSheetField
            label="性别"
            testID="profile-gender"
            options={genderOptions}
            value={gender}
            onChange={(value) => setGender(value as Gender)}
          />
        </SectionCard>

        {error ? (
          <Text accessibilityRole="alert" className="text-urgent mt-2 text-sm">
            {error}
          </Text>
        ) : null}

        <View className="mt-4 flex-row gap-3">
          <Button variant="outline" className="flex-1" onPress={skip}>
            <Text>跳过</Text>
          </Button>
          <Button className="flex-1" disabled={saving} onPress={() => void save()}>
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
