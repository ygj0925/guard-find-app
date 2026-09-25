/**
 * 发布表单状态与草稿(云端 submit=false + 本地暂存)。
 *
 * 三条规格要求:
 *   1. 断网/杀进程后可续填:每次改动 debounce 落本地(kv),恢复时按 updatedAt 提示;
 *   2. 上一步不重置:步骤切换只改 `step`,值始终在同一个 `values` 对象里;
 *   3. 云端草稿与本地副本冲突时不静默覆盖:`conflict` 由 draftId 拉取后比较得出。
 */
import { create } from 'zustand';
import { kvGetJson, kvRemove, kvSetJson } from '@/lib/storage/kv';
import { caseApi, type CaseDetail, type CaseDraftReq } from '@/lib/api/endpoints/case';
import {
  emptyPublishValues,
  toCaseReq,
  validateStep,
  type PublishValues,
  type StepIndex,
  type StepValidation,
} from '@/lib/publish/schema';
import { capture } from '@/lib/monitor';

export const DRAFT_KEY = 'guardfind.publish-draft.v1';
const AUTOSAVE_DEBOUNCE_MS = 800;

export interface LocalDraft {
  values: PublishValues;
  step: StepIndex;
  /** 云端草稿 id;有它则下次保存走 PUT。 */
  caseId: string | null;
  updatedAt: number;
  /** 云端最近一次同步时间;null 表示从未同步(含离线)。 */
  syncedAt: number | null;
  /** 已上传成功的图片地址,顺序即 sort。 */
  uploadedUrls: string[];
  agreementAcceptedAt?: string;
}

export interface DraftConflict {
  caseId: string;
  cloudUpdatedAt: number;
  localUpdatedAt: number;
}

interface PublishFormState {
  hydrated: boolean;
  values: PublishValues;
  step: StepIndex;
  caseId: string | null;
  updatedAt: number;
  syncedAt: number | null;
  /** 离线或未同步时为 true,页面显示"待同步"。 */
  pendingSync: boolean;
  uploadedUrls: string[];
  errors: Record<string, string>;
  formError?: string;
  conflict: DraftConflict | null;
  saving: boolean;
  submitting: boolean;
  hydrate: () => Promise<void>;
  setStep: (step: StepIndex) => void;
  next: () => boolean;
  back: () => void;
  patch: (patch: Partial<PublishValues>) => void;
  clearErrors: () => void;
  /** 只做当前步校验,不跳转。 */
  validateCurrentStep: () => boolean;
  markUploaded: (url: string) => void;
  /** 图片上传状态由 `MediaField` 持有,页面把"已成功上传的地址"同步进来(顺序即 sort)。 */
  setUploadedUrls: (urls: string[]) => void;
  removeMedia: (index: number) => void;
  saveDraftCloud: (options?: { silent?: boolean }) => Promise<CaseDetail | null>;
  submitForReview: (req: CaseDraftReq) => Promise<CaseDetail>;
  loadCloudDraft: (caseId: string) => Promise<void>;
  /** 驳回档案 -> 预填表单(spec: 修改后重新提交)。 */
  prefillFromCase: (detail: CaseDetail) => void;
  resolveConflict: (side: 'local' | 'cloud') => Promise<void>;
  reset: () => Promise<void>;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function snapshot(state: PublishFormState): LocalDraft {
  return {
    values: state.values,
    step: state.step,
    caseId: state.caseId,
    updatedAt: state.updatedAt,
    syncedAt: state.syncedAt,
    uploadedUrls: state.uploadedUrls,
    agreementAcceptedAt: state.values.agreementAcceptedAt,
  };
}

function scheduleAutosave(get: () => PublishFormState): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void kvSetJson(DRAFT_KEY, snapshot(get()));
  }, AUTOSAVE_DEBOUNCE_MS);
}

/** 云端 `CaseDetail` -> 表单值。别名与图片按契约结构还原。 */
export function valuesFromCaseDetail(detail: CaseDetail, previous: PublishValues): PublishValues {
  return {
    ...previous,
    relationType: previous.relationType,
    name: detail.name ?? '',
    gender: detail.gender ?? 'UNKNOWN',
    birthday: detail.birthday ?? null,
    ageAtMissing: detail.ageAtMissing ?? null,
    missingTime: detail.missingTime ?? '',
    address: detail.address ?? null,
    height: detail.height ?? null,
    bodyType: detail.bodyType ?? null,
    hairType: detail.hairType ?? null,
    accent: detail.accent ?? null,
    features: detail.features ?? null,
    clothing: detail.clothing ?? null,
    belongings: detail.belongings ?? null,
    caseType: detail.caseType ?? '',
    narrative: detail.narrative ?? '',
    familyClues: detail.familyClues ?? null,
    otherNote: detail.otherNote ?? null,
    policeReported: detail.policeReported ?? false,
    policeStation: detail.policeStation ?? null,
    caseNo: detail.caseNo ?? null,
    bloodSampleStatus: detail.bloodSampleStatus ?? 'UNKNOWN',
    followVolunteer: detail.followVolunteer ?? null,
    contactMode: detail.contactMode ?? 'IN_APP',
    contactPhone: detail.contactPhone ?? null,
  };
}

export const usePublishForm = create<PublishFormState>((set, get) => ({
  hydrated: false,
  values: emptyPublishValues(),
  step: 0,
  caseId: null,
  updatedAt: 0,
  syncedAt: null,
  pendingSync: false,
  uploadedUrls: [],
  errors: {},
  formError: undefined,
  conflict: null,
  saving: false,
  submitting: false,

  async hydrate() {
    if (get().hydrated) return;
    const stored = await kvGetJson<LocalDraft | null>(DRAFT_KEY, null);
    if (stored?.values) {
      set({
        hydrated: true,
        values: { ...emptyPublishValues(), ...stored.values },
        step: stored.step ?? 0,
        caseId: stored.caseId ?? null,
        updatedAt: stored.updatedAt ?? 0,
        syncedAt: stored.syncedAt ?? null,
        uploadedUrls: stored.uploadedUrls ?? [],
        // 有本地副本且从未同步(或比云端新)时,标为待同步,提示用户可继续离线填写。
        pendingSync: stored.syncedAt === null && Boolean(stored.updatedAt),
      });
      return;
    }
    set({ hydrated: true });
  },

  setStep(step) {
    set({ step });
    scheduleAutosave(get);
  },

  next() {
    const { step, values } = get();
    const result = validateStep(step as StepIndex, values);
    set({ errors: result.errors, formError: result.formError });
    if (!result.ok) return false;
    set({ step: Math.min(4, step + 1) as StepIndex });
    scheduleAutosave(get);
    return true;
  },

  back() {
    set({ step: Math.max(0, get().step - 1) as StepIndex, errors: {}, formError: undefined });
  },

  patch(patch) {
    set({
      values: { ...get().values, ...patch },
      updatedAt: Date.now(),
      pendingSync: true,
    });
    // 改过的字段立刻清掉它自己的错误,避免"改了还红着"。
    const touched = Object.keys(patch);
    const errors = { ...get().errors };
    for (const key of touched) delete errors[key];
    set({ errors });
    scheduleAutosave(get);
  },

  clearErrors() {
    set({ errors: {}, formError: undefined });
  },

  validateCurrentStep() {
    const { step, values } = get();
    const result = validateStep(step as StepIndex, values);
    set({ errors: result.errors, formError: result.formError });
    return result.ok;
  },

  markUploaded(url) {
    const urls = get().uploadedUrls.includes(url) ? get().uploadedUrls : [...get().uploadedUrls, url];
    set({ uploadedUrls: urls });
    scheduleAutosave(get);
  },

  setUploadedUrls(urls) {
    const same =
      urls.length === get().uploadedUrls.length && urls.every((url, i) => get().uploadedUrls[i] === url);
    if (same) return;
    set({ uploadedUrls: urls });
    scheduleAutosave(get);
  },

  removeMedia(index) {
    const media = get().values.media.filter((_, position) => position !== index);
    get().patch({ media });
  },

  async saveDraftCloud({ silent = false } = {}) {
    // 草稿允许字段不全(契约 submit=false 只校验格式),但当前步的必填项在页面上先校验,
    // 避免把明显不合法的输入送到服务端再回 4001。
    const { values, caseId, uploadedUrls } = get();
    const req: CaseDraftReq = buildReqFromValues(values, uploadedUrls, {
      submit: false,
      agreementVersion: values.agreementVersion,
    });
    set({ saving: true });
    try {
      const saved = caseId
        ? await caseApi.update(caseId, req)
        : await caseApi.create(req);
      set({
        caseId: saved.id,
        syncedAt: Date.now(),
        pendingSync: false,
        saving: false,
      });
      scheduleAutosave(get);
      return saved;
    } catch (error) {
      set({ saving: false });
      if (!silent) {
        capture('WARN', '云端草稿保存失败,已保留本地副本', {
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  },

  async submitForReview(req) {
    const { caseId } = get();
    set({ submitting: true });
    try {
      const result = caseId
        ? await caseApi.update(caseId, { ...req, submit: true })
        : await caseApi.create(req);
      set({ submitting: false, syncedAt: Date.now(), pendingSync: false, caseId: result.id });
      await kvRemove(DRAFT_KEY);
      return result;
    } catch (error) {
      set({ submitting: false });
      throw error;
    }
  },

  async loadCloudDraft(caseId) {
    const local = snapshot(get());
    const detail = await caseApi.detailFull(caseId);
    const cloudUpdatedAt = Date.parse((detail.publishTime ?? '').replace(' ', 'T')) || detail.version;
    if (local.caseId === caseId && local.updatedAt > cloudUpdatedAt && cloudUpdatedAt > 0) {
      set({
        conflict: { caseId, cloudUpdatedAt, localUpdatedAt: local.updatedAt },
      });
    }
    applyCloudDetail(set, get, detail);
  },

  async resolveConflict(side) {
    const conflict = get().conflict;
    if (!conflict) return;
    if (side === 'local') {
      set({ conflict: null, pendingSync: true });
      scheduleAutosave(get);
      return;
    }
    const detail = await caseApi.detailFull(conflict.caseId);
    applyCloudDetail(set, get, detail);
    set({ conflict: null, syncedAt: Date.now(), pendingSync: false });
  },

  prefillFromCase(detail) {
    get().patch({ ...valuesFromCaseDetail(detail, emptyPublishValues()) });
    set({
      caseId: null, // 驳回后走"新建 + submit",服务端保留版本快照(spec 6.6)
      uploadedUrls: detail.mediaUrls ?? [],
      step: 0,
    });
    scheduleAutosave(get);
  },

  async reset() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    await kvRemove(DRAFT_KEY);
    set({
      values: emptyPublishValues(),
      step: 0,
      caseId: null,
      updatedAt: 0,
      syncedAt: null,
      pendingSync: false,
      uploadedUrls: [],
      errors: {},
      formError: undefined,
      conflict: null,
    });
  },
}));

function applyCloudDetail(
  set: (partial: Partial<PublishFormState>) => void,
  get: () => PublishFormState,
  detail: CaseDetail,
): void {
  set({
    values: valuesFromCaseDetail(detail, get().values),
    caseId: detail.id,
    uploadedUrls: detail.mediaUrls ?? [],
    updatedAt: Date.now(),
  });
  scheduleAutosave(get);
}

/** 表单值 -> 契约请求体(草稿体:未填完的枚举位允许留空)。 */
export function buildReqFromValues(
  values: PublishValues,
  uploadedUrls: string[],
  options: { submit: boolean; agreementVersion: string; forceSubmit?: boolean },
): CaseDraftReq {
  return toCaseReq(values, { ...options, uploadedUrls });
}

export type { StepValidation };
