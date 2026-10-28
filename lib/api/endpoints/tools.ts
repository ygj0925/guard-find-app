/**
 * 工具箱小工具(`/app/tool`)—— 倒数日 + 待办。
 * 单位换算纯本地,不走服务端。
 */
import { api } from '../client';

// ==================== 倒数日 ====================

export interface ToolCountdown {
  id: string;
  title: string;
  /** `yyyy-MM-dd`。 */
  targetDate: string;
  remark: string | null;
  /** 剩余天数,服务端算好:负数=已过 N 天,0=今天。 */
  daysLeft: number;
}

export interface ToolCountdownReq {
  title: string;
  targetDate: string;
  remark?: string;
}

export function createCountdown(req: ToolCountdownReq): Promise<number> {
  return api.post<number>('/app/tool/countdown', req);
}

export function updateCountdown(id: string, req: ToolCountdownReq): Promise<void> {
  return api.put<void>(`/app/tool/countdown/${id}`, req);
}

export function deleteCountdown(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/countdown/${id}`);
}

export function fetchCountdowns(): Promise<ToolCountdown[]> {
  return api.get<ToolCountdown[]>('/app/tool/countdown/list');
}

// ==================== 待办 ====================

export interface ToolTodo {
  id: string;
  title: string;
  done: boolean;
  /** `yyyy-MM-dd`,可空。 */
  dueDate: string | null;
  createTime?: string;
}

export interface ToolTodoReq {
  title: string;
  done?: boolean;
  dueDate?: string | null;
}

export function createTodo(req: ToolTodoReq): Promise<number> {
  return api.post<number>('/app/tool/todo', req);
}

export function updateTodo(id: string, req: ToolTodoReq): Promise<void> {
  return api.put<void>(`/app/tool/todo/${id}`, req);
}

export function toggleTodo(id: string): Promise<void> {
  return api.post<void>(`/app/tool/todo/${id}/toggle`);
}

export function deleteTodo(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/todo/${id}`);
}

export function fetchTodos(): Promise<ToolTodo[]> {
  return api.get<ToolTodo[]>('/app/tool/todo/list');
}
