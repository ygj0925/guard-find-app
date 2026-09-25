/**
 * 发布入口(spec: 五步分步发布表单 / 草稿与离线保护)。
 *
 * 这一页只做三件事:把五步表单的代价讲清楚、给三个入口(新建 / 草稿箱 / 我的档案)、
 * 以及在有本机未完成草稿时给一个"继续填写"。真正的校验与合规勾选都在表单里,
 * 这里不重复实现一套规则,也不展示任何假数据。
 */
import React, { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Archive, ChevronRight, FileText, Megaphone } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { NoticeBar, SectionCard } from '@/components/business/feedback';
import { AntiFraudNotice } from '@/components/business/compliance';
import { STEP_TITLES } from '@/lib/publish/schema';
import { mediaPickerAvailable } from '@/lib/media';
import { useSessionGuard } from '@/providers/SessionProvider';
import { usePublishForm } from '@/store/publish-form';

export default function PublishTabScreen() {
  const router = useRouter();
  const { guard, signedIn } = useSessionGuard();

  // 逐个字段取,不要在 selector 里拼新对象(zustand v5 用 Object.is 比快照)。
  const hydrated = usePublishForm((state) => state.hydrated);
  const localName = usePublishForm((state) => state.values.name);
  const localStep = usePublishForm((state) => state.step);
  const localCaseId = usePublishForm((state) => state.caseId);
  const localUpdatedAt = usePublishForm((state) => state.updatedAt);
  const pendingSync = usePublishForm((state) => state.pendingSync);
  const hydrate = usePublishForm((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const hasLocalDraft = hydrated && Boolean(localUpdatedAt && (localName || localCaseId));
  const mediaAvailable = mediaPickerAvailable();

  /** 未登录点发布:记录回跳目标后跳登录,登录回来仍在第一步(spec 场景「未登录点发布被引导」)。 */
  const startPublish = useCallback(() => {
    if (guard({ href: '/publish/case', label: 'publish' })) return;
    router.push('/publish/case');
  }, [guard, router]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center gap-2 pb-3 pt-2">
          <Icon as={Megaphone} size={20} className="text-primary" />
          <Text className="text-xl font-bold">发布寻人</Text>
        </View>

        <SectionCard
          title="发布寻人信息"
          description="五个分步表单:基本信息 → 时空信息 → 体貌特征 → 情形与联络 → 确认发布。提交后进入人工审核,通过后才会出现在广场。"
        >
          <Button testID="publish-start" className="h-11" onPress={startPublish}>
            <Text>开始填写</Text>
          </Button>
          {!signedIn ? (
            <Text className="text-muted-foreground mt-2 text-xs">
              需要登录。未注册的手机号验证通过后会自动创建账号。
            </Text>
          ) : null}
          {!mediaAvailable ? (
            <Text className="text-pending mt-2 text-xs">
              当前设备的图片选择能力不可用:可先填写文字并保存草稿,图片稍后补齐。
            </Text>
          ) : null}
        </SectionCard>

        {hasLocalDraft ? (
          <View className="border-primary/40 bg-primary/5 mb-3 rounded-xl border p-4">
            <Text className="text-sm font-semibold">
              本机有未完成的草稿{localName ? `:${localName}` : ''}
            </Text>
            <Text className="text-muted-foreground mt-1 text-xs">
              停在第 {localStep + 1} / {STEP_TITLES.length} 步。{pendingSync ? '尚未同步到云端。' : '已同步到云端。'}
            </Text>
            <Button size="sm" className="mt-3" onPress={() => router.push('/publish/case')}>
              <Text>继续填写</Text>
            </Button>
          </View>
        ) : null}

        <SectionCard title="已发布内容" description="草稿、待审核、已发布、已驳回的档案都在这里管理">
          <EntryRow
            icon={FileText}
            label="草稿箱"
            description="续填本机与云端草稿,或直接提交审核"
            onPress={() => router.push('/publish/drafts')}
          />
          <EntryRow
            icon={Archive}
            label="我的档案"
            description="续期、撤回、标记找回、查看驳回理由、申请删除"
            onPress={() => router.push('/me/cases')}
          />
        </SectionCard>

        <NoticeBar
          tone="info"
          title="发布前请先确认这两件事"
          lines={[
            '你已获得失踪人员权利人(本人、监护人或近亲属)的同意。',
            '内容与你能核实的事实一致;详细地址与联系电话不对公众展示。',
          ]}
        />
        <AntiFraudNotice />

        <SectionCard title="五步都要填什么" className="mt-3">
          {STEP_TITLES.map((title, index) => (
            <View key={title} className="flex-row items-center gap-2 py-1.5">
              <Text className="text-muted-foreground w-5 text-xs">{index + 1}</Text>
              <Text className="text-sm">{title}</Text>
            </View>
          ))}
          <Text className="text-muted-foreground mt-2 text-xs">
            每一步都可返回上一步,已填内容与已选图片不会被重置。
          </Text>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function EntryRow({
  icon,
  label,
  description,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="border-border flex-row items-center gap-3 border-b py-3 last:border-b-0"
    >
      <Icon as={icon} size={18} className="text-muted-foreground" />
      <View className="flex-1">
        <Text className="text-sm font-medium">{label}</Text>
        <Text className="text-muted-foreground mt-0.5 text-xs">{description}</Text>
      </View>
      <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}
