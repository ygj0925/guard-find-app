/**
 * 6. 治理与举报(`/app/report`)+ "我的"页所需的本地收藏 —— 对齐契约 6 节。
 * `/system/moderation/**` 属后台端,一期 App 不接(spec Non-Goals),故此处不声明。
 *
 * 契约缺口(已在交付报告中标注,未擅自发明路径):
 *   `app-plaza-browsing` 规格要求"登录用户可收藏/取消收藏并在 我的-收藏 查看",
 *   但契约 v1 没有任何 `/app/favorite*` 端点。一期实现为**本机收藏**(lib/favorites,
 *   存 kv),跨设备不同步;服务端补端点后只需把 lib/favorites 换成这里声明的 api。
 */
import { api } from '../client';
import type { PageQuery, PageResp } from './common';

export type ReportTargetType = 'CASE' | 'LEAD' | 'USER';

export type ReportReasonType =
  | 'FRAUD'
  | 'FALSE_INFO'
  | 'PORN'
  | 'ILLEGAL'
  | 'HARASSMENT'
  | 'REPEAT'
  | 'OTHER';

export type ReportStatus = 'PENDING' | 'ACCEPTED' | 'DISMISSED' | string;

export interface ReportReq {
  targetType: ReportTargetType;
  targetId: string;
  /** 选项来自字典,不硬编码。 */
  reasonType: ReportReasonType;
  description?: string;
  mediaUrls?: string[];
}

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string | null;
  reasonType: ReportReasonType;
  description: string | null;
  /** 同人同目标去重累加。 */
  hitCount: number;
  status: ReportStatus;
  handleRemark: string | null;
  createTime: string;
}

export const reportApi = {
  submit: (req: ReportReq) => api.post<Report>('/app/report', req),
  mine: (params: PageQuery) => api.get<PageResp<Report>>('/app/report/mine', { ...params }),
};
