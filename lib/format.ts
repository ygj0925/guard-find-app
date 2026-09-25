/**
 * 展示层格式化。服务端时间格式固定 `yyyy-MM-dd HH:mm:ss`(Asia/Shanghai),
 * 这里只做字符串处理,不做时区换算 —— 换算交给服务端,避免三端 Intl 差异。
 */
import type { CasePublic, CaseStatus, ConfirmType, UrgencyLevel } from '@/lib/api/endpoints/case';
import type { LeadStatus, Lead } from '@/lib/api/endpoints/lead';
import type { MessageType } from '@/lib/api/endpoints/message';
import type { Gender, IdentityType, RealNameStatus } from '@/lib/api/endpoints/auth';

/** `2026-09-24 10:20:00` -> Date。解析失败返回 null,不返回 Invalid Date。 */
export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const matched = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!matched) return null;
  const [, y, mo, d, h, mi, s] = matched;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 表单要提交给服务端的 `yyyy-MM-dd HH:mm:ss`。 */
export function toServerTime(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}:00`;
}

export function toServerDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** `2024-08` -> `2024年8月`;非 `yyyy-MM` 原样返回。 */
export function formatMissingMonth(month: string | null | undefined): string {
  if (!month) return '时间未知';
  const matched = /^(\d{4})-(\d{2})$/.exec(month);
  if (!matched) return month;
  return `${matched[1]}年${Number(matched[2])}月`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '未填写';
  return value.replace('T', ' ').slice(0, 16);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '未填写';
  return value.slice(0, 10);
}

/** 相对时间:刚刚 / N 分钟前 / N 小时前 / N 天前 / 具体日期。 */
export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  const date = parseServerTime(value);
  if (!date) return '时间未知';
  const diff = Math.max(0, now - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(value);
}

/** 紧急度不能只靠颜色:同时给出文字与小时数(spec 卡片要求)。 */
export function formatMissingHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '时长未知';
  if (hours < 24) return `已失踪 ${Math.max(1, Math.floor(hours))} 小时`;
  const days = Math.floor(hours / 24);
  const rest = Math.floor(hours % 24);
  return rest > 0 ? `已失踪 ${days} 天 ${rest} 小时` : `已失踪 ${days} 天`;
}

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  NORMAL: '常规',
  URGENT: '紧急',
  CRITICAL: '特急',
};

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  PUBLISHED: '已发布',
  REJECTED: '已驳回',
  ARCHIVED: '已归档',
  FOUND: '已找回',
  WITHDRAWN: '已撤回',
  OFFLINE: '已下架',
  ERASED: '已删除',
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  PENDING: '待处理',
  ACCEPTED: '已采纳',
  REJECTED: '已忽略',
  CONTACTED: '已联系',
};

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  CASE_APPROVED: '审核通过',
  CASE_REJECTED: '审核驳回',
  CASE_LEAD: '新线索',
  LEAD_REPLIED: '线索回复',
  CASE_FOUND: '找回喜报',
  CASE_EXPIRING: '即将超期',
  REPORT_RESULT: '举报处理结果',
  CASE_PUBLISHED: '档案已发布',
  SYSTEM: '系统公告',
};

/** 消息分组:与 `category` 的四值一一对应。 */
export const MESSAGE_CATEGORY_LABEL = {
  AUDIT: '审核结果',
  LEAD: '线索动态',
  RESULT: '找回与临期',
  SYSTEM: '系统公告',
} as const;

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: '男',
  FEMALE: '女',
  UNKNOWN: '未知',
};

/** 契约 1.3 穷举的三值身份;展示文案在"我的"与资料编辑页共用一份。 */
export const IDENTITY_LABEL: Record<IdentityType, string> = {
  GUARDIAN: '失踪人员家属 / 监护人',
  VOLUNTEER: '志愿者',
  PUBLIC: '普通用户(关注与转扩)',
};

/** 契约 1 节 `realNameStatus`:实名认证进度文案。 */
export const REAL_NAME_STATUS_LABEL: Record<RealNameStatus, string> = {
  UNCHECKED: '未认证',
  CHECKING: '审核中',
  PASSED: '已认证',
  REJECTED: '未通过',
};

/** 标记找回的确认依据(契约 2 节 `ConfirmType`)。 */
export const CONFIRM_TYPE_LABEL: Record<ConfirmType, string> = {
  POLICE: '警方受理证明',
  GUARDIAN: '家属/监护人确认',
  DNA: 'DNA 比对一致',
};

export function caseAgeText(item: Pick<CasePublic, 'ageAtMissing' | 'ageGroup'>): string {
  if (typeof item.ageAtMissing === 'number' && item.ageAtMissing > 0) return `${item.ageAtMissing} 岁`;
  const map: Record<string, string> = {
    '0_6': '0-6 岁',
    '7_12': '7-12 岁',
    '13_17': '13-17 岁',
    '18_PLUS': '18 岁以上',
  };
  return map[item.ageGroup] ?? '年龄不详';
}

export function leadHighRiskText(lead: Pick<Lead, 'highRisk'>): string | null {
  return lead.highRisk ? '待核实' : null;
}

/** 秒 -> `mm:ss`,登录页验证码倒计时用。 */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}

/** 剩余锁定时间:4006 错误用。 */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  if (minutes > 0) return `${minutes} 分钟`;
  return `${safe} 秒`;
}

/** 图片体积提示用。 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 省市区代码 -> 文字。字典来自 /app/plaza/filters,查不到就回落到已知的市级文字。 */
export function regionTextFromCodes(
  regionLabelByCode: Record<string, string>,
  codes: (string | null | undefined)[],
): string {
  const labels = codes
    .map((code) => (code ? regionLabelByCode[code] : undefined))
    .filter((label): label is string => Boolean(label));
  return labels.join(' ');
}
