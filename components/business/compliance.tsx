/**
 * 合规告知文案(spec: 合规告知与真实承诺 / 线索防骗提示)。
 *
 * 三处页面(详情、线索表单、发布第五步)都要求"常驻"展示,所以文案集中在这里,
 * 避免同一句法律性表述在各页出现三个版本。
 *
 * 契约 v1 没有提供《用户协议》《隐私政策》全文的读取端点,因此协议弹层只展示
 * 与提交字段直接相关的条款要点,并明示"全文以运营方公示版本为准"—— 不编造链接。
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { NoticeBar } from './feedback';

/** 契约 / 规格里逐字要求出现的防骗提示。 */
export const ANTI_FRAUD_TITLE = '防骗提醒:本平台不收取任何费用';
export const ANTI_FRAUD_LINES = [
  '官方不会通过本应用收取任何费用,请勿转账、勿缴纳核实费或邮费。',
  '任何以"垫付路费""保证金""DNA 加急费"为名的要求都是诈骗,请立即举报。',
  '线索只通过 App 内提交,家属不会主动索要你的银行卡或验证码。',
];

export function AntiFraudNotice({ compact }: { compact?: boolean }) {
  const lines = compact ? [ANTI_FRAUD_LINES[0], ANTI_FRAUD_LINES[2]] : ANTI_FRAUD_LINES;
  return <NoticeBar tone="danger" title={ANTI_FRAUD_TITLE} lines={lines} />;
}

/** 第五步的两项强制勾选文案(顺序与 `PublishValues` 的两个布尔位一致)。 */
export const AGREEMENT_ITEMS = [
  {
    key: 'agreementRights' as const,
    label: '我确认已获得失踪人员权利人同意发布这些信息',
    description: '权利人包括失踪人员本人、其监护人或近亲属。未获同意请不要发布。',
  },
  {
    key: 'agreementTruthful' as const,
    label: '我承诺信息真实,虚假发布愿承担相应责任',
    description: '编造、夸大或冒用他人信息发布的档案会被下架并追责。',
  },
];

const AGREEMENT_POINTS = [
  '数据用途:你提交的寻人信息仅用于在本平台发布线索、供经审核的志愿者与家属协作核实。',
  '脱敏规则:公开列表与公开详情只展示失踪年月、到市(详情到区)的区划与脱敏照片,不展示详细地址与联系电话。',
  '线索往来:线索默认通过 App 内消息转达,选择"公开电话"才会把号码给到档案所有人。',
  '保留与删除:你可以随时撤回档案;申请删除后姓名、照片、详细地址等识别信息将被永久清除且不可恢复。',
  '账号注销:提交后有 15 日冷静期,期内登录可撤销;冷静期满后按公示规则清除数据。',
  '实时提醒:一期无系统级推送,关闭 App 后可能收不到实时提醒,重要结果请以站内信为准。',
];

/**
 * 协议要点入口。
 * 展示要点 + 当前 `agreementVersion`,不伪装成外链。
 */
export function AgreementLinks({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1 py-1"
      >
        <Text className="text-primary text-sm underline">《用户协议》与《隐私政策》要点</Text>
      </Pressable>
      <Text className="text-muted-foreground text-xs">
        协议版本 {version};全文以运营方公示版本为准。
      </Text>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80%]">
          <DialogHeader>
            <DialogTitle>协议与隐私要点</DialogTitle>
            <DialogDescription>版本 {version}</DialogDescription>
          </DialogHeader>
          <ScrollView>
            {AGREEMENT_POINTS.map((point) => (
              <Text key={point} className="mb-3 text-sm leading-5">
                {point}
              </Text>
            ))}
            <Text className="text-muted-foreground mb-3 text-xs leading-4">
              契约 v1 未提供协议全文读取接口,此处仅列出与本次提交直接相关的要点,完整条款请向运营方索取。
            </Text>
          </ScrollView>
          <DialogFooter>
            <Button onPress={() => setOpen(false)}>
              <Text>已阅读</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

/** 一期无系统推送的固定说明(消息中心与通知偏好页共用)。 */
export const PUSH_LIMIT_NOTE =
  '一期没有系统级推送:App 关闭后可能收不到实时提醒,请定期回到消息中心查看。';
