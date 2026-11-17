/**
 * 记账作用域:个人账本 / 某个家庭组(zustand + 本地持久化)。
 * groupId=null 即个人账本;scopeName 仅为展示缓存,以服务端组列表为准。
 */
import { create } from 'zustand';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';
import { useSession } from './session';

const SCOPE_KEY = 'guardfind.ledger-scope.v2';
let generation = 0;

interface LedgerScopeState {
  userId: string | null;
  loaded: boolean;
  /** null = 个人账本。 */
  groupId: string | null;
  scopeName: string | null;
  load: () => Promise<void>;
  setScope: (groupId: string | null, scopeName: string | null) => Promise<void>;
}

export const useLedgerScope = create<LedgerScopeState>((set, get) => ({
  userId: null,
  loaded: false,
  groupId: null,
  scopeName: null,

  async load() {
    const userId = useSession.getState().user?.id ?? null;
    if (get().loaded && get().userId === userId) return;
    const current = ++generation;
    set({ userId, loaded: false, groupId: null, scopeName: null });
    if (!userId) {
      set({ loaded: true });
      return;
    }
    const stored = await kvGetJson<{
      groupId: string | null;
      scopeName: string | null;
    }>(`${SCOPE_KEY}:${userId}`, {
      groupId: null,
      scopeName: null,
    });
    if (current !== generation || userId !== useSession.getState().user?.id)
      return;
    set({
      groupId: typeof stored?.groupId === 'string' ? stored.groupId : null,
      scopeName:
        typeof stored?.scopeName === 'string' ? stored.scopeName : null,
      loaded: true,
    });
  },

  async setScope(groupId, scopeName) {
    const userId = useSession.getState().user?.id ?? null;
    if (!userId) return;
    generation++;
    set({ userId, loaded: true, groupId, scopeName });
    await kvSetJson(`${SCOPE_KEY}:${userId}`, { groupId, scopeName });
  },
}));

useSession.subscribe((next, previous) => {
  if (next.user?.id !== previous.user?.id || next.token !== previous.token) {
    generation++;
    useLedgerScope.setState({
      userId: null,
      loaded: false,
      groupId: null,
      scopeName: null,
    });
    void useLedgerScope.getState().load();
  }
});
