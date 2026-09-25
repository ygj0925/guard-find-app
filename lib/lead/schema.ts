/**
 * 线索表单校验(spec: 线索提交表单 / 契约 4 节)。
 *
 * 与发布表单分开的原因:线索是"少字段 + 强时效"的表单,要求可单独测;
 * 两个表单共用的只有媒体上限常量,统一放这里以免两处各写一个数字。
 */
import { z } from 'zod';
import type { ContactMode } from '@/lib/api/endpoints/case';
import type { LeadReq } from '@/lib/api/endpoints/lead';
import type { MediaItem } from '@/lib/media';

/** 契约 4 节:单条线索最多 3 张图。 */
export const MAX_MEDIA_PER_LEAD = 3;
export const LEAD_DESCRIPTION_MIN = 10;
export const LEAD_DESCRIPTION_MAX = 1000;
/** 发现地点长度:与服务端 `occurAddress` 一致,超出不发请求。 */
export const LEAD_ADDRESS_MAX = 120;

export interface LeadValues {
  occurTime: string;
  occurAddress: string;
  description: string;
  media: MediaItem[];
  contactMode: ContactMode;
  contactValue: string;
}

export function emptyLeadValues(): LeadValues {
  return {
    occurTime: '',
    occurAddress: '',
    description: '',
    media: [],
    contactMode: 'IN_APP',
    contactValue: '',
  };
}

const dateTimePattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

export const leadSchema = z
  .object({
    occurTime: z
      .string()
      .regex(dateTimePattern, '请选择发现时间')
      .refine((value) => {
        const time = new Date(value.replace(' ', 'T')).getTime();
        return Number.isFinite(time) && time <= Date.now();
      }, '发现时间不能晚于当前时间'),
    occurAddress: z
      .string()
      .trim()
      .min(2, '请填写发现地点(至少 2 个字)')
      .max(LEAD_ADDRESS_MAX, `发现地点不超过 ${LEAD_ADDRESS_MAX} 字`),
    description: z
      .string()
      .trim()
      .min(LEAD_DESCRIPTION_MIN, `线索描述至少 ${LEAD_DESCRIPTION_MIN} 字`)
      .max(LEAD_DESCRIPTION_MAX, `线索描述不超过 ${LEAD_DESCRIPTION_MAX} 字`),
    media: z.array(z.unknown()).max(MAX_MEDIA_PER_LEAD, `单条线索最多 ${MAX_MEDIA_PER_LEAD} 张图片`),
    contactMode: z.enum(['IN_APP', 'PHONE']),
    contactValue: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (value.contactMode === 'PHONE') {
      if (!value.contactValue) {
        ctx.addIssue({
          code: 'custom',
          path: ['contactValue'],
          message: '选择"公开电话"时须填写联系电话',
        });
      } else if (!/^1[3-9]\d{9}$/.test(value.contactValue)) {
        ctx.addIssue({ code: 'custom', path: ['contactValue'], message: '手机号格式不正确' });
      }
    }
  });

export interface LeadValidation {
  ok: boolean;
  errors: Record<string, string>;
  formError?: string;
}

/** 与发布表单同一套"字段名 -> 首条错误文案"约定,供 `components/form/fields` 直接吃。 */
export function validateLead(values: LeadValues): LeadValidation {
  const parsed = leadSchema.safeParse(values);
  if (parsed.success) return { ok: true, errors: {} };
  const errors: Record<string, string> = {};
  let formError: string | undefined;
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.');
    if (!path) {
      formError = formError ?? issue.message;
      continue;
    }
    if (!errors[path]) errors[path] = issue.message;
  }
  return { ok: false, errors, formError };
}

/** 表单值 -> 契约 `LeadReq`。`contactMode=IN_APP` 时 MUST NOT 上送电话。 */
export function toLeadReq(values: LeadValues, uploadedUrls: string[]): LeadReq {
  return {
    occurTime: values.occurTime,
    occurAddress: values.occurAddress.trim(),
    description: values.description.trim(),
    mediaUrls: uploadedUrls,
    contactMode: values.contactMode,
    contactValue: values.contactMode === 'PHONE' ? values.contactValue.trim() : null,
  };
}

/** 描述字数提示:页面上实时展示"还差几字",spec 要求"提示字数要求"。 */
export function descriptionCountHint(length: number): string {
  if (length < LEAD_DESCRIPTION_MIN) return `还需 ${LEAD_DESCRIPTION_MIN - length} 字`;
  if (length > LEAD_DESCRIPTION_MAX) return `超出 ${length - LEAD_DESCRIPTION_MAX} 字`;
  return `${length}/${LEAD_DESCRIPTION_MAX} 字`;
}

export { z };
