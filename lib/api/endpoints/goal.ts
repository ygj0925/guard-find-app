/**
 * 目标 OKR lite(`/app/tool/goal`)。个人维度,进度口径服务端统一。
 */
import { api } from '../client';

export interface ToolKeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  status: 1 | 2;
  /** 进度 0-1。 */
  progress: number;
}

export interface ToolGoal {
  id: string;
  title: string;
  /** `2026` 或 `2026Q4`。 */
  period: string;
  progress: number;
  keyResults: ToolKeyResult[];
}

export function createGoal(title: string, period: string): Promise<number> {
  return api.post<number>('/app/tool/goal', { title, period });
}

export function fetchGoals(period?: string): Promise<ToolGoal[]> {
  return api.get<ToolGoal[]>('/app/tool/goal/list', period ? { period } : undefined);
}

export function deleteGoal(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/goal/${id}`);
}

export function createKeyResult(goalId: string, kr: { title: string; targetValue: number; unit?: string; weight?: number; confidence?: number }): Promise<number> {
  return api.post<number>(`/app/tool/goal/${goalId}/kr`, kr);
}

export function updateKrProgress(krId: string, currentValue: number): Promise<void> {
  return api.post<void>(`/app/tool/goal/kr/${krId}/progress`, { currentValue });
}

export function toggleKeyResult(krId: string): Promise<void> {
  return api.post<void>(`/app/tool/goal/kr/${krId}/toggle`);
}

export function deleteKeyResult(krId: string): Promise<void> {
  return api.delete<void>(`/app/tool/goal/kr/${krId}`);
}


/** KR 进度更新(带说明)。 */
export function updateKrProgressWithNote(krId: string, currentValue: number, note?: string): Promise<void> {
  return api.post<void>(`/app/tool/goal/kr/${krId}/progress`, { currentValue, note });
}

/** KR 时间线。 */
export interface KrLog {
  id: string;
  fromValue: number | null;
  toValue: number;
  confidence: number | null;
  note: string | null;
  nickname: string | null;
  createTime?: string;
}

export function fetchKrLogs(krId: string): Promise<KrLog[]> {
  return api.get<KrLog[]>(`/app/tool/goal/kr/${krId}/logs`);
}

/** 关联/取消任务。 */
export function linkTaskToKr(krId: string, taskId: string): Promise<void> {
  return api.post<void>(`/app/tool/goal/kr/${krId}/tasks/${taskId}`);
}

export function unlinkTaskFromKr(krId: string, taskId: string): Promise<void> {
  return api.delete<void>(`/app/tool/goal/kr/${krId}/tasks/${taskId}`);
}

/** 设置复盘评分。 */
export function setGoalScore(id: string, score: number): Promise<void> {
  return api.put<void>(`/app/tool/goal/${id}/score`, { score });
}