/**
 * 登录回跳与"登录后自动完成的动作"(spec: 会话恢复与路由守卫)。
 *
 * 写操作入口在调用前 `requireLogin({ href })`,登录成功后由 SessionProvider 消费:
 * 既恢复目标页面,也恢复"点收藏时被拦下的那一次动作"(靠 pendingRun 的 id 匹配)。
 * 记录落本地存储,避免登录过程 App 被系统回收后回跳目标丢失。
 */
import { kvGetJson, kvSetJson } from './storage/kv';
import type { Href } from 'expo-router';

export const PENDING_KEY = 'guardfind.pending-action.v1';

export interface PendingAction {
  /** 回跳目标路由;null 表示只恢复动作不回跳。 */
  href: string | null;
  /** 需要在登录后自动补做的动作标识,如 `favorite:1790...`。 */
  run?: string;
  /** 埋点来源,便于排查"为什么被踢去登录"。 */
  from?: string;
  at: number;
}

let memory: PendingAction | null = null;

export async function requireLogin(action: Omit<PendingAction, 'at'>): Promise<void> {
  memory = { ...action, at: Date.now() };
  await kvSetJson(PENDING_KEY, memory);
}

/**
 * 拼给登录页的 redirect 参数(契约与路由都用 path 字符串,不做 URL 编码两次)。
 * 返回类型标 Href 以兼容 typed-routes(redirect 是运行时拼接,源头上是 string)。
 */
export function loginHref(action: Omit<PendingAction, 'at'>): Href {
  const target = action.href ?? '';
  return `/auth/login?redirect=${encodeURIComponent(target)}` as Href;
}

export async function takePendingAction(): Promise<PendingAction | null> {
  const stored = memory ?? (await kvGetJson<PendingAction | null>(PENDING_KEY, null));
  memory = null;
  if (stored) await kvSetJson(PENDING_KEY, null);
  return stored;
}

export async function peekPendingAction(): Promise<PendingAction | null> {
  return memory ?? (await kvGetJson<PendingAction | null>(PENDING_KEY, null));
}

export async function clearPendingAction(): Promise<void> {
  memory = null;
  await kvSetJson(PENDING_KEY, null);
}

/** 登录页读 redirect query 用。 */
export function redirectFromParams(params: { redirect?: string } | undefined): string | null {
  const raw = params?.redirect;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
