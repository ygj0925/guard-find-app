/**
 * 五步发布表单(spec: 五步分步发布表单 / 合规告知与真实承诺 / 草稿与离线保护)。
 *
 * 结构与规则:
 *   - 状态全在 `store/publish-form.ts` 的一份 `values` 里 —— 上一步 MUST NOT 重置已填内容;
 *   - 每步用 `lib/publish/schema.ts` 的 zod schema 独立校验,错误定位到字段;
 *   - 第三步"至少填写一项体貌特征"是硬 gate(与契约 4003 同源);
 *   - 第五步两项合规勾选未全部完成时提交按钮禁用,请求不发;
 *   - 每次改动 debounce 落本机副本(离线可续填),云端草稿走 `submit=false`;
 *   - 4005 疑似重复档案要弹对比确认并允许 `forceSubmit`。
 *
 * 选图能力不可用时(鸿蒙一期)第一步的"至少 1 张近照"降级为提示,见 `softenMediaError`。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckboxField,
  Field,
  NumberField,
  OptionChips,
  OptionSheetField,
  SwitchField,
  TextField,
} from '@/components/form/fields';
import { EmptyState, InlineRow, NoticeBar, SectionCard } from '@/components/business/feedback';
import { CaseCard } from '@/components/business/case-card';
import { AgreementLinks, AGREEMENT_ITEMS, AntiFraudNotice } from '@/components/business/compliance';
import { DateTimePicker, RegionPicker, type RegionSelection } from '@/components/business/pickers';
import {
  MediaField,
  hasFailedUpload,
  hasPendingUpload,
  uploadedUrlsOf,
} from '@/components/business/media-field';
import { mediaPickerAvailable } from '@/lib/media';
import { useSessionGuard } from '@/providers/SessionProvider';
import { useFilters } from '@/providers/FiltersProvider';
import { useToast } from '@/providers/ToastProvider';
import { env } from '@/lib/env';
import { ApiError, toUserMessage } from '@/lib/api/error';
import {
  MAX_MEDIA_PER_CASE,
  softenMediaError,
  STEP_TITLES,
  validateStep,
  type PublishValues,
  type StepIndex,
} from '@/lib/publish/schema';
import type { CasePublic, SimilarCasesResp } from '@/lib/api/endpoints/case';
import type { Option } from '@/lib/api/endpoints/common';
import { formatDateTime, toServerTime } from '@/lib/format';
import { buildReqFromValues, usePublishForm } from '@/store/publish-form';

const ALIAS_KINDS: Option[] = [
  { value: 'NICKNAME', label: '小名/昵称', order: 0 },
  { value: 'CODENAME', label: '代号', order: 1 },
  { value: 'OTHER', label: '其他', order: 2 },
];

const CONTACT_OPTIONS: Option[] = [
  { value: 'IN_APP', label: '仅 App 内联络(推荐)', order: 0 },
  { value: 'PHONE', label: '公开电话给家属', order: 1 },
];

type PatchFn = (next: Partial<PublishValues>) => void;

interface StepProps {
  values: PublishValues;
  errors: Record<string, string>;
  patch: PatchFn;
}

export default function PublishCaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ caseId?: string }>();
  const cloudCaseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;
  const { guard, signedIn } = useSessionGuard();
  const { optionsOf, loading: filtersLoading, error: filtersError, reload } = useFilters();
  const { toast } = useToast();

  const values = usePublishForm((state) => state.values);
  const step = usePublishForm((state) => state.step);
  const errors = usePublishForm((state) => state.errors);
  const formError = usePublishForm((state) => state.formError);
  const hydrated = usePublishForm((state) => state.hydrated);
  const pendingSync = usePublishForm((state) => state.pendingSync);
  const caseIdInStore = usePublishForm((state) => state.caseId);
  const conflict = usePublishForm((state) => state.conflict);
  const saving = usePublishForm((state) => state.saving);
  const submitting = usePublishForm((state) => state.submitting);

  const [timeOpen, setTimeOpen] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [hometownOpen, setHometownOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<CasePublic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mediaRequired = mediaPickerAvailable();

  useEffect(() => {
    void usePublishForm.getState().hydrate();
  }, []);

  // 协议版本号在进入时写一次,提交时随 `CaseReq.agreementVersion` 上送(契约 2 节)。
  useEffect(() => {
    if (hydrated && values.agreementVersion !== env.AGREEMENT_VERSION) {
      usePublishForm.getState().patch({ agreementVersion: env.AGREEMENT_VERSION });
    }
  }, [hydrated, values.agreementVersion]);

  // 从"我的档案 / 草稿箱"带着云端草稿进来时拉全量并预填。
  useEffect(() => {
    if (!hydrated || !cloudCaseId || caseIdInStore === cloudCaseId) return;
    void usePublishForm
      .getState()
      .loadCloudDraft(cloudCaseId)
      .catch((error: unknown) => setLoadError(toUserMessage(error)));
  }, [hydrated, cloudCaseId, caseIdInStore]);

  const patch = useCallback<PatchFn>((next) => {
    usePublishForm.getState().patch(next);
  }, []);

  // 图片上传结果由 MediaField 持有,这里只把"已成功上传的地址"同步给 store。
  useEffect(() => {
    usePublishForm.getState().setUploadedUrls(uploadedUrlsOf(values.media));
  }, [values.media]);

  const region: RegionSelection = useMemo(
    () => ({
      provinceCode: values.provinceCode || null,
      cityCode: values.cityCode || null,
      districtCode: values.districtCode,
      label: '',
    }),
    [values.provinceCode, values.cityCode, values.districtCode],
  );

  const goNext = useCallback(() => {
    const raw = validateStep(step, values);
    const result = softenMediaError(step, raw, mediaRequired);
    if (!result.ok) {
      usePublishForm.setState({ errors: raw.errors, formError: raw.formError ?? raw.errors.media });
      return;
    }
    usePublishForm.setState({ errors: {}, formError: undefined });
    usePublishForm.getState().setStep(Math.min(4, step + 1) as StepIndex);
  }, [mediaRequired, step, values]);

  const saveDraft = useCallback(async () => {
    setLoadError(null);
    try {
      await usePublishForm.getState().saveDraftCloud();
      toast('草稿已保存,离线时保留在本机', 'success');
    } catch (error) {
      setLoadError(toUserMessage(error));
      toast('云端草稿保存失败,已保留本机副本', 'warn');
    }
  }, [toast]);

  const doSubmit = useCallback(
    async (forceSubmit: boolean) => {
      setLoadError(null);
      // 第五步两项合规勾选未完成时不发请求(spec 场景「未勾选禁止提交」)。
      const compliance = validateStep(4, values);
      if (!compliance.ok) {
        usePublishForm.setState({ errors: compliance.errors, formError: compliance.formError });
        return;
      }
      for (let index = 0; index < 4; index += 1) {
        const result = softenMediaError(
          index as StepIndex,
          validateStep(index as StepIndex, values),
          mediaRequired,
        );
        if (!result.ok) {
          usePublishForm.setState({
            errors: result.errors,
            formError: `第 ${index + 1} 步(${STEP_TITLES[index]})还有未通过的内容`,
            step: index as StepIndex,
          });
          return;
        }
      }
      if (hasPendingUpload(values.media) || hasFailedUpload(values.media)) {
        usePublishForm.setState({ formError: '图片仍在上传或有失败,请先处理' });
        return;
      }
      try {
        const req = buildReqFromValues(values, uploadedUrlsOf(values.media), {
          submit: true,
          agreementVersion: values.agreementVersion || env.AGREEMENT_VERSION,
          forceSubmit,
        });
        const created = await usePublishForm.getState().submitForReview(req);
        toast('已提交审核,结果会通过站内信通知你', 'success');
        router.replace(`/case/${created.id}`);
      } catch (error) {
        if (error instanceof ApiError && error.code === 4005) {
          const data = error.data as Partial<SimilarCasesResp> | undefined;
          setDuplicate(data?.similarCases ?? []);
          return;
        }
        setLoadError(toUserMessage(error));
      }
    },
    [mediaRequired, router, toast, values],
  );

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="p-5">
          <NoticeBar
            tone="info"
            title="发布寻人档案需要登录"
            lines={['未注册手机号验证通过后即自动创建账号;发布内容提交后进入人工审核。']}
          />
          <Button className="mt-3" onPress={() => guard({ href: '/publish/case', label: 'publish' })}>
            <Text>去登录</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!hydrated) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="p-5">
          <Text className="text-muted-foreground">正在恢复本机草稿…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const agreementsDone = values.agreementRights && values.agreementTruthful;
  const uploadedCount = uploadedUrlsOf(values.media).length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StepBar step={step} />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 132 }}
        keyboardShouldPersistTaps="handled"
      >
        {loadError ? <NoticeBar tone="danger" title={loadError} /> : null}
        {pendingSync ? (
          <NoticeBar
            tone="warn"
            title="本机有未同步内容"
            lines={['离线填写的内容保存在本机,联网后点"存草稿"即可同步到云端。']}
          />
        ) : null}
        {!mediaRequired ? (
          <NoticeBar
            tone="info"
            title="当前设备暂不支持选择图片"
            lines={['可先完成文字内容并保存草稿,图片稍后在草稿箱补齐;此步的"至少 1 张近照"暂不拦截。']}
          />
        ) : null}

        {step === 0 ? (
          <StepBasic
            values={values}
            errors={errors}
            patch={patch}
            relations={optionsOf('relations')}
            genders={optionsOf('genders')}
            onBirthday={() => setBirthdayOpen(true)}
          />
        ) : null}
        {step === 1 ? (
          <StepTimePlace
            values={values}
            errors={errors}
            patch={patch}
            onTime={() => setTimeOpen(true)}
            onRegion={() => setRegionOpen(true)}
            onHometown={() => setHometownOpen(true)}
          />
        ) : null}
        {step === 2 ? (
          <StepFeatures values={values} errors={errors} patch={patch} formError={formError} />
        ) : null}
        {step === 3 ? (
          <StepContext
            values={values}
            errors={errors}
            patch={patch}
            caseTypes={optionsOf('caseTypes')}
            bloodOptions={optionsOf('bloodSampleStatuses')}
            filtersLoading={filtersLoading}
            filtersError={filtersError}
            onReloadFilters={() => void reload()}
          />
        ) : null}
        {step === 4 ? (
          <StepConfirm
            values={values}
            errors={errors}
            patch={patch}
            agreementsDone={agreementsDone}
            mediaCount={uploadedCount}
            submitting={submitting}
            onSubmit={() => void doSubmit(false)}
          />
        ) : null}

        {formError ? (
          <Text accessibilityRole="alert" className="text-urgent mt-2 text-sm">
            {formError}
          </Text>
        ) : null}
      </ScrollView>

      <View className="border-border bg-card border-t px-4 py-3">
        <View className="flex-row gap-2">
          <Button variant="outline" disabled={step === 0} onPress={() => usePublishForm.getState().back()}>
            <Icon as={ChevronLeft} size={15} />
            <Text>上一步</Text>
          </Button>
          {step < 4 ? (
            <Button className="flex-1" testID="publish-next" onPress={goNext}>
              <Text>下一步</Text>
              <Icon as={ChevronRight} size={15} />
            </Button>
          ) : null}
          <Button variant="secondary" disabled={saving} onPress={() => void saveDraft()}>
            <Text>{saving ? '保存中' : '存草稿'}</Text>
          </Button>
        </View>
        <Text className="text-muted-foreground mt-2 text-xs">
          每步都可返回,已填内容与已选图片不会被重置。
        </Text>
      </View>

      <DateTimePicker
        visible={timeOpen}
        mode="datetime"
        title="失踪时间"
        onClose={() => setTimeOpen(false)}
        value={values.missingTime || null}
        onChange={(next) => patch({ missingTime: next })}
      />
      <DateTimePicker
        visible={birthdayOpen}
        mode="date"
        title="出生日期"
        onClose={() => setBirthdayOpen(false)}
        value={values.birthday ? `${values.birthday} 12:00:00` : null}
        onChange={(next) => patch({ birthday: next.slice(0, 10) })}
      />
      <RegionPicker
        visible={regionOpen}
        level={3}
        value={region}
        onClose={() => setRegionOpen(false)}
        onChange={(next) =>
          patch({
            provinceCode: next.provinceCode ?? '',
            cityCode: next.cityCode ?? '',
            districtCode: next.districtCode,
          })
        }
      />
      <RegionPicker
        visible={hometownOpen}
        level={2}
        value={{ provinceCode: null, cityCode: values.hometownCode, districtCode: null, label: '' }}
        onClose={() => setHometownOpen(false)}
        onChange={(next) => patch({ hometownCode: next.cityCode })}
      />

      {/* 4005 疑似重复档案:展示候选,确认后才允许 forceSubmit(契约错误码表)。 */}
      <AlertDialog open={Boolean(duplicate)} onOpenChange={(open) => !open && setDuplicate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>疑似已存在相同档案</AlertDialogTitle>
            <AlertDialogDescription>
              请核对以下档案是否就是你要发布的人。重复档案会分散线索,建议先在广场搜索确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollView style={{ maxHeight: 260 }}>
            {(duplicate ?? []).map((item) => (
              <CaseCard
                key={item.id}
                item={item}
                onPress={() => {
                  setDuplicate(null);
                  router.push(`/case/${item.id}`);
                }}
              />
            ))}
          </ScrollView>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>我去搜索看看</Text>
            </AlertDialogCancel>
            <Button onPress={() => { setDuplicate(null); void doSubmit(true); }}>
              <Text>确认不是同一人,仍提交</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 云端草稿与本机副本冲突时不静默覆盖(spec 场景)。 */}
      <AlertDialog
        open={Boolean(conflict)}
        onOpenChange={(open) => !open && usePublishForm.setState({ conflict: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>云端草稿与本机副本不一致</AlertDialogTitle>
            <AlertDialogDescription>
              同一档案在别处也被编辑过。请选择保留哪一份:被放弃的一方内容会被覆盖。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => void usePublishForm.getState().resolveConflict('local')}>
              <Text>保留本机</Text>
            </Button>
            <Button onPress={() => void usePublishForm.getState().resolveConflict('cloud')}>
              <Text>改用云端</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}

function StepBar({ step }: { step: StepIndex }) {
  return (
    <View className="border-border bg-card border-b px-4 py-2">
      <Text className="text-muted-foreground text-xs">
        第 {step + 1} / {STEP_TITLES.length} 步 · {STEP_TITLES[step]}
      </Text>
      <View className="mt-2 flex-row gap-1">
        {STEP_TITLES.map((title, index) => (
          <View
            key={title}
            className={
              index <= step
                ? 'bg-primary h-1.5 flex-1 rounded-full'
                : 'bg-border h-1.5 flex-1 rounded-full'
            }
          />
        ))}
      </View>
    </View>
  );
}

function StepBasic({ values, errors, patch, relations, genders, onBirthday }: StepProps & {
  relations: Option[];
  genders: Option[];
  onBirthday: () => void;
}) {
  return (
    <View className="pt-3">
      <SectionCard title="基本信息" description="关系、姓名、性别、年龄与至少一张近照">
        <OptionSheetField
          label="与您的关系"
          required
          testID="case-relation"
          options={relations}
          value={values.relationType || undefined}
          error={errors.relationType}
          placeholder="选项来自服务端字典"
          onChange={(relationType) => patch({ relationType })}
        />
        <TextField
          label="失踪人员姓名"
          required
          testID="case-name"
          value={values.name}
          error={errors.name}
          maxLength={32}
          placeholder="2–32 个字"
          onChangeText={(name) => patch({ name })}
        />
        <Field label="性别" required error={errors.gender}>
          <OptionChips
            options={genders}
            value={values.gender}
            emptyHint="性别选项来自服务端字典,加载中或不可用"
            onChange={(gender) => patch({ gender: gender as PublishValues['gender'] })}
          />
        </Field>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="出生日期" error={errors.birthday} hint={values.birthday ?? '可选'}>
              <Button variant="outline" size="sm" onPress={onBirthday}>
                <Icon as={Calendar} size={14} />
                <Text>{values.birthday ? '已选择' : '选择'}</Text>
              </Button>
            </Field>
          </View>
          <View className="flex-1">
            <NumberField
              label="失踪时年龄"
              required
              testID="case-age"
              value={values.ageAtMissing}
              error={errors.ageAtMissing}
              max={120}
              placeholder="岁"
              onChange={(ageAtMissing) => patch({ ageAtMissing })}
            />
          </View>
        </View>

        <AliasEditor
          aliases={values.aliases}
          error={errors.aliases}
          onChange={(aliases) => patch({ aliases })}
        />

        <MediaField
          label="近照"
          required
          items={values.media}
          limit={MAX_MEDIA_PER_CASE}
          uploadPath="case"
          error={errors.media}
          testID="case-media"
          onChange={(media) => patch({ media })}
        />
      </SectionCard>
    </View>
  );
}

function AliasEditor({
  aliases,
  error,
  onChange,
}: {
  aliases: { name: string; kind: string }[];
  error?: string;
  onChange: (next: { name: string; kind: string }[]) => void;
}) {
  return (
    <Field label="别名 / 小名" error={error} hint={`最多 5 个,当前 ${aliases.length} 个`}>
      <View className="gap-2">
        {aliases.map((alias, index) => (
          <View key={`${alias.name}-${index}`} className="flex-row items-center gap-2">
            <View className="flex-1">
              <TextField
                label=""
                value={alias.name}
                maxLength={32}
                placeholder="别名"
                onChangeText={(next) => {
                  const copy = aliases.slice();
                  copy[index] = { ...copy[index], name: next };
                  onChange(copy);
                }}
              />
            </View>
            <View className="w-28">
              <OptionSheetField
                label=""
                options={ALIAS_KINDS}
                value={alias.kind || undefined}
                placeholder="类型"
                onChange={(kind) => {
                  const copy = aliases.slice();
                  copy[index] = { ...copy[index], kind };
                  onChange(copy);
                }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="删除别名"
              onPress={() => onChange(aliases.filter((_, position) => position !== index))}
              className="p-2"
            >
              <Icon as={Trash2} size={16} className="text-muted-foreground" />
            </Pressable>
          </View>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={aliases.length >= 5}
          onPress={() => onChange([...aliases, { name: '', kind: 'NICKNAME' }])}
        >
          <Icon as={Plus} size={14} />
          <Text>添加别名</Text>
        </Button>
      </View>
    </Field>
  );
}

function StepTimePlace({ values, errors, patch, onTime, onRegion, onHometown }: StepProps & {
  onTime: () => void;
  onRegion: () => void;
  onHometown: () => void;
}) {
  return (
    <View className="pt-3">
      <SectionCard
        title="时空信息"
        description="失踪时间不可晚于当前时间;详细地址不对公众展示,仅档案所有人可见"
      >
        <Field
          label="失踪时间"
          required
          error={errors.missingTime}
          hint={values.missingTime ? formatDateTime(values.missingTime) : '精确到分'}
        >
          <Button variant="outline" onPress={onTime}>
            <Icon as={Calendar} size={15} />
            <Text>{values.missingTime ? formatDateTime(values.missingTime) : '选择日期与时间'}</Text>
          </Button>
        </Field>
        <Field label="失踪地区" required error={errors.cityCode} hint="公开信息只精确到市,详情可精确到区">
          <Button variant="outline" onPress={onRegion}>
            <Icon as={MapPin} size={15} />
            <Text>{values.cityCode ? `${values.provinceCode} ${values.cityCode} ${values.districtCode ?? ''}` : '选择省 / 市 / 区县'}</Text>
          </Button>
        </Field>
        <TextField
          label="详细地址"
          testID="case-address"
          value={values.address ?? ''}
          error={errors.address}
          maxLength={120}
          multiline
          hint="仅档案所有人可见,公开页不展示"
          placeholder="街道 / 镇 / 村 + 门牌"
          onChangeText={(address) => patch({ address })}
        />
        <Field label="户籍地" error={errors.hometownCode} hint="可选,用于长期未破档案的关联">
          <Button variant="outline" onPress={onHometown}>
            <Text>{values.hometownCode ? '已选择' : '选择省市'}</Text>
          </Button>
        </Field>
      </SectionCard>
    </View>
  );
}

function StepFeatures({ values, errors, patch, formError }: StepProps & { formError?: string }) {
  return (
    <View className="pt-3">
      <SectionCard title="体貌特征" description="身高与疤痕/胎记描述至少填一项,否则无法进入下一步">
        {formError && !Object.keys(errors).length ? <NoticeBar tone="warn" title={formError} /> : null}
        <NumberField
          label="身高(cm)"
          testID="case-height"
          value={values.height}
          error={errors.height}
          max={280}
          placeholder="例如 118"
          onChange={(height) => patch({ height })}
        />
        <TextField
          label="疤痕 / 胎记等特征描述"
          testID="case-features"
          value={values.features ?? ''}
          error={errors.features}
          multiline
          maxLength={500}
          hint="例如:左眉骨有 2cm 旧疤"
          onChangeText={(features) => patch({ features })}
        />
        <TextField label="体型" value={values.bodyType ?? ''} onChangeText={(bodyType) => patch({ bodyType })} />
        <TextField label="发型" value={values.hairType ?? ''} onChangeText={(hairType) => patch({ hairType })} />
        <TextField
          label="口音"
          value={values.accent ?? ''}
          error={errors.accent}
          maxLength={60}
          onChangeText={(accent) => patch({ accent })}
        />
        <TextField
          label="失踪时衣着"
          value={values.clothing ?? ''}
          maxLength={200}
          onChangeText={(clothing) => patch({ clothing })}
        />
        <TextField
          label="随身物品"
          value={values.belongings ?? ''}
          maxLength={200}
          onChangeText={(belongings) => patch({ belongings })}
        />
      </SectionCard>
    </View>
  );
}

function StepContext({
  values,
  errors,
  patch,
  caseTypes,
  bloodOptions,
  filtersLoading,
  filtersError,
  onReloadFilters,
}: StepProps & {
  caseTypes: Option[];
  bloodOptions: Option[];
  filtersLoading: boolean;
  filtersError: string | null;
  onReloadFilters: () => void;
}) {
  return (
    <View className="pt-3">
      <SectionCard title="情形与经过" description="情形与血样选项由服务端字典提供,前端不硬编码">
        {filtersError ? (
          <NoticeBar
            tone="warn"
            title={`字典加载失败:${filtersError}`}
            lines={['没有字典就无法选择情形,可点重试。']}
          />
        ) : null}
        <OptionSheetField
          label="失踪情形"
          required
          testID="case-type"
          options={caseTypes}
          value={values.caseType || undefined}
          error={errors.caseType}
          placeholder={filtersLoading ? '选项加载中' : '请选择'}
          onChange={(caseType) => patch({ caseType: caseType as PublishValues['caseType'] })}
        />
        <TextField
          label="事件经过"
          required
          testID="case-narrative"
          value={values.narrative}
          error={errors.narrative}
          multiline
          maxLength={2000}
          hint={`${values.narrative.trim().length}/2000,至少 10 字`}
          onChangeText={(narrative) => patch({ narrative })}
        />
        <OptionSheetField
          label="血样采集"
          required
          testID="case-blood"
          options={bloodOptions}
          value={values.bloodSampleStatus || undefined}
          error={errors.bloodSampleStatus}
          placeholder={filtersLoading ? '选项加载中' : '请选择'}
          onChange={(bloodSampleStatus) =>
            patch({ bloodSampleStatus: bloodSampleStatus as PublishValues['bloodSampleStatus'] })
          }
        />
        <SwitchField
          label="是否已报警"
          value={values.policeReported}
          testID="case-police-reported"
          onValueChange={(policeReported) => patch({ policeReported })}
        />
        {values.policeReported ? (
          <>
            <TextField
              label="受理派出所"
              required
              value={values.policeStation ?? ''}
              error={errors.policeStation}
              maxLength={60}
              onChangeText={(policeStation) => patch({ policeStation })}
            />
            <TextField
              label="案件编号"
              value={values.caseNo ?? ''}
              maxLength={60}
              onChangeText={(caseNo) => patch({ caseNo })}
            />
          </>
        ) : null}
        <TextField
          label="家庭内部线索"
          value={values.familyClues ?? ''}
          multiline
          maxLength={1000}
          onChangeText={(familyClues) => patch({ familyClues })}
        />
        <TextField
          label="其他补充"
          value={values.otherNote ?? ''}
          maxLength={500}
          onChangeText={(otherNote) => patch({ otherNote })}
        />
        <TextField
          label="对接志愿者"
          value={values.followVolunteer ?? ''}
          maxLength={32}
          onChangeText={(followVolunteer) => patch({ followVolunteer })}
        />
      </SectionCard>

      <SectionCard title="可公开的联络方式" className="mt-3">
        <Field
          label="联络方式"
          required
          error={errors.contactPhone}
          hint={
            values.contactMode === 'PHONE'
              ? '电话只给档案所有人,用于核实线索'
              : '家属只能通过 App 内消息联系你'
          }
        >
          <OptionChips
            options={CONTACT_OPTIONS}
            value={values.contactMode}
            onChange={(contactMode) => patch({ contactMode: contactMode as PublishValues['contactMode'] })}
          />
        </Field>
        {values.contactMode === 'PHONE' ? (
          <TextField
            label="联系电话"
            value={values.contactPhone ?? ''}
            keyboardType="phone-pad"
            maxLength={11}
            error={errors.contactPhone}
            onChangeText={(contactPhone) => patch({ contactPhone: contactPhone.replace(/\D/g, '') })}
          />
        ) : null}
      </SectionCard>

      {filtersLoading && !caseTypes.length ? (
        <Button variant="outline" size="sm" className="mt-2" onPress={onReloadFilters}>
          <Text>重试加载字典</Text>
        </Button>
      ) : null}
    </View>
  );
}

function StepConfirm({
  values,
  errors,
  patch,
  agreementsDone,
  mediaCount,
  onSubmit,
  submitting,
}: StepProps & {
  agreementsDone: boolean;
  mediaCount: number;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const toggle = (key: 'agreementRights' | 'agreementTruthful', next: boolean) => {
    const both = key === 'agreementRights' ? next && values.agreementTruthful : values.agreementRights && next;
    const merged: Partial<PublishValues> = { [key]: next } as Partial<PublishValues>;
    merged.agreementAcceptedAt = both ? values.agreementAcceptedAt ?? toServerTime(new Date()) : undefined;
    patch(merged);
  };

  return (
    <View className="pt-3">
      <AntiFraudNotice />
      <SectionCard title="请核对发布内容" description="提交后进入人工审核,通过才会在广场展示">
        <InlineRow label="姓名" value={values.name || '未填写'} />
        <InlineRow label="关系" value={values.relationType || '未填写'} />
        <InlineRow label="失踪时年龄" value={values.ageAtMissing ?? '未填写'} />
        <InlineRow label="照片" value={`${mediaCount} 张`} />
        <InlineRow label="失踪时间" value={formatDateTime(values.missingTime)} />
        <InlineRow label="失踪地区" value={`${values.provinceCode} ${values.cityCode} ${values.districtCode ?? ''}`} />
        <InlineRow label="情形" value={values.caseType || '未填写'} />
        <InlineRow label="身高/特征" value={`${values.height ?? '-'} / ${values.features ?? '-'}`} />
        <InlineRow label="联络方式" value={values.contactMode === 'PHONE' ? '公开电话' : '仅 App 内'} />
      </SectionCard>

      <SectionCard title="合规告知" description="两项都勾选后才能提交" className="mt-3">
        {AGREEMENT_ITEMS.map((item) => (
          <CheckboxField
            key={item.key}
            label={item.label}
            description={item.description}
            checked={Boolean(values[item.key])}
            error={errors[item.key]}
            testID={`case-agree-${item.key}`}
            onCheckedChange={(next) => toggle(item.key, next)}
          />
        ))}
        <AgreementLinks version={values.agreementVersion || env.AGREEMENT_VERSION} />
        {values.agreementAcceptedAt ? (
          <Text className="text-muted-foreground mt-2 text-xs">
            勾选时间 {values.agreementAcceptedAt}(随请求一并上送)
          </Text>
        ) : null}
      </SectionCard>

      {!agreementsDone ? (
        <EmptyState
          title="还需完成两项合规勾选"
          description="未勾选时提交按钮保持禁用,请求不会发出。"
        />
      ) : null}

      <Button
        testID="publish-submit"
        className="mt-3 h-11"
        disabled={!agreementsDone || submitting}
        onPress={onSubmit}
      >
        <Text>{submitting ? '提交中' : '提交审核'}</Text>
      </Button>
      <Text className="text-muted-foreground mt-2 text-xs">
        提交即生成版本快照;审核驳回后可「修改后重新提交」。
      </Text>
    </View>
  );
}
