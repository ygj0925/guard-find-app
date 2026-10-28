/**
 * 工具箱-记账(`/app/ledger`)—— 契约见 doc/大众工具箱App产品规划.md 四.2 节。
 * 分类码与服务端 LedgerCategories 一一对应,文案映射在 lib/ledger/categories.ts。
 */
import { api } from '../client';

/** 收支类型:1 支出 / 2 收入(与服务端 LedgerTypeEnum 对齐)。 */
export type LedgerType = 1 | 2;

export interface LedgerRecord {
  id: string;
  type: LedgerType;
  /** 金额(元,正数)。 */
  amount: number;
  category: string;
  /** `yyyy-MM-dd`。 */
  recordDate: string;
  remark: string | null;
  createTime?: string;
}

export interface LedgerRecordReq {
  type: LedgerType;
  amount: number;
  category: string;
  recordDate: string;
  remark?: string;
}

export interface LedgerPageResp {
  records: LedgerRecord[];
  total: number;
}

export interface LedgerCategoryStat {
  category: string;
  expense: number;
  income: number;
  /** 占支出的比例(0-1)。 */
  ratio: number;
}

export interface LedgerTrendPoint {
  /** 逐日 `MM-dd` / 逐月 `yyyy-MM`。 */
  label: string;
  expense: number;
  income: number;
}

export interface LedgerSummary {
  totalExpense: number;
  totalIncome: number;
  balance: number;
  recordCount: number;
  byCategory: LedgerCategoryStat[];
  trend: LedgerTrendPoint[];
  startDate: string;
  endDate: string;
}

export type LedgerPeriod = 'week' | 'month' | 'year';

/** `POST /app/ledger/record`,返回新记录 ID。 */
export function createLedgerRecord(req: LedgerRecordReq): Promise<number> {
  return api.post<number>('/app/ledger/record', req);
}

/** `PUT /app/ledger/record/{id}`。 */
export function updateLedgerRecord(id: string, req: LedgerRecordReq): Promise<void> {
  return api.put<void>(`/app/ledger/record/${id}`, req);
}

/** `DELETE /app/ledger/record/{id}`。 */
export function deleteLedgerRecord(id: string): Promise<void> {
  return api.delete<void>(`/app/ledger/record/${id}`);
}

/** `GET /app/ledger/record/page`,month 传 `yyyy-MM` 时只查该月。 */
export function fetchLedgerRecords(params: {
  month?: string;
  groupId?: string;
  page: number;
  size: number;
}): Promise<LedgerPageResp> {
  return api.get<LedgerPageResp>('/app/ledger/record/page', params);
}

/** `GET /app/ledger/summary`,date 为区间内锚点日;groupId 为家庭组口径。 */
export function fetchLedgerSummary(params: {
  period: LedgerPeriod;
  date?: string;
  groupId?: string;
}): Promise<LedgerSummary> {
  return api.get<LedgerSummary>('/app/ledger/summary', params);
}

// ==================== 家庭组记账 ====================

export interface LedgerGroup {
  id: string;
  name: string;
  ownerUserId: string;
  /** 1=组长, 2=成员 */
  myRole: 1 | 2;
  memberCount: number;
  /** 邀请码,仅组长可见。 */
  inviteCode?: string;
}

export interface LedgerGroupMember {
  userId: string;
  nickname: string | null;
  avatar: string | null;
  role: 1 | 2;
  createTime?: string;
}

export function createLedgerGroup(name: string): Promise<LedgerGroup> {
  return api.post<LedgerGroup>('/app/ledger/group', { name });
}

export function fetchLedgerGroups(): Promise<LedgerGroup[]> {
  return api.get<LedgerGroup[]>('/app/ledger/group/list');
}

export function joinLedgerGroup(inviteCode: string): Promise<LedgerGroup> {
  return api.post<LedgerGroup>('/app/ledger/group/join', { inviteCode });
}

export function regenerateInviteCode(groupId: string): Promise<LedgerGroup> {
  return api.post<LedgerGroup>(`/app/ledger/group/${groupId}/invite-code`);
}

export function fetchLedgerGroupMembers(groupId: string): Promise<LedgerGroupMember[]> {
  return api.get<LedgerGroupMember[]>(`/app/ledger/group/${groupId}/members`);
}

export function removeGroupMember(groupId: string, memberUserId: string): Promise<void> {
  return api.delete<void>(`/app/ledger/group/${groupId}/member/${memberUserId}`);
}

export function quitLedgerGroup(groupId: string): Promise<void> {
  return api.delete<void>(`/app/ledger/group/${groupId}/quit`);
}

export function dissolveLedgerGroup(groupId: string): Promise<void> {
  return api.delete<void>(`/app/ledger/group/${groupId}`);
}
