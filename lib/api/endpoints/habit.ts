/**
 * 习惯打卡(`/app/tool/habit`)。streak 口径服务端统一,客户端只渲染。
 */
import { api } from '../client';

export interface ToolHabit {
  id: string;
  title: string;
  remark: string | null;
  todayChecked: boolean;
  currentStreak: number;
  bestStreak: number;
  totalDays: number;
}

export interface ToolHabitReq {
  title: string;
  remark?: string;
}

export function createHabit(req: ToolHabitReq): Promise<number> {
  return api.post<number>('/app/tool/habit', req);
}

export function updateHabit(id: string, req: ToolHabitReq): Promise<void> {
  return api.put<void>(`/app/tool/habit/${id}`, req);
}

export function deleteHabit(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/habit/${id}`);
}

export function fetchHabits(): Promise<ToolHabit[]> {
  return api.get<ToolHabit[]>('/app/tool/habit/list');
}

/** 打卡/取消今天,返回 true=已打卡。 */
export function toggleHabitCheckin(id: string): Promise<boolean> {
  return api.post<boolean>(`/app/tool/habit/${id}/checkin`);
}

/** 某月打卡日期(yyyy-MM-dd 升序),月历网格用。 */
export function fetchHabitMonthLog(id: string, month?: string): Promise<string[]> {
  return api.get<string[]>(`/app/tool/habit/${id}/log`, month ? { month } : undefined);
}
