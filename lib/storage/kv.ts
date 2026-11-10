/**
 * 键值存储(一期只存非凭据:草稿副本、搜索历史、常驻地缓存)。
 *
 * 驱动优先级:Web localStorage → 原生 async-storage(`native-kv-driver`,鸿蒙变体返回 null)→ 内存。
 * 原生包不在本文件静态 import:模块缺失时它顶层抛错,这里只拿到 null 并落回内存态。
 * 落到内存驱动时 `isKvPersistent()` 为 false,不得对外宣称数据已持久化。
 *
 * 任何驱动异常都被吞掉并降级为内存态,读取失败按"没有该键"处理(spec: 存储不可用时降级)。
 */

import { loadNativeKvDriver } from './native-kv-driver';

export interface KvDriver {
  readonly name: string;
  /** 是否能在进程重启后保留数据;内存驱动为 false。 */
  readonly persistent: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const memory = new Map<string, string>();

/** 进程内驱动:冷启动不持久,但保证任何平台上都不会崩。 */
export const memoryDriver: KvDriver = {
  name: 'memory',
  persistent: false,
  async getItem(key) {
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  async setItem(key, value) {
    memory.set(key, value);
  },
  async removeItem(key) {
    memory.delete(key);
  },
};

/**
 * 浏览器 localStorage(Web 预览用)。用 `typeof` 探测而非 Platform 分支,
 * 这样业务代码依然满足"禁止 Platform.OS"的约束。
 */
const webDriver: KvDriver | null = (() => {
  try {
    const store = (globalThis as Record<string, unknown>).localStorage as
      | {
          getItem(k: string): string | null;
          setItem(k: string, v: string): void;
          removeItem(k: string): void;
          readonly length: number;
        }
      | undefined;
    if (!store || typeof store.getItem !== 'function') return null;
    // 隐私模式下 setItem 会抛异常,先自测一次。
    const probe = '__gf_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return {
      name: 'web-localStorage',
      persistent: true,
      async getItem(key) {
        return store.getItem(key);
      },
      async setItem(key, value) {
        store.setItem(key, value);
      },
      async removeItem(key) {
        store.removeItem(key);
      },
    };
  } catch {
    return null;
  }
})();

// localStorage 存在但自测失败(隐私模式)时不再尝试 async-storage:Web 版同样依赖 localStorage。
const hasWebStorage = typeof (globalThis as Record<string, unknown>).localStorage !== 'undefined';
const defaultDriver: KvDriver =
  webDriver ?? (hasWebStorage ? null : loadNativeKvDriver()) ?? memoryDriver;

let driver: KvDriver = defaultDriver;

/** 记录最后一次驱动异常,供"我的-诊断"与 monitor 上报。 */
let lastError: string | null = null;

export function registerKvDriver(next: KvDriver): void {
  driver = next;
  lastError = null;
}

/** 当前生效的键值驱动(token 存储与诊断页都要读它)。 */
export function getCurrentDriver(): KvDriver {
  return driver;
}

export function getKvDriverName(): string {
  return driver.name;
}

/** 当前驱动是否能跨进程重启保留数据;false 时不应向用户宣称已持久化。 */
export function isKvPersistent(): boolean {
  return driver.persistent;
}

export function getKvLastError(): string | null {
  return lastError;
}

function rememberError(where: string, error: unknown): void {
  lastError = `${where}: ${error instanceof Error ? error.message : String(error)}`;
}

export async function kvGet(key: string): Promise<string | null> {
  try {
    const value = await driver.getItem(key);
    return typeof value === 'string' ? value : null;
  } catch (error) {
    rememberError('kvGet', error);
    return memory.get(key) ?? null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await driver.setItem(key, value);
  } catch (error) {
    rememberError('kvSet', error);
  }
}

export async function kvRemove(key: string): Promise<void> {
  memory.delete(key);
  try {
    await driver.removeItem(key);
  } catch (error) {
    rememberError('kvRemove', error);
  }
}

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await kvGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
  await kvSet(key, JSON.stringify(value));
}

/** 测试辅助:清空内存态。 */
export function __resetKvForTests(): void {
  memory.clear();
  lastError = null;
  driver = defaultDriver;
}
