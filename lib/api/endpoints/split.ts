/**
 * AA 分账(`/app/tool/split`)。实时计算在客户端(lib/split/calc),
 * 服务端存事实并返回同样口径的 perHead/remainderCents。
 */
import { api } from '../client';

export interface ToolSplit {
  id: string;
  title: string;
  totalAmount: number;
  peopleCount: number;
  /** 每人应付(元,基准值,向下取整到分)。 */
  perHead: number;
  /** 余数(分),由前 N 人各多承担 1 分。 */
  remainderCents: number;
  splitDate: string;
  remark: string | null;
  writtenBack: boolean;
}

export interface ToolSplitReq {
  title?: string;
  totalAmount: number;
  peopleCount: number;
  splitDate: string;
  remark?: string;
}

export function createSplit(req: ToolSplitReq): Promise<number> {
  return api.post<number>('/app/tool/split', req);
}

export function fetchSplits(): Promise<ToolSplit[]> {
  return api.get<ToolSplit[]>('/app/tool/split/list');
}

export function deleteSplit(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/split/${id}`);
}

export function markSplitWrittenBack(id: string): Promise<void> {
  return api.post<void>(`/app/tool/split/${id}/written-back`);
}
