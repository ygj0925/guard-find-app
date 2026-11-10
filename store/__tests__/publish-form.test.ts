import type { CaseDetail, CaseDraftReq } from '@/lib/api/endpoints/case';
import { emptyPublishValues } from '@/lib/publish/schema';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';
import { DRAFT_KEY, usePublishForm } from '../publish-form';

const mockDetailFull = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSubmit = jest.fn();

jest.mock('@/lib/storage/kv', () => ({
  kvGetJson: jest.fn(async (_key: string, fallback: unknown) => fallback),
  kvSetJson: jest.fn(async () => undefined),
  kvRemove: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/endpoints/case', () => ({
  caseApi: {
    detailFull: (...args: unknown[]) => mockDetailFull(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    submit: (...args: unknown[]) => mockSubmit(...args),
  },
}));
jest.mock('@/lib/monitor', () => ({ capture: jest.fn() }));

function cloudDetail(id: string, name: string): CaseDetail {
  return {
    id,
    name,
    aliases: ['小宝'],
    mediaUrls: ['https://cdn.test/a.jpg'],
    publishTime: '2026-11-01 10:00:00',
    version: 3,
  } as unknown as CaseDetail;
}

describe('发布草稿云端装载', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    mockDetailFull.mockReset();
    await usePublishForm.getState().reset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('同一档案有未同步的本地改动时只报冲突,不先覆盖本地值', async () => {
    usePublishForm.setState({ caseId: 'c1', syncedAt: 100, updatedAt: 0 });
    usePublishForm.getState().patch({ name: '本地改过' });
    mockDetailFull.mockResolvedValue(cloudDetail('c1', '云端'));

    await usePublishForm.getState().loadCloudDraft('c1');

    const state = usePublishForm.getState();
    expect(state.conflict?.caseId).toBe('c1');
    expect(state.values.name).toBe('本地改过');
  });

  it('选云端为准后套用云端值并保留同档案的关系与区划', async () => {
    usePublishForm.setState({
      caseId: 'c1',
      syncedAt: 100,
      values: { ...emptyPublishValues(), relationType: 'PARENT', provinceCode: '13', cityCode: '1304' },
    });
    usePublishForm.getState().patch({ name: '本地改过' });
    mockDetailFull.mockResolvedValue(cloudDetail('c1', '云端'));
    await usePublishForm.getState().loadCloudDraft('c1');

    await usePublishForm.getState().resolveConflict('cloud');

    const state = usePublishForm.getState();
    expect(state.conflict).toBeNull();
    expect(state.values.name).toBe('云端');
    expect(state.values.relationType).toBe('PARENT');
    expect(state.values.cityCode).toBe('1304');
    expect(state.values.aliases).toEqual([{ name: '小宝', kind: 'OTHER' }]);
    expect(state.values.media.map((item) => item.url)).toEqual(['https://cdn.test/a.jpg']);
    expect(state.pendingSync).toBe(false);
  });

  it('装载另一份档案时不沿用当前档案的关系与区划(防串档)', async () => {
    usePublishForm.setState({
      caseId: 'c1',
      syncedAt: Date.now(),
      updatedAt: 0,
      values: { ...emptyPublishValues(), relationType: 'PARENT', provinceCode: '13', cityCode: '1304' },
    });
    mockDetailFull.mockResolvedValue(cloudDetail('c2', '另一份'));

    await usePublishForm.getState().loadCloudDraft('c2');

    const state = usePublishForm.getState();
    expect(state.conflict).toBeNull();
    expect(state.caseId).toBe('c2');
    expect(state.values.name).toBe('另一份');
    expect(state.values.relationType).toBe('');
    expect(state.values.provinceCode).toBe('');
  });

  it('选本地为准时清掉冲突并标记待同步', async () => {
    usePublishForm.setState({ caseId: 'c1', syncedAt: 100 });
    usePublishForm.getState().patch({ name: '本地改过' });
    mockDetailFull.mockResolvedValue(cloudDetail('c1', '云端'));
    await usePublishForm.getState().loadCloudDraft('c1');

    await usePublishForm.getState().resolveConflict('local');

    const state = usePublishForm.getState();
    expect(state.conflict).toBeNull();
    expect(state.values.name).toBe('本地改过');
    expect(state.pendingSync).toBe(true);
  });
});

describe('提交审核', () => {
  const req = { submit: true, name: '张三', forceSubmit: true } as unknown as CaseDraftReq;

  beforeEach(async () => {
    jest.useFakeTimers();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockSubmit.mockReset();
    await usePublishForm.getState().reset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('已有档案(驳回后修改)先保存内容再走 /submit 流转到待审核', async () => {
    usePublishForm.setState({ caseId: 'c9' });
    mockUpdate.mockResolvedValue(cloudDetail('c9', '张三'));
    mockSubmit.mockResolvedValue({ ...cloudDetail('c9', '张三'), status: 'PENDING_REVIEW' });

    const result = await usePublishForm.getState().submitForReview(req);

    expect(mockUpdate).toHaveBeenCalledWith('c9', req);
    expect(mockSubmit).toHaveBeenCalledWith('c9', { forceSubmit: true });
    expect(mockUpdate.mock.invocationCallOrder[0]).toBeLessThan(mockSubmit.mock.invocationCallOrder[0]);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.status).toBe('PENDING_REVIEW');
  });

  it('新档案直接创建,不再单独调 /submit', async () => {
    mockCreate.mockResolvedValue(cloudDetail('n1', '张三'));

    await usePublishForm.getState().submitForReview(req);

    expect(mockCreate).toHaveBeenCalledWith(req);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(usePublishForm.getState().caseId).toBe('n1');
  });
});

describe('分步前进后退与离线续填', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    (kvSetJson as jest.Mock).mockClear();
    await usePublishForm.getState().reset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('校验不过不前进并把错误定位到字段', () => {
    usePublishForm.getState().patch({ name: '张' });
    expect(usePublishForm.getState().next()).toBe(false);
    const state = usePublishForm.getState();
    expect(state.step).toBe(0);
    expect(state.errors.name).toBe('姓名至少 2 个字');
  });

  it('退回上一步只清错误,不重置已填内容', () => {
    usePublishForm.setState({ step: 2 });
    usePublishForm.getState().patch({ name: '张小宝', features: '左眉有疤' });
    usePublishForm.setState({ errors: { features: 'x' } });

    usePublishForm.getState().back();

    const state = usePublishForm.getState();
    expect(state.step).toBe(1);
    expect(state.errors).toEqual({});
    expect(state.values.name).toBe('张小宝');
    expect(state.values.features).toBe('左眉有疤');
  });

  it('改动防抖写入本地,重启后从本地恢复到原步骤并标记待同步', async () => {
    usePublishForm.setState({ step: 3 });
    usePublishForm.getState().patch({ name: '离线填写' });
    jest.advanceTimersByTime(1000);
    const [key, saved] = (kvSetJson as jest.Mock).mock.calls.at(-1) as [string, unknown];
    expect(key).toBe(DRAFT_KEY);

    usePublishForm.setState({ hydrated: false, values: emptyPublishValues(), step: 0 });
    (kvGetJson as jest.Mock).mockResolvedValueOnce(saved);
    await usePublishForm.getState().hydrate();

    const state = usePublishForm.getState();
    expect(state.values.name).toBe('离线填写');
    expect(state.step).toBe(3);
    expect(state.pendingSync).toBe(true);
  });
});
