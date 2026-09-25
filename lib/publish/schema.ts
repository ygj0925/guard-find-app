/**
 * 五步发布表单的分步校验(spec: 五步分步发布表单 / 合规告知与真实承诺)。
 *
 * 一个决定:表单状态用自建 `store/publish-form.ts` + 这里的 zod 分步 schema,
 * 而不是 react-hook-form 托管全部字段。原因:
 *   - 草稿要能在离线时逐键落本地存储,受控于 zustand 更直接;
 *   - 分步校验需要"跨字段规则"(第三步至少一项体貌、失踪时间不得晚于现在),
 *     zod 的 superRefine 比 RHF 的 resolver 更好测;
 *   - 图片选取是异步能力,字段值由能力层回填。
 * 字段级 UI 仍复用 components/ui 的 Input/Textarea/Checkbox 原语。
 */
import { z } from 'zod';
import type { Gender } from '@/lib/api/endpoints/auth';
import {
  type BloodSampleStatus,
  type CaseDraftReq,
  type CaseMedia,
  type CaseType,
  type ContactMode,
} from '@/lib/api/endpoints/case';
import { ApiCode, ApiError } from '@/lib/api/error';
import type { MediaItem } from '@/lib/media';

export const MAX_MEDIA_PER_CASE = 9;
// 线索侧的媒体/字数上限在 `lib/lead/schema.ts`,两个表单不各写一份。

/**
 * 契约里的枚举值由 `GET /app/plaza/filters` 下发(`Option.value` 是 string),
 * 但取值集合本身在契约 2 节已穷举,所以在选择器入口做一次显式收窄(`asCaseType` 等),
 * 表单内部保持强类型。`''` 是"用户尚未选择"的哨兵值,由分步校验拦住。
 */
export type CaseTypeValue = CaseType | '';
export type BloodSampleValue = BloodSampleStatus | '';

const CASE_TYPES: readonly CaseType[] = [
  'TRAFFICKING',
  'MISSING',
  'LOST',
  'NO_CONTACT',
  'LOST_ELDERLY',
];

const BLOOD_SAMPLE_STATUSES: readonly BloodSampleStatus[] = [
  'NOT_COLLECTED',
  'COLLECTED',
  'UNKNOWN',
];

/** 字典值 -> 契约枚举。不在契约集合内的值原样保留由服务端判 4001,不静默改成别的枚举。 */
export function asCaseType(value: string): CaseTypeValue {
  return CASE_TYPES.includes(value as CaseType) ? (value as CaseType) : '';
}

export function asBloodSampleStatus(value: string): BloodSampleValue {
  return BLOOD_SAMPLE_STATUSES.includes(value as BloodSampleStatus)
    ? (value as BloodSampleStatus)
    : '';
}

/** 发布表单的全部字段值(跨 5 步,一份对象)。 */
export interface PublishValues {
  relationType: string;
  name: string;
  gender: Gender;
  birthday: string | null;
  ageAtMissing: number | null;
  aliases: { name: string; kind: string }[];
  media: MediaItem[];
  missingTime: string;
  provinceCode: string;
  cityCode: string;
  districtCode: string | null;
  address: string | null;
  hometownCode: string | null;
  height: number | null;
  bodyType: string | null;
  hairType: string | null;
  accent: string | null;
  features: string | null;
  clothing: string | null;
  belongings: string | null;
  caseType: CaseTypeValue;
  narrative: string;
  familyClues: string | null;
  otherNote: string | null;
  policeReported: boolean;
  policeStation: string | null;
  caseNo: string | null;
  bloodSampleStatus: BloodSampleValue;
  followVolunteer: string | null;
  contactMode: ContactMode;
  contactPhone: string | null;
  agreementRights: boolean;
  agreementTruthful: boolean;
  agreementVersion: string;
  agreementAcceptedAt?: string;
  [key: string]: unknown;
}

export function emptyPublishValues(): PublishValues {
  return {
    relationType: '',
    name: '',
    gender: 'UNKNOWN',
    birthday: null,
    ageAtMissing: null,
    aliases: [],
    media: [],
    missingTime: '',
    provinceCode: '',
    cityCode: '',
    districtCode: null,
    address: null,
    hometownCode: null,
    height: null,
    bodyType: null,
    hairType: null,
    accent: null,
    features: null,
    clothing: null,
    belongings: null,
    caseType: '',
    narrative: '',
    familyClues: null,
    otherNote: null,
    policeReported: false,
    policeStation: null,
    caseNo: null,
    bloodSampleStatus: 'UNKNOWN',
    followVolunteer: null,
    contactMode: 'IN_APP',
    contactPhone: null,
    agreementRights: false,
    agreementTruthful: false,
    agreementVersion: 'v1',
  };
}

/** `yyyy-MM-dd HH:mm:ss`,与服务端契约一致。 */
const dateTimePattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const aliasSchema = z.object({
  name: z.string().trim().min(1, '别名不能为空'),
  kind: z.string().min(1, '请选择别称类型'),
});

/** 第一步:基本信息 + 至少 1 张近照。 */
export const step1Schema = z
  .object({
    relationType: z.string().min(1, '请选择与您的关系'),
    name: z.string().trim().min(2, '姓名至少 2 个字').max(32, '姓名过长'),
    gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN'], { message: '请选择性别' }),
    birthday: z.string().regex(datePattern, '请填写出生日期').nullable().optional(),
    ageAtMissing: z
      .number({ message: '请填写失踪时年龄' })
      .int('年龄需为整数')
      .min(0, '年龄不能为负')
      .max(120, '年龄超出范围'),
    aliases: z.array(aliasSchema).max(5, '别称最多 5 个').optional(),
    media: z.array(z.unknown()).min(1, '请至少上传 1 张近照'),
  })
  .superRefine((value, ctx) => {
    if (value.birthday && !value.ageAtMissing && value.ageAtMissing !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['ageAtMissing'],
        message: '请填写失踪时年龄',
      });
    }
  });

/** 第二步:时空信息。失踪时间不得晚于现在(契约:禁未来)。 */
export const step2Schema = z.object({
  missingTime: z
    .string()
    .regex(dateTimePattern, '请选择失踪日期与时间')
    .refine((value) => {
      const time = new Date(value.replace(' ', 'T')).getTime();
      return Number.isFinite(time) && time <= Date.now();
    }, '失踪时间不能晚于当前时间'),
  provinceCode: z.string().min(1, '请选择省'),
  cityCode: z.string().min(1, '请选择市'),
  districtCode: z.string().optional().nullable(),
  address: z.string().trim().max(120, '详细地址不超过 120 字').optional().nullable(),
  hometownCode: z.string().optional().nullable(),
});

/** 第三步:体貌特征 —— 身高 / 疤痕胎记 / 特征描述至少一项(硬校验)。 */
export const step3Schema = z
  .object({
    height: z.number().positive('身高需为正数').max(280, '身高超出范围').nullable().optional(),
    bodyType: z.string().optional().nullable(),
    hairType: z.string().optional().nullable(),
    accent: z.string().trim().max(60, '口音描述过长').optional().nullable(),
    features: z.string().trim().max(500, '特征描述不超过 500 字').optional().nullable(),
    clothing: z.string().trim().max(200).optional().nullable(),
    belongings: z.string().trim().max(200).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasHeight = typeof value.height === 'number' && value.height > 0;
    const hasFeatures = Boolean(value.features?.trim());
    if (!hasHeight && !hasFeatures) {
      ctx.addIssue({
        code: 'custom',
        path: ['features'],
        message: '至少填写一项体貌特征(身高或疤痕/胎记特征描述)',
      });
    }
  });

/** 第四步:情形与联络方式。 */
export const step4Schema = z
  .object({
    caseType: z.string().min(1, '请选择情形'),
    narrative: z.string().trim().min(10, '经过描述至少 10 字').max(2000, '经过描述不超过 2000 字'),
    familyClues: z.string().trim().max(1000).optional().nullable(),
    otherNote: z.string().trim().max(500).optional().nullable(),
    policeReported: z.boolean({ message: '请选择是否已报警' }),
    policeStation: z.string().trim().max(60).optional().nullable(),
    caseNo: z.string().trim().max(60).optional().nullable(),
    bloodSampleStatus: z.string().min(1, '请选择血样采集情况'),
    followVolunteer: z.string().trim().max(32).optional().nullable(),
    contactMode: z.enum(['IN_APP', 'PHONE'], { message: '请选择可公开的联络方式' }),
    contactPhone: z.string().trim().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.contactMode === 'PHONE') {
      if (!value.contactPhone) {
        ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: '选择公开电话时必须填写号码' });
      } else if (!/^1[3-9]\d{9}$/.test(value.contactPhone)) {
        ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: '手机号格式不正确' });
      }
    }
    if (value.policeReported && !value.policeStation?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['policeStation'],
        message: '已报警请填写受理派出所',
      });
    }
  });

/** 第五步:合规告知。两项都勾才允许提交。 */
export const step5Schema = z
  .object({
    agreementRights: z.literal(true, {
      message: '需确认已获得权利人同意',
    }),
    agreementTruthful: z.literal(true, {
      message: '需承诺信息真实',
    }),
    agreementVersion: z.string().min(1),
    agreementAcceptedAt: z.string().optional(),
  })
  .refine(
    (value) => value.agreementRights === true && value.agreementTruthful === true,
    '请先完成两项合规勾选',
  );

export const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema, step4Schema, step5Schema] as const;

export const STEP_TITLES = [
  '基本信息',
  '时空信息',
  '体貌特征',
  '情境联络',
  '确认发布',
] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4;

export interface StepValidation {
  ok: boolean;
  /** 字段名 -> 首条错误文案。 */
  errors: Record<string, string>;
  /** 跨字段/整步级错误。 */
  formError?: string;
}

/** 把 zod issues 压成"字段 -> 首条消息",供表单定位到具体字段。 */
export function validateStep(step: StepIndex, values: unknown): StepValidation {
  const parsed = STEP_SCHEMAS[step].safeParse(values);
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

/**
 * 图片选择阶段的即时校验在 `lib/media.ts`(超额/超大 MUST 在选择时就提示)。
 */

/**
 * 鸿蒙/未接入系统选图能力时,"第一步至少 1 张近照"降级为提示而不是硬拦
 * (spec: 能力不可用要返回可识别的 unsupported 并给出降级 UI)。
 * 只放过 `media` 这一条错误,其余必填项照旧拦截。
 */
export function softenMediaError(
  step: StepIndex,
  result: StepValidation,
  mediaRequired: boolean,
): StepValidation {
  if (step !== 0 || mediaRequired || result.ok) return result;
  if (Object.keys(result.errors).some((key) => key !== 'media')) return result;
  return { ok: true, errors: {} };
}

/**
 * 表单值 -> 契约 `CaseReq`(草稿体见 `CaseDraftReq`)。
 * `submit=false` 存 DRAFT,`true` 进 PENDING_REVIEW。
 *
 * 情形(caseType)在契约里是必填枚举:提交路径必须先过 step4 校验,
 * 留空时直接抛 4003(契约"业务规则拒绝"),而不是前端编一个默认情形;
 * 草稿路径允许留空,由服务端按 DRAFT 放行。
 */
export function toCaseReq(
  values: PublishValues,
  options: {
    submit: boolean;
    agreementVersion: string;
    uploadedUrls: string[];
    forceSubmit?: boolean;
  },
): CaseDraftReq {
  const mediaUrls: CaseMedia[] = options.uploadedUrls.map((url, index) => ({
    url,
    type: 'PHOTO',
    sort: index,
  }));
  if (options.submit && !values.caseType) {
    throw new ApiError({
      code: ApiCode.RULE_REJECTED,
      msg: '未满足发布要求:请选择失踪情形',
      bizCode: ApiCode.RULE_REJECTED,
    });
  }
  return {
    submit: options.submit,
    relationType: values.relationType,
    name: values.name,
    gender: values.gender,
    birthday: values.birthday || null,
    ageAtMissing: values.ageAtMissing ?? null,
    aliases: (values.aliases ?? []).filter((alias) => Boolean(alias?.name)),
    missingTime: values.missingTime,
    provinceCode: values.provinceCode,
    cityCode: values.cityCode,
    districtCode: values.districtCode || null,
    address: values.address || null,
    hometownCode: values.hometownCode || null,
    lng: null,
    lat: null,
    height: values.height ?? null,
    bodyType: values.bodyType || null,
    hairType: values.hairType || null,
    accent: values.accent || null,
    features: values.features || null,
    clothing: values.clothing || null,
    belongings: values.belongings || null,
    // 提交路径必须先过 step4 校验;草稿路径允许留空,但契约要求该字段有值,
    // 因此留空时上送字面量 '' 由服务端判 4001/放行草稿,而不是前端编一个情形。
    caseType: values.caseType,
    narrative: values.narrative || '',
    familyClues: values.familyClues || null,
    otherNote: values.otherNote || null,
    policeReported: values.policeReported ?? false,
    policeStation: values.policeStation || null,
    caseNo: values.caseNo || null,
    bloodSampleStatus: values.bloodSampleStatus || null,
    followVolunteer: values.followVolunteer || null,
    contactMode: values.contactMode ?? 'IN_APP',
    contactPhone: values.contactMode === 'PHONE' ? values.contactPhone || null : null,
    mediaUrls,
    agreementVersion: options.agreementVersion,
    agreementAccepted: Boolean(values.agreementRights && values.agreementTruthful),
    forceSubmit: options.forceSubmit ?? false,
  };
}

export type StepSchemas = typeof STEP_SCHEMAS;
export { z };
