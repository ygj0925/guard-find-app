/** 扩展记账服务。snapshot 是独立的简账备份，不与 /app/ledger 流水自动互转。 */
import { api, request } from '../client';
import type { UploadTarget } from './upload';
import type { LedgerType } from './ledger';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export type SnapshotCollection =
  | 'books'
  | 'accounts'
  | 'categories'
  | 'entries'
  | 'budgets'
  | 'recurring'
  | 'goals'
  | 'settings';
export interface AccountingSnapshotResult {
  version: number;
  payload: string | null;
}
export interface SnapshotSave {
  baseVersion: number;
  operationId: string;
  payload: string;
}
export interface SnapshotChange {
  collection: SnapshotCollection;
  key: string;
  value: JsonValue;
}
export interface Receipt {
  id: string;
  name: string;
  mime: string;
  size: number;
}
export interface AccountingDraft {
  type: LedgerType;
  amount: number;
  category: string;
  recordDate: string;
  remark: string;
}
export type AccountingFile = UploadTarget & { size?: number; file?: Blob };
const RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function fileForm(target: AccountingFile, audio = false): FormData {
  const allowed = audio
    ? new Set([
        'audio/mp4',
        'audio/m4a',
        'audio/x-m4a',
        'audio/mpeg',
        'audio/wav',
        'audio/webm',
      ])
    : RECEIPT_TYPES;
  const size = target.file?.size ?? target.size;
  const limit = (audio ? 10 : 5) * 1024 * 1024;
  if (
    !allowed.has(target.type) ||
    (size !== undefined && (size < 1 || size > limit))
  ) {
    throw new Error(
      audio
        ? '请选择10MB以内的MP4/M4A/MP3/WAV/WebM音频'
        : '请选择5MB以内的JPEG、PNG、WebP图片或PDF',
    );
  }
  const form = new FormData();
  if (target.file) form.append('file', target.file, target.name);
  else
    form.append('file', {
      uri: target.uri,
      name: target.name,
      type: target.type,
    } as unknown as Blob);
  return form;
}

export const accountingApi = {
  snapshot: (knownVersion?: number) =>
    api.get<AccountingSnapshotResult>('/app/accounting/snapshot', {
      knownVersion,
    }),
  // operationId 必须随待确认请求保留；4002 冲突交由调用者处理，禁止自动覆盖云端。
  saveSnapshot: (input: SnapshotSave) =>
    api.put<AccountingSnapshotResult>('/app/accounting/snapshot', input, {
      timeoutMs: 60_000,
    }),
  patchSnapshot: (
    input: Omit<SnapshotSave, 'payload'> & { changes: SnapshotChange[] },
  ) =>
    api.patch<AccountingSnapshotResult>('/app/accounting/snapshot', input, {
      timeoutMs: 60_000,
    }),
  receipts: () => api.get<Receipt[]>('/app/accounting/receipts'),
  uploadReceipt: (file: AccountingFile) =>
    api.post<Receipt>('/app/accounting/receipts', undefined, {
      rawBody: fileForm(file),
      timeoutMs: 60_000,
    }),
  receiptContent: (id: string) =>
    request<Blob>(`/app/accounting/receipts/${encodeURIComponent(id)}`, {
      responseType: 'blob',
      timeoutMs: 60_000,
    }),
  deleteReceipt: (id: string) =>
    api.delete<void>(`/app/accounting/receipts/${encodeURIComponent(id)}`),
  recognize: (input: { text?: string; receiptId?: string; date?: string }) =>
    api.post<AccountingDraft>('/app/accounting/recognize', input, {
      timeoutMs: 75_000,
    }),
  transcribe: (file: AccountingFile) =>
    api.post<{ text: string }>('/app/accounting/transcribe', undefined, {
      rawBody: fileForm(file, true),
      timeoutMs: 75_000,
    }),
};
