/**
 * 档案分享(spec: 收藏与分享 / 契约无 H5 落地域名)。
 *
 * 契约 v1 与 `lib/env` 都没有提供站点域名,因此落地链接用 App scheme 深链
 * (`guardfind://case/{id}`),链接里必须带档案编号 —— 这一点规格写死了。
 * 鸿蒙侧 `shareApi` 返回 `unsupported`,降级动作是"复制链接 + 可长按选中的原文",
 * MUST NOT 静默失败(spec 硬约束)。
 */
import { clipboard, shareApi } from '@/lib/capabilities';
import type { CapabilityResult } from '@/lib/capabilities/result';
import { env } from '@/lib/env';
import { URGENCY_LABEL, formatMissingMonth } from '@/lib/format';
import { trackCaseShare } from '@/lib/track';
import type { CasePublic } from '@/lib/api/endpoints/case';

export interface CaseSharePayload {
  title: string;
  message: string;
  url: string;
}

export function caseDeepLink(caseId: string): string {
  return `${env.APP_SCHEME}://case/${encodeURIComponent(caseId)}`;
}

/** 分享文案严格脱敏:只用 `CasePublic` 里允许公开的字段。 */
export function buildCaseShare(item: CasePublic): CaseSharePayload {
  const urgent = item.urgencyLevel !== 'NORMAL';
  const title = `${urgent ? `【${URGENCY_LABEL[item.urgencyLevel]}】` : ''}寻人档案 ${item.name} 档案编号 ${item.id}`;
  const message = [
    `${item.name}(${item.gender === 'FEMALE' ? '女' : item.gender === 'MALE' ? '男' : '性别不详'}·${item.ageAtMissing ?? item.ageGroup})`,
    `失踪时间 ${formatMissingMonth(item.missingMonth)}`,
    `失踪地区 ${item.regionText}${item.districtText ? ` ${item.districtText}` : ''}`,
    item.features ? `体貌特征:${item.features}` : '',
    '如掌握线索,请通过"天下无拐"App 内提交,官方不收取任何费用。',
  ]
    .filter(Boolean)
    .join('\n');
  return { title, message: `${message}\n${caseDeepLink(item.id)}`, url: caseDeepLink(item.id) };
}

export type ShareOutcome =
  | { kind: 'shared' }
  | { kind: 'copied'; message: string }
  | { kind: 'manual-copy'; message: string }
  | { kind: 'cancelled' };

function describeFailure(result: CapabilityResult<unknown>): string {
  return result.ok ? '' : result.message;
}

/**
 * 分享一个档案。
 * 返回 `copied` 表示"系统分享不可用,已改成复制链接",UI 需据此提示。
 */
export async function shareCase(item: CasePublic): Promise<ShareOutcome> {
  const payload = buildCaseShare(item);
  const result = await shareApi.share(payload);
  if (result.ok) {
    trackCaseShare(item.id);
    return { kind: 'shared' };
  }
  if (result.reason === 'cancelled') return { kind: 'cancelled' };

  const copied = await clipboard.copy(payload.url);
  if (copied.ok) {
    trackCaseShare(item.id);
    return {
      kind: 'copied',
      message: `${describeFailure(result)}链接已复制到剪贴板。`,
    };
  }
  // 连剪贴板都没有:把原文链接交回页面展示,让用户长按选中。
  return { kind: 'manual-copy', message: payload.url };
}
