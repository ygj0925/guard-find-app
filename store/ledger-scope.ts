/**
 * 记账作用域:个人账本 / 某个家庭组(zustand + 本地持久化)。
 * groupId=null 即个人账本;scopeName 仅为展示缓存,以服务端组列表为准。
 */
import { create } from 'zustand';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';

const SCOPE_KEY = 'guardfind.ledger-scope.v1';

interface LedgerScopeState {
  loaded: boolean;
  /** null = 个人账本。 */
  groupId: string | null;
  scopeName: string | null;
  load: () => Promise<void>;
  setScope: (groupId: string | null, scopeName: string | null) => Promise<void>;
}

export const useLedgerScope = create<LedgerScopeState>((set, get) => ({
  loaded: false,
  groupId: null,
  scopeName: null,

  async load() {
    if (get().loaded) return;
    const stored = await kvGetJson<{ groupId: string | null; scopeName: string | null }>(SCOPE_KEY, {
      groupId: null,
      scopeName: null,
    });
    set({
      groupId: typeof stored?.groupId === 'string' ? stored.groupId : null,
      scopeName: typeof stored?.scopeName === 'string' ? stored.scopeName : null,
      loaded: true,
    });
  },

  async setScope(groupId, scopeName) {
    set({ groupId, scopeName });
    await kvSetJson(SCOPE_KEY, { groupId, scopeName });
  },
}));
