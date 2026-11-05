/**
 * 工具箱小工具(`/app/tool`)—— 倒数日 + 待办 + 便笺。
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

// ==================== 灵感便笺 ====================

export interface ToolNote {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  version: number;
  createTime?: string;
  updateTime?: string | null;
}

export interface ToolNotePage {
  list: ToolNote[];
  total: number;
}

export interface ToolNoteReq {
  title: string;
  content?: string;
  archived?: boolean;
  /** 修改时必传,取自上次读取的 version。 */
  version?: number;
}

export interface ToolNoteQuery {
  page?: number;
  size?: number;
  keyword?: string;
  archived?: boolean;
}

export function createNote(req: ToolNoteReq): Promise<number> {
  return api.post<number>('/app/tool/note', req);
}

export function updateNote(id: string, req: ToolNoteReq): Promise<void> {
  return api.put<void>(`/app/tool/note/${id}`, req);
}

export function toggleNotePin(id: string): Promise<void> {
  return api.post<void>(`/app/tool/note/${id}/pin`);
}

export function toggleNoteArchive(id: string): Promise<void> {
  return api.post<void>(`/app/tool/note/${id}/archive`);
}

export function deleteNote(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/note/${id}`);
}

export function fetchNotes(query: ToolNoteQuery = {}): Promise<ToolNotePage> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 1));
  params.set('size', String(query.size ?? 20));
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.archived) params.set('archived', 'true');
  return api.get<ToolNotePage>(`/app/tool/note/list?${params.toString()}`);
}
