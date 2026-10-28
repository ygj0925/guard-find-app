/**
 * 家庭组任务分派(`/app/tool/task`)。负责人/创建者口径见服务端。
 */
import { api } from '../client';

export type TaskStatus = 1 | 2 | 3;
export type TaskPriority = 1 | 2 | 3;

export interface ToolTask {
  id: string;
  groupId: string;
  title: string;
  detail: string | null;
  assigneeUserId: string;
  assigneeNickname: string | null;
  creatorUserId: string;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createTime?: string;
}

export interface ToolTaskReq {
  groupId: string;
  assigneeUserId: string;
  title: string;
  detail?: string;
  dueDate?: string;
  priority?: TaskPriority;
}

export function createTask(req: ToolTaskReq): Promise<number> {
  return api.post<number>('/app/tool/task', req);
}

export function fetchTasks(scope: 'mine' | 'all', groupId?: string): Promise<ToolTask[]> {
  return api.get<ToolTask[]>('/app/tool/task/list', scope === 'all' ? { scope, groupId } : { scope });
}

export function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  return api.post<void>(`/app/tool/task/${id}/status`, { status });
}

export function deleteTask(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/task/${id}`);
}
