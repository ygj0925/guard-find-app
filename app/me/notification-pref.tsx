/**
 * 通知偏好(spec: 通知偏好设置 / 实时到达与降级轮询)。
 *
 * 数据只有一个来源:`GET /app/notification/preference`,页面不写死事件清单。
 * 三条规则:
 *   1. `inboxForced=true` 的行(审核结果类)站内信开关渲染为禁用态并说明原因,
 *      这一行永远不会因为站内信位被改动而发出保存请求;
 *   2. 短信位默认关闭:`smsEnabled` 取服务端值,费用说明优先用 `smsNote`,
 *      没有说明时用"运营商计费"这一条中性提示,不承诺免费;
 *   3. 保存只提交真正改过的行(`PUT /app/notification/preference`),没改动就不发请求。
 *
 * 一期没有系统级推送:离线提醒能力未开放,这一点在页面顶部常驻说明。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BellOff } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { SwitchField } from '@/components/form/fields';
import { EmptyState, ErrorState, NoticeBar, SectionCard } from '@/components/business/feedback';
import { PUSH_LIMIT_NOTE } from '@/components/business/compliance';
import { useRequest } from '@/hooks/useRequest';
import {
  messageApi,
  type Preference,
  type PreferenceItemReq,
} from '@/lib/api/endpoints/message';
import { toUserMessage } from '@/lib/api/error';
import { MESSAGE_CATEGORY_LABEL, MESSAGE_TYPE_LABEL } from '@/lib/format';
import { useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';

/** 服务端没给 `smsNote` 时的兜底说明(只陈述计费事实,不编造金额)。 */
const SMS_COST_NOTE = '开启后可能产生运营商短信费用,由运营商收取。';

const FORCED_INBOX_NOTE = '审核结果必须送达,不支持在 App 内关闭。';

interface DraftRow {
  type: Preference['type'];
  label: string;
  inboxEnabled: boolean;
  inboxForced: boolean;
  smsEnabled: boolean;
  smsNote: string | null;
}

function toDraft(item: Preference): DraftRow {
  return {
    type: item.type,
    label: item.label,
    inboxEnabled: item.inboxForced ? true : item.inboxEnabled,
    inboxForced: item.inboxForced,
    smsEnabled: item.smsEnabled,
    smsNote: item.smsNote,
  };
}

export default function NotificationPreferenceScreen() {
  const { toast } = useToast();
  const { guard, signedIn } = useSessionGuard();

  const [baseline, setBaseline] = useState<DraftRow[]>([]);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const request = useRequest(() => messageApi.preferences(), [], {
    enabled: signedIn,
    // 每次拿到服务端结果都重置本地副本:偏好是账号级配置,不允许残留上一次的编辑。
    // 重置写在数据落地回调里(异步续体),而不是在 effect 同步体里连续 setState。
    onData: (data) => {
      const items = (data.items ?? []).map(toDraft);
      setBaseline(items);
      setDraft(items);
    },
  });

  const changedTypes = useMemo(() => {
    const base = new Map(baseline.map((row) => [row.type, row]));
    return draft
      .filter((row) => {
        const original = base.get(row.type);
        if (!original) return false;
        const inboxChanged = !row.inboxForced && row.inboxEnabled !== original.inboxEnabled;
        const smsChanged = row.smsEnabled !== original.smsEnabled;
        return inboxChanged || smsChanged;
      })
      .map((row) => row.type);
  }, [baseline, draft]);

  const patchRow = useCallback((type: Preference['type'], patch: Partial<DraftRow>) => {
    setDraft((current) =>
      current.map((row) => (row.type === type ? { ...row, ...patch } : row)),
    );
  }, []);

  const save = useCallback(async () => {
    setSaveError(null);
    const base = new Map(baseline.map((row) => [row.type, row]));
    const items: PreferenceItemReq[] = [];
    for (const row of draft) {
      const original = base.get(row.type);
      if (!original) continue;
      // 强制行的站内信位不可能变化:即使 UI 出错也不会把它提交成"关闭"。
      const inboxChanged = !row.inboxForced && row.inboxEnabled !== original.inboxEnabled;
      const smsChanged = row.smsEnabled !== original.smsEnabled;
      if (!inboxChanged && !smsChanged) continue;
      items.push({
        type: row.type,
        inboxEnabled: row.inboxForced ? true : row.inboxEnabled,
        smsEnabled: row.smsEnabled,
      });
    }
    if (!items.length) {
      toast('没有需要保存的改动', 'info');
      return;
    }
    setSaving(true);
    try {
      await messageApi.savePreferences(items);
      toast(`已保存 ${items.length} 项偏好`, 'success');
      void request.reload();
    } catch (error) {
      setSaveError(toUserMessage(error));
    } finally {
      setSaving(false);
    }
  }, [baseline, draft, request, toast]);

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-4">
          <NoticeBar
            tone="info"
            title="登录后查看通知偏好"
            lines={['偏好是账号级配置,未登录时服务端不会返回任何清单。']}
          />
          <Button
            testID="notification-login"
            onPress={() => guard({ href: '/me/notification-pref', label: 'notification-pref' })}
          >
            <Text>去登录</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center gap-2 pb-2 pt-3">
          <Icon as={BellOff} size={18} className="text-muted-foreground" />
          <Text className="text-base font-semibold">通知偏好</Text>
          {changedTypes.length ? (
            <Badge variant="outline">
              <Text>{changedTypes.length} 项待保存</Text>
            </Badge>
          ) : null}
        </View>

        <NoticeBar
          tone="warn"
          title="一期不支持离线推送"
          lines={[
            PUSH_LIMIT_NOTE,
            '这里的开关只决定"站内信是否产生"和"是否额外发短信";App 在前台时通过实时通道提醒,断线后降级为定时轮询。',
            '如需降低打扰,可关闭非强制类别的站内信;审核结果类不支持关闭。',
          ]}
        />

        {request.isInitialLoading ? (
          <View className="pt-3">
            <Skeleton className="mb-3 h-24 rounded-xl" />
            <Skeleton className="mb-3 h-24 rounded-xl" />
          </View>
        ) : request.error && !draft.length ? (
          <ErrorState error={request.error} onRetry={() => void request.reload()} />
        ) : !draft.length ? (
          <EmptyState
            title="服务端没有返回可配置的通知事件"
            description="可能是账号权限或配置未初始化;稍后重试或联系运营方。"
          />
        ) : (
          <View className="pt-3">
            {draft.map((row) => (
              <PreferenceRow
                key={row.type}
                row={row}
                onInbox={(next) => patchRow(row.type, { inboxEnabled: next })}
                onSms={(next) => patchRow(row.type, { smsEnabled: next })}
              />
            ))}
          </View>
        )}

        {saveError ? (
          <Text accessibilityRole="alert" className="text-urgent mt-2 text-sm">
            {saveError}
          </Text>
        ) : null}

        {draft.length ? (
          <View className="mt-4">
            <Button
              testID="notification-save"
              className="h-11"
              disabled={saving || changedTypes.length === 0}
              onPress={() => void save()}
            >
              <Text>{saving ? '保存中' : '保存改动'}</Text>
            </Button>
            <Text className="text-muted-foreground mt-2 text-xs">
              没有改动时按钮禁用;保存只提交改动过的事件行。
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PreferenceRow({
  row,
  onInbox,
  onSms,
}: {
  row: DraftRow;
  onInbox: (next: boolean) => void;
  onSms: (next: boolean) => void;
}) {
  return (
    <SectionCard
      title={row.label || MESSAGE_TYPE_LABEL[row.type]}
      description={`事件类型:${MESSAGE_TYPE_LABEL[row.type] ?? row.type}`}
      className="mb-3 p-4"
    >
      <SwitchField
        testID={`notification-inbox-${row.type}`}
        label="站内信提醒"
        value={row.inboxForced ? true : row.inboxEnabled}
        disabled={row.inboxForced}
        hint={row.inboxForced ? FORCED_INBOX_NOTE : '消息会出现在消息中心,并按类型分组'}
        onValueChange={onInbox}
      />
      {row.inboxForced ? (
        <Text className="text-muted-foreground pb-1 text-xs">
          该事件的站内信为强制项:即使这一行被提交,也只会带上「保持开启」的状态,不会发出关闭请求。
        </Text>
      ) : null}

      <SwitchField
        testID={`notification-sms-${row.type}`}
        label="额外短信提醒"
        value={row.smsEnabled}
        hint={row.smsNote || SMS_COST_NOTE}
        onValueChange={onSms}
      />
      {!row.smsEnabled ? (
        <Text className="text-muted-foreground text-xs">
          默认关闭。
          {row.type === 'CASE_LEAD' ? '新线索数量较大时,短信容易形成费用与打扰,建议先用站内信。' : ''}
        </Text>
      ) : null}
      <Text className="text-muted-foreground pt-1 text-xs">
        分类:{categoryHintOf(row.type)}
      </Text>
    </SectionCard>
  );
}

/** 只用于说明这一行会落在消息中心的哪个分组,分组口径与消息中心一致。 */
function categoryHintOf(type: Preference['type']): string {
  if (type === 'CASE_APPROVED' || type === 'CASE_REJECTED' || type === 'REPORT_RESULT') {
    return MESSAGE_CATEGORY_LABEL.AUDIT;
  }
  if (type === 'CASE_LEAD' || type === 'LEAD_REPLIED') return MESSAGE_CATEGORY_LABEL.LEAD;
  if (type === 'CASE_FOUND' || type === 'CASE_EXPIRING') return MESSAGE_CATEGORY_LABEL.RESULT;
  return MESSAGE_CATEGORY_LABEL.SYSTEM;
}
