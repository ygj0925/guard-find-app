/**
 * 4. 线索(`/app/find/case/{id}/lead`、`/app/lead`)—— 对齐契约 4 节。
 */
import { api } from '../client';
import type { PageQuery, PageResp } from './common';
import type { ContactMode } from './case';

export type LeadStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CONTACTED';

export interface LeadReq {
  occurTime: string;
  occurAddress: string;
  description: string;
  mediaUrls?: string[];
  contactMode: ContactMode;
  /** contactMode=PHONE 时必填;仅档案所有人可见明文。 */
  contactValue?: string | null;
}

export interface LeadReply {
  id: string;
  content: string;
  from: 'OWNER' | 'SUBMITTER' | string;
  time: string;
}

export interface Lead {
  id: string;
  caseId: string;
  caseName: string;
  occurTime: string;
  occurAddress: string;
  description: string;
  mediaUrls: string[];
  contactMode: ContactMode;
  contactValue: string | null;
  submitterMasked: string;
  status: LeadStatus;
  highRisk: boolean;
  replies: LeadReply[];
  createTime: string;
}

export interface LeadStatusReq {
  status: Extract<LeadStatus, 'ACCEPTED' | 'REJECTED' | 'CONTACTED'>;
  remark?: string;
}

export const leadApi = {
  submit: (caseId: string, req: LeadReq) =>
    api.post<Lead>(`/app/find/case/${encodeURIComponent(caseId)}/lead`, req),
  /** 仅档案所有人 / 志愿者可见,越权时服务端回 403。 */
  byCase: (caseId: string, params: PageQuery) =>
    api.get<PageResp<Lead>>(`/app/find/case/${encodeURIComponent(caseId)}/leads`, { ...params }),
  updateStatus: (id: string, req: LeadStatusReq) =>
    api.patch<null>(`/app/lead/${encodeURIComponent(id)}/status`, req),
  reply: (id: string, content: string) =>
    api.post<null>(`/app/lead/${encodeURIComponent(id)}/reply`, { content }),
  mine: (params: PageQuery) => api.get<PageResp<Lead>>('/app/lead/mine', { ...params }),
};
