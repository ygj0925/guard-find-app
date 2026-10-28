/**
 * 外观偏好:'system' | 'light' | 'dark',本地持久化。
 * setMode 同时调 NativeWind 的 colorScheme.set —— dark: 变体样式由它驱动,
 * 单改 useColorScheme 只会影响 JS 侧取色、不影响样式。
 */
import { create } from 'zustand';
import { colorScheme } from 'nativewind';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';

export type AppearanceMode = 'system' | 'light' | 'dark';

const APPEARANCE_KEY = 'guardfind.appearance.v1';

interface AppearanceState {
  loaded: false | true;
  mode: AppearanceMode;
  load: () => Promise<void>;
  setMode: (mode: AppearanceMode) => Promise<void>;
}

function apply(mode: AppearanceMode): void {
  colorScheme.set(mode);
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  loaded: false,
  mode: 'system',

  async load() {
    if (get().loaded) return;
    const stored = await kvGetJson<AppearanceMode>(APPEARANCE_KEY, 'system');
    const mode = stored === 'light' || stored === 'dark' ? stored : 'system';
    apply(mode);
    set({ mode, loaded: true });
  },

  async setMode(mode) {
    apply(mode);
    set({ mode });
    await kvSetJson(APPEARANCE_KEY, mode);
  },
}));
