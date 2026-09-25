/**
 * 2. 寻人档案(`/app/find/case`)—— 字段逐字对齐契约 2 节。
 *
 * 脱敏边界是硬要求:`CasePublic` 绝不含 address / contactPhone / 精确到日的 missingTime,
 * 由 `__tests__/case-redaction.test.ts` 用类型 + 运行时白名单双重把守。
 */
import { api } from '../client';
import type { PageQuery, PageResp } from './common';
import type { Gender } from './auth';

export type CaseType =
  | 'TRAFFICKING'
  | 'MISSING'
  | 'LOST'
  | 'NO_CONTACT'
  | 'LOST_ELDERLY';

export type CaseStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED'
  | 'FOUND'
  | 'WITHDRAWN'
  | 'OFFLINE'
  | 'ERASED';

export type UrgencyLevel = 'NORMAL' | 'URGENT' | 'CRITICAL';
export type AgeGroup = '0_6' | '7_12' | '13_17' | '18_PLUS' | string;
export type BloodSampleStatus = 'NOT_COLLECTED' | 'COLLECTED' | 'UNKNOWN';
export type ContactMode = 'IN_APP' | 'PHONE';
export type MediaType = 'PHOTO' | 'VIDEO' | 'AUDIO';
export type ConfirmType = 'POLICE' | 'GUARDIAN' | 'DNA';

export interface CaseAlias {
  name: string;
  kind: 'NICKNAME' | 'CODENAME' | 'OTHER' | string;
}

export interface CaseMedia {
  url: string;
  type: MediaType;
  sort: number;
}

/** POST / PUT 请求体。`submit=false` 存 DRAFT,`true` 直接进 PENDING_REVIEW。 */
export interface CaseReq {
  submit: boolean;
  relationType: string;
  name: string;
  gender: Gender;
  birthday?: string | null;
  ageAtMissing?: number | null;
  aliases?: CaseAlias[];
  missingTime: string;
  provinceCode: string;
  cityCode: string;
  districtCode?: string | null;
  address?: string | null;
  hometownCode?: string | null;
  /** 一期不采集,预留(契约 2 节 / D5)。 */
  lng?: number | null;
  lat?: number | null;
  height?: number | null;
  bodyType?: string | null;
  hairType?: string | null;
  accent?: string | null;
  features?: string | null;
  clothing?: string | null;
  belongings?: string | null;
  caseType: CaseType;
  narrative?: string | null;
  familyClues?: string | null;
  otherNote?: string | null;
  policeReported?: boolean | null;
  policeStation?: string | null;
  caseNo?: string | null;
  bloodSampleStatus?: BloodSampleStatus | null;
  followVolunteer?: string | null;
  contactMode: ContactMode;
  contactPhone?: string | null;
  mediaUrls?: CaseMedia[];
  agreementVersion: string;
  agreementAccepted: boolean;
  forceSubmit?: boolean;
}

/** 广场卡片与公开详情共用,严格脱敏。 */
export interface CasePublic {
  id: string;
  name: string;
  gender: Gender;
  ageGroup: AgeGroup;
  ageAtMissing: number | null;
  aliases: string[];
  /** 只到月。 */
  missingMonth: string;
  /** 只到市。 */
  regionText: string;
  /** 公开详情可精确到区。 */
  districtText: string | null;
  height: number | null;
  features: string | null;
  caseType: CaseType;
  urgencyLevel: UrgencyLevel;
  missingHours: number;
  status: CaseStatus;
  coverUrl: string | null;
  mediaUrls: string[];
  leadCount: number;
  sourceType: 'APP' | 'COLLECT' | string;
  sourceUrl: string | null;
  publishTime: string | null;
  ownerMasked: boolean;
}

/**
 * 草稿体:`submit=false` 时表单尚未填完,枚举位允许留空字符串。
 * 契约 v1 没有区分"草稿体"与"提交体"的必填强度(见交付报告差异条),
 * 服务端对留空枚举只按草稿放行;前端 MUST NOT 为此编一个情形值。
 */
export type CaseDraftReq = Omit<CaseReq, 'caseType'> & { caseType: CaseType | '' };

/** CaseDetail = CasePublic + 完整字段(仅本人 / 志愿者 / 审核可见)。 */
export interface CaseDetail extends CasePublic {
  address: string | null;
  missingTime: string | null;
  birthday: string | null;
  hometownText: string | null;
  bodyType: string | null;
  hairType: string | null;
  accent: string | null;
  clothing: string | null;
  belongings: string | null;
  narrative: string | null;
  familyClues: string | null;
  otherNote: string | null;
  policeReported: boolean | null;
  policeStation: string | null;
  caseNo: string | null;
  bloodSampleStatus: BloodSampleStatus | null;
  followVolunteer: string | null;
  contactMode: ContactMode | null;
  contactPhone: string | null;
  version: number;
  auditRemark: string | null;
  statusHistory: CaseStatusChange[];
}

export interface CaseStatusChange {
  from: CaseStatus | null;
  to: CaseStatus;
  reason: string | null;
  time: string;
  operator: string | null;
}

/** `GET /app/find/case/mine` 的额外状态计数。 */
export interface CaseMineSummary {
  draft: number;
  pendingReview: number;
  published: number;
  rejected: number;
  archived: number;
  found: number;
  offline: number;
}

export interface CaseMineResp extends PageResp<CaseDetail> {
  summary?: CaseMineSummary;
}

export interface FoundReq {
  confirmType: ConfirmType;
  foundTime: string;
  remark?: string;
}

/** 4005 疑似重复档案时,`data.similarCases[]` 给出可对比的候选。 */
export interface SimilarCasesResp {
  similarCases: CasePublic[];
}

export const caseApi = {
  create: (req: CaseReq | CaseDraftReq) => api.post<CaseDetail>('/app/find/case', req),
  update: (id: string, req: CaseReq | CaseDraftReq) =>
    api.put<CaseDetail>(`/app/find/case/${encodeURIComponent(id)}`, req),
  detail: (id: string) =>
    api.get<CasePublic>(`/app/find/case/${encodeURIComponent(id)}`, undefined, {
      anonymous: true,
    }),
  detailFull: (id: string) =>
    api.get<CaseDetail>(`/app/find/case/${encodeURIComponent(id)}/full`),
  mine: (params: PageQuery & { status?: CaseStatus }) =>
    api.get<CaseMineResp>('/app/find/case/mine', { ...params }),
  submit: (id: string) =>
    api.post<CaseDetail>(`/app/find/case/${encodeURIComponent(id)}/submit`),
  found: (id: string, req: FoundReq) =>
    api.post<CaseDetail>(`/app/find/case/${encodeURIComponent(id)}/found`, req),
  renew: (id: string) =>
    api.post<CaseDetail>(`/app/find/case/${encodeURIComponent(id)}/renew`),
  withdraw: (id: string) =>
    api.post<CaseDetail>(`/app/find/case/${encodeURIComponent(id)}/withdraw`),
  erase: (id: string) => api.post<CaseDetail>(`/app/find/case/${encodeURIComponent(id)}/erase`),
};


