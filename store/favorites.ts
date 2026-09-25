/**
 * 收藏(zustand + 本地存储)。
 *
 * 契约 v1 没有 `/app/favorite*` 端点,但 app-plaza-browsing 规格要求"登录用户可收藏、
 * 在 我的-收藏 查看"。一期实现为本机收藏(不跨设备同步),差异已写入交付报告;
 * 服务端补端点后,只需要把这里换成 api 调用,页面代码不动。
 */
import { create } from 'zustand';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';
import type { CasePublic } from '@/lib/api/endpoints/case';

const FAVORITES_KEY = 'guardfind.favorites.v1';

interface FavoritesState {
  loaded: boolean;
  /** 档案 id -> 收藏时快照的脱敏卡片(列表离线可读)。 */
  byId: Record<string, CasePublic>;
  load: () => Promise<void>;
  toggle: (item: CasePublic) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  has: (id: string) => boolean;
  list: () => CasePublic[];
}

async function persist(byId: Record<string, CasePublic>): Promise<void> {
  await kvSetJson(FAVORITES_KEY, byId);
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  loaded: false,
  byId: {},

  async load() {
    if (get().loaded) return;
    const stored = await kvGetJson<Record<string, CasePublic>>(FAVORITES_KEY, {});
    set({ byId: stored && typeof stored === 'object' ? stored : {}, loaded: true });
  },

  async toggle(item) {
    await get().load();
    const current = get().byId;
    const next = { ...current };
    const added = !next[item.id];
    if (added) next[item.id] = item;
    else delete next[item.id];
    set({ byId: next });
    await persist(next);
    return added;
  },

  async remove(id) {
    const next = { ...get().byId };
    delete next[id];
    set({ byId: next });
    await persist(next);
  },

  has(id) {
    return Boolean(get().byId[id]);
  },

  list() {
    return Object.values(get().byId).sort((a, b) =>
      (b.publishTime ?? '').localeCompare(a.publishTime ?? ''),
    );
  },
}));

export { FAVORITES_KEY };
