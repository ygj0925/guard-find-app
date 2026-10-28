/**
 * 在线签到(`/app/tool/checkin`)。动态码 30 秒轮换,防代签口径见服务端。
 */
import { api } from '../client';

export interface CheckinRecord {
  userId: string;
  nickname: string | null;
  avatar: string | null;
  locationName: string | null;
  createTime?: string;
}

export interface ToolCheckin {
  id: string;
  title: string;
  locationName: string | null;
  /** `yyyy-MM-dd HH:mm:ss`。 */
  startTime: string;
  endTime: string;
  inWindow: boolean;
  signedCount: number;
  /** 动态码种子,仅发起人可见;本地按 30 秒轮换计算展示。 */
  secret?: string;
  signedByMe?: boolean;
  myLocationName?: string | null;
  records?: CheckinRecord[];
}

export interface CheckinCreateReq {
  title: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
}

export function createCheckin(req: CheckinCreateReq): Promise<number> {
  return api.post<number>('/app/tool/checkin', req);
}

export function fetchMyCheckins(): Promise<ToolCheckin[]> {
  return api.get<ToolCheckin[]>('/app/tool/checkin/mine');
}

export function fetchCheckinDetail(id: string): Promise<ToolCheckin> {
  return api.get<ToolCheckin>(`/app/tool/checkin/${id}`);
}

export function doCheckin(id: string, code: string, locationName?: string): Promise<number> {
  return api.post<number>(`/app/tool/checkin/${id}/checkin`, { code, locationName });
}

export function fetchSignedByMe(): Promise<ToolCheckin[]> {
  return api.get<ToolCheckin[]>('/app/tool/checkin/signed');
}

export function deleteCheckin(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/checkin/${id}`);
}
