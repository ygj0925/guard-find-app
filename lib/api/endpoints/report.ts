/**
 * 月度工作汇报(`/app/tool/report`)。
 * 权限:查看/评论=成员;填报=REPORTER 本人;草稿仅本人;管理=OWNER。
 */
import { api } from '../client';

/** 我的角色:1 发起人 / 2 填报人 / 3 接收人。 */
export type ReportRole = 1 | 2 | 3;

export interface ReportReporterStatus {
  userId: string;
  nickname: string | null;
  avatar: string | null;
  /** 0 未开始 / 1 草稿 / 2 已提交。 */
  entryStatus: number;
  late: boolean;
}

export interface ToolReport {
  id: string;
  title: string;
  /** `yyyy-MM`。 */
  period: string;
  dueDate?: string | null;
  myRole: ReportRole;
  reporterCount: number;
  submittedCount: number;
  submittedByMe?: boolean;
  myEntryStatus?: number | null;
  reporters?: ReportReporterStatus[];
}

export interface ToolReportEntry {
  activityId: string;
  activityTitle: string;
  period: string;
  userId: string;
  nickname: string | null;
  avatar: string | null;
  content: string | null;
  /** 0 未开始 / 1 草稿 / 2 已提交。 */
  status: number;
  late: boolean;
  submittedAt?: string | null;
  myRole: ReportRole;
}

export interface ReportComment {
  id: string;
  userId: string;
  nickname: string | null;
  avatar: string | null;
  content: string;
  replyToCommentId?: string | null;
  replyToUserId?: string | null;
  createTime?: string;
}

export function createReport(req: {
  title: string;
  period: string;
  dueDate?: string;
  assigneeUserIds: string[];
  viewerUserIds?: string[];
}): Promise<number> {
  return api.post<number>('/app/tool/report', req);
}

export function fetchMyReports(): Promise<ToolReport[]> {
  return api.get<ToolReport[]>('/app/tool/report/mine');
}

export function fetchReportDetail(id: string): Promise<ToolReport> {
  return api.get<ToolReport>(`/app/tool/report/${id}`);
}

export function fetchReportEntry(id: string, entryUserId: string): Promise<ToolReportEntry> {
  return api.get<ToolReportEntry>(`/app/tool/report/${id}/entry/${entryUserId}`);
}

export function saveReportEntry(
  id: string,
  content: string,
  submit: boolean,
): Promise<void> {
  return api.put<void>(`/app/tool/report/${id}/entry`, { content, submit });
}

export function fetchReportComments(id: string, entryUserId: string): Promise<ReportComment[]> {
  return api.get<ReportComment[]>(`/app/tool/report/${id}/entry/${entryUserId}/comment`);
}

export function createReportComment(
  id: string,
  entryUserId: string,
  content: string,
  replyToCommentId?: string,
): Promise<number> {
  return api.post<number>(`/app/tool/report/${id}/entry/${entryUserId}/comment`, {
    content,
    replyToCommentId,
  });
}

export function addReportMembers(id: string, userIds: string[], role: 2 | 3): Promise<void> {
  return api.post<void>(`/app/tool/report/${id}/members`, undefined, {
    params: { userIds: userIds.join(','), role },
  });
}

export function deleteReport(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/report/${id}`);
}
