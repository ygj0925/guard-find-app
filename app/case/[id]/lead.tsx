/**
 * 提交线索(spec: 线索提交表单 / 契约 4 节)。
 *
 * 三条硬要求:
 *   1. 常驻防骗提示 —— 不允许只在出错时才出现;
 *   2. 联系方式默认 `IN_APP`,页面明示"选这个家属看不到你的手机号";
 *   3. 描述 10–1000 字、图片 ≤3 张在前端先拦,请求根本不发出(spec 场景)。
 *
 * 契约要求"登录且已绑手机"才能提交,未绑手机时给出绑定指引而不是让服务端回 403。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, OptionChips, TextField } from '@/components/form/fields';
import { NoticeBar, SectionCard } from '@/components/business/feedback';
import { AntiFraudNotice } from '@/components/business/compliance';
import { DateTimePicker } from '@/components/business/pickers';
import { MediaField, hasFailedUpload, hasPendingUpload, uploadedUrlsOf } from '@/components/business/media-field';
import { toUserMessage } from '@/lib/api/error';
import { leadApi } from '@/lib/api/endpoints/lead';
import {
  LEAD_DESCRIPTION_MAX,
  LEAD_DESCRIPTION_MIN,
  MAX_MEDIA_PER_LEAD,
  descriptionCountHint,
  emptyLeadValues,
  toLeadReq,
  validateLead,
  type LeadValues,
} from '@/lib/lead/schema';
import type { ContactMode } from '@/lib/api/endpoints/case';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/store/session';
import { useSessionGuard } from '@/providers/SessionProvider';
import type { MediaItem } from '@/lib/media';

const CONTACT_OPTIONS = [
  { value: 'IN_APP', label: '仅通过 App 转达(推荐)', order: 0 },
  { value: 'PHONE', label: '公开我的电话给家属', order: 1 },
];

export default function LeadSubmitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { guard, signedIn } = useSessionGuard();
  const user = useSession((state) => state.user);

  const [values, setValues] = useState<LeadValues>(emptyLeadValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const patch = useCallback((next: Partial<LeadValues>) => {
    setValues((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(next)) delete copy[key];
      return copy;
    });
  }, []);

  const mediaItems = useMemo(() => values.media as MediaItem[], [values.media]);
  const uploaded = useMemo(() => uploadedUrlsOf(mediaItems), [mediaItems]);

  const submit = useCallback(async () => {
    setFormError(null);
    const validation = validateLead(values);
    setErrors(validation.errors);
    if (!validation.ok) {
      setFormError(validation.formError ?? '请先修正标红字段');
      return;
    }
    if (hasPendingUpload(mediaItems)) {
      setFormError('还有图片在上传,完成后再提交');
      return;
    }
    if (hasFailedUpload(mediaItems)) {
      setFormError('有图片上传失败,请重试或删除后再提交');
      return;
    }
    setSubmitting(true);
    try {
      await leadApi.submit(caseId, toLeadReq(values, uploaded));
      setSubmitted(true);
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [caseId, mediaItems, uploaded, values]);

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <NoticeBar
            tone="info"
            title="提交线索需要先登录"
            lines={['登录后线索会直接送达档案所有人,处理结果会通过站内信通知你。']}
          />
          <Button className="mt-3" onPress={() => guard({ href: `/case/${caseId}/lead`, label: 'lead' })}>
            <Text>去登录</Text>
          </Button>
          <Button variant="outline" className="mt-2" onPress={() => router.replace(`/case/${caseId}`)}>
            <Text>先返回档案详情</Text>
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-found">线索已送达家属</CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="text-sm leading-5">
                处理结果会通过站内信通知你。若家属采纳或回复,你会在消息中心看到。
              </Text>
              <NoticeBar
                tone="warn"
                title="接下来请留意"
                lines={[
                  '任何人以"核实费""邮费""保证金"名义要钱都是诈骗。',
                  '家属只会通过 App 与你沟通,不会索要银行卡或验证码。',
                ]}
              />
              <View className="mt-3 flex-row gap-3">
                <Button className="flex-1" onPress={() => router.replace('/me/leads')}>
                  <Text>我提交的线索</Text>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => router.replace(`/case/${caseId}`)}
                >
                  <Text>返回档案</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <AntiFraudNotice />

        {!user?.boundPhone ? (
          <NoticeBar
            tone="warn"
            title="你还未绑定手机号"
            lines={['契约要求"登录且已绑手机"才能提交线索,请先到「我的 - 账号安全」完成绑定。']}
          />
        ) : null}

        <SectionCard title="发现情况" description="只填你亲眼所见或确切掌握的信息,猜测请标注">
          <Field label="发现时间" required error={errors.occurTime} hint={values.occurTime ? formatDateTime(values.occurTime) : '选择你最近一次看到的时间'}>
            <View className="flex-row items-center gap-2">
              <Button
                variant="outline"
                onPress={() => setTimeOpen(true)}
                accessibilityLabel="选择发现时间"
              >
                <Icon as={Calendar} size={15} />
                <Text>{values.occurTime ? formatDateTime(values.occurTime) : '选择时间'}</Text>
              </Button>
              {values.occurTime ? (
                <Button variant="ghost" size="sm" onPress={() => patch({ occurTime: '' })}>
                  <Text>清除</Text>
                </Button>
              ) : null}
            </View>
          </Field>

          <TextField
            label="发现地点"
            required
            testID="lead-address"
            value={values.occurAddress}
            error={errors.occurAddress}
            maxLength={120}
            placeholder="例如:曲周县凤凰新区好又多超市门口"
            hint="精确到路口/店名即可,不要填写他人住址"
            onChangeText={(next) => patch({ occurAddress: next })}
          />

          <Field
            label="线索描述"
            required
            error={errors.description}
            hint={descriptionCountHint(values.description.trim().length)}
          >
            <TextField
              label=""
              testID="lead-description"
              value={values.description}
              multiline
              maxLength={LEAD_DESCRIPTION_MAX}
              placeholder={`例如:今天在超市见到一名与照片相似的男孩,身边有一名中年女子(${LEAD_DESCRIPTION_MIN}–${LEAD_DESCRIPTION_MAX} 字)`}
              onChangeText={(next) => patch({ description: next })}
            />
          </Field>

          <MediaField
            label="现场图片"
            items={mediaItems}
            limit={MAX_MEDIA_PER_LEAD}
            uploadPath="lead"
            onChange={(next) => patch({ media: next })}
            error={errors.media}
            testID="lead-media"
          />
        </SectionCard>

        <SectionCard title="联系方式" className="mt-3">
          <Field
            label="可公开的联络方式"
            required
            error={errors.contactValue}
            hint={
              values.contactMode === 'IN_APP'
                ? '家属只能看到你的脱敏昵称,通过 App 内消息回复你'
                : '手机号仅档案所有人可见,用于核实线索'
            }
          >
            <OptionChips
              options={CONTACT_OPTIONS}
              value={values.contactMode}
              onChange={(next) => patch({ contactMode: next as ContactMode })}
            />
          </Field>
          {values.contactMode === 'PHONE' ? (
            <TextField
              label="联系电话"
              required
              testID="lead-contact-value"
              value={values.contactValue}
              keyboardType="phone-pad"
              maxLength={11}
              error={errors.contactValue}
              onChangeText={(next) => patch({ contactValue: next.replace(/\D/g, '') })}
            />
          ) : null}
        </SectionCard>

        {formError ? (
          <Text accessibilityRole="alert" className="text-urgent mt-3 text-sm">
            {formError}
          </Text>
        ) : null}
      </ScrollView>

      <View className="border-border bg-card border-t px-4 py-3">
        <Button
          testID="lead-submit"
          className="h-11"
          disabled={submitting}
          onPress={() => void submit()}
        >
          <Text>{submitting ? '提交中' : '提交线索'}</Text>
        </Button>
        <Text className="text-muted-foreground mt-2 text-center text-xs">
          同一档案每小时最多提交 3 条线索,请合并同一时间的观察。
        </Text>
      </View>

      <DateTimePicker
        visible={timeOpen}
        onClose={() => setTimeOpen(false)}
        value={values.occurTime || null}
        title="选择发现时间"
        onChange={(next) => patch({ occurTime: next })}
      />
    </SafeAreaView>
  );
}
