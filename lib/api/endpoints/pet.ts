/**
 * 宠物成长记录(`/app/tool/pet`)。数据全部个人,不涉及组共享。
 */
import { api } from '../client';

export type PetSpecies = 'cat' | 'dog' | 'other';
export type PetLogType = 'weight' | 'vaccine' | 'medical' | 'milestone' | 'daily';

export interface ToolPet {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  gender: number | null;
  birthday: string | null;
  avatar: string | null;
  weightKg: number | null;
  notes: string | null;
  createTime?: string;
}

export interface ToolPetLog {
  id: string;
  logType: PetLogType;
  content: string;
  value: number | null;
  unit: string | null;
  logDate: string;
}

export interface ToolPetReq {
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: number;
  birthday?: string;
  weightKg?: number;
  notes?: string;
}

export interface ToolPetLogReq {
  logType: PetLogType;
  content: string;
  value?: number;
  unit?: string;
  logDate: string;
}

export function createPet(req: ToolPetReq): Promise<number> {
  return api.post<number>('/app/tool/pet', req);
}

export function fetchPets(): Promise<ToolPet[]> {
  return api.get<ToolPet[]>('/app/tool/pet/list');
}

export function updatePet(id: string, req: ToolPetReq): Promise<void> {
  return api.put<void>(`/app/tool/pet/${id}`, req);
}

export function deletePet(id: string): Promise<void> {
  return api.delete<void>(`/app/tool/pet/${id}`);
}

export function addPetLog(petId: string, req: ToolPetLogReq): Promise<number> {
  return api.post<number>(`/app/tool/pet/${petId}/log`, req);
}

export function fetchPetLogs(petId: string, logType?: string): Promise<ToolPetLog[]> {
  return api.get<ToolPetLog[]>(`/app/tool/pet/${petId}/log`, logType ? { logType } : undefined);
}

export function deletePetLog(petId: string, logId: string): Promise<void> {
  return api.delete<void>(`/app/tool/pet/${petId}/log/${logId}`);
}
