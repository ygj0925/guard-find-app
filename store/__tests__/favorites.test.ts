import type { CasePublic } from '@/lib/api/endpoints/case';
import {
  favoriteRunId,
  loginHref,
  peekPendingAction,
  redirectFromParams,
  requireLogin,
  takePendingAction,
} from '@/lib/nav';
import { replayPendingFavorite, useFavorites } from '../favorites';

const mockStore = new Map<string, unknown>();

jest.mock('@/lib/storage/kv', () => ({
  kvGetJson: jest.fn(async (key: string, fallback: unknown) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
  kvSetJson: jest.fn(async (key: string, value: unknown) => {
    mockStore.set(key, value);
  }),
}));

function card(id: string): CasePublic {
  return { id, name: '张*宝' } as CasePublic;
}

describe('未登录收藏被引导(spec: 未登录收藏被引导)', () => {
  beforeEach(async () => {
    mockStore.clear();
    await takePendingAction();
    useFavorites.setState({ loaded: false, byId: {} });
  });

  it('拦截时记录回跳详情页与待补做的收藏,登录页 redirect 只编码一次', async () => {
    await requireLogin({ href: '/case/c-1', run: favoriteRunId('c-1'), from: 'favorite' });

    expect(loginHref({ href: '/case/c-1' })).toBe('/auth/login?redirect=%2Fcase%2Fc-1');
    expect(redirectFromParams({ redirect: '%2Fcase%2Fc-1' })).toBe('/case/c-1');
    expect(await peekPendingAction()).toMatchObject({ href: '/case/c-1', run: 'favorite:c-1' });
  });

  it('待补做动作只被消费一次', async () => {
    await requireLogin({ href: '/case/c-1', run: favoriteRunId('c-1') });
    expect((await takePendingAction())?.run).toBe('favorite:c-1');
    expect(await takePendingAction()).toBeNull();
  });

  it('登录后回到详情页:自动补做收藏', async () => {
    expect(await replayPendingFavorite(favoriteRunId('c-1'), card('c-1'))).toBe('added');
    expect(useFavorites.getState().has('c-1')).toBe(true);
    expect(mockStore.get('guardfind.favorites.v1')).toHaveProperty('c-1');
  });

  it('本机已收藏时补做不反向取消', async () => {
    mockStore.set('guardfind.favorites.v1', { 'c-1': card('c-1') });
    expect(await replayPendingFavorite(favoriteRunId('c-1'), card('c-1'))).toBe('already');
    expect(useFavorites.getState().has('c-1')).toBe(true);
  });

  it('动作不属于当前档案或没有动作:什么都不做', async () => {
    expect(await replayPendingFavorite(favoriteRunId('c-2'), card('c-1'))).toBeNull();
    expect(await replayPendingFavorite(null, card('c-1'))).toBeNull();
    expect(useFavorites.getState().byId).toEqual({});
  });
});
