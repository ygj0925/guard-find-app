/**
 * 工具箱排序偏好(zustand + 本地存储):置顶的工具 key 列表。
 * 只存置顶序,不存全量顺序 —— 新工具上线自动出现在默认位置,不需要迁移。
 */
import { create } from 'zustand';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';

const TOOLS_ORDER_KEY = 'guardfind.tools-order.v1';

interface ToolsOrderState {
  loaded: boolean;
  /** 置顶的工具 key,按置顶先后排序。 */
  pinned: string[];
  load: () => Promise<void>;
  /** 覆写置顶列表。 */
  setPinned: (keys: string[]) => Promise<void>;
}

export const useToolsOrder = create<ToolsOrderState>((set, get) => ({
  loaded: false,
  pinned: [],

  async load() {
    if (get().loaded) return;
    const stored = await kvGetJson<string[]>(TOOLS_ORDER_KEY, []);
    set({ pinned: Array.isArray(stored) ? stored : [], loaded: true });
  },

  async setPinned(keys) {
    const unique = [...new Set(keys)];
    set({ pinned: unique });
    await kvSetJson(TOOLS_ORDER_KEY, unique);
  },
}));

/** 置顶入口:懒加载一次再覆写。 */
export async function pinTools(keys: string[]): Promise<void> {
  const store = useToolsOrder.getState();
  await store.load();
  await store.setPinned(keys);
}
