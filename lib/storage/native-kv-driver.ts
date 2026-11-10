/**
 * iOS / Android 的持久化 kv 驱动(@react-native-async-storage/async-storage)。
 *
 * 用 try/require 而非静态 import:该包的 `AsyncStorage.native.js` 在原生模块缺失时顶层抛错,
 * 未重新构建原生壳(或 jest)时这里返回 null,kv 落回内存态而不是整个 bundle 崩溃。
 * 鸿蒙由 `native-kv-driver.harmony.ts` 替换:expo-harmony-cli 对该包未自动适配,未实机验证前不进鸿蒙包。
 */
import type { KvDriver } from './kv';

interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function loadNativeKvDriver(): KvDriver | null {
  let storage: AsyncStorageLike | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as {
      default?: AsyncStorageLike;
    };
    storage = mod.default;
  } catch {
    return null;
  }
  if (!storage || typeof storage.getItem !== 'function') return null;
  const store = storage;
  return {
    name: 'async-storage',
    persistent: true,
    getItem: (key) => store.getItem(key),
    setItem: (key, value) => store.setItem(key, value),
    removeItem: (key) => store.removeItem(key),
  };
}
