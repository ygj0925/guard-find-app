/**
 * 非致命错误收集与上报(契约 8 节 `POST /app/client-log`)。
 *
 * 两条硬规则:
 *   1) 上报内容 MUST NOT 携带 token、手机号、身份证样式敏感值 —— 由 maskSensitive 兜底,
 *      即使调用方忘了处理;
 *   2) 一期没有崩溃采集 SDK,所以本地环形日志 + 批量上报是唯一的可诊断手段
 *      (鸿蒙侧 Metro 红框被 shim 关掉了,见 shims/expo-metro-runtime.ts)。
 */
import { ApiError } from './api/error';
import { api } from './api/client';

export type MonitorLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface MonitorEntry {
  level: MonitorLevel;
  message: string;
  stack?: string;
  platform: string;
  appVersion: string;
  route: string;
  extra?: Record<string, unknown>;
  at: number;
}

export interface ClientLogPayload {
  level: MonitorLevel;
  message: string;
  stack?: string;
  platform: string;
  appVersion: string;
  route: string;
  extra?: Record<string, unknown>;
}

const MAX_ENTRIES = 50;
const FLUSH_THRESHOLD = 8;
const FLUSH_INTERVAL_MS = 15_000;

const entries: MonitorEntry[] = [];
let pending: ClientLogPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentRoute = '/';
/** 上报失败时的静默丢弃计数,诊断页需要知道"日志没送出去"。 */
let droppedBatches = 0;

const APP_VERSION = '1.0.0';

/** 手机号(含 +86 / 空格分隔)、身份证样式、token 头。 */
const PATTERNS: { re: RegExp; to: string }[] = [
  { re: /(\+?86[-\s]?)?(1[3-9]\d)[-\s]?(\d{4})[-s]?(\d{4})/g, to: '$1$2****$4' },
  { re: /(?<!\d)(\d{6})(\d{8})(\d{3}[0-9Xx])(?!\d)/g, to: '$1********$3' },
  { re: /((?:Bearer|Authorization)\s*[:=]\s*)([A-Za-z0-9._-]{6})[A-Za-z0-9._-]*/gi, to: '$1$2****' },
  { re: /("(?:token|password|oldPassword|newPassword|contactValue|idCard)"\s*:\s*")[^"]*(")/gi, to: '$1****$2' },
];

/** 把字符串里的敏感样式替换掉。导出以便单测直接盯这条规则。 */
export function maskSensitive(input: string): string {
  if (!input) return input;
  return PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern.re, pattern.to),
    String(input),
  );
}

/** 对象深度掩码:key 命中敏感名直接整体打星。 */
export function maskDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (typeof value === 'string') return maskSensitive(value);
  if (Array.isArray(value)) return value.map((item) => maskDeep(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/token|password|phone|mobile|idcard|identity|authorization|secret/i.test(key)) {
        out[key] = '****';
        continue;
      }
      out[key] = maskDeep(item, depth + 1);
    }
    return out;
  }
  return value;
}

export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof ApiError) {
    return {
      message: `[${error.code}] ${maskSensitive(error.msg)}`,
      stack: error.stack ? maskSensitive(error.stack) : undefined,
    };
  }
  if (error instanceof Error) {
    return {
      message: maskSensitive(`${error.name}: ${error.message}`),
      stack: error.stack ? maskSensitive(error.stack) : undefined,
    };
  }
  return { message: maskSensitive(String(error)) };
}

function platformLabel(): string {
  // 平台名只用于诊断聚合,不构成行为分支,所以允许在这里读 Platform。
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 诊断模块必须能在非 RN 环境(单测/CI)加载,惰性 require 是刻意的
    const rn = require('react-native') as { Platform?: { OS?: string } };
    return rn.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function setMonitorRoute(route: string): void {
  currentRoute = route || '/';
}

export function getMonitorRoute(): string {
  return currentRoute;
}

export function capture(
  level: MonitorLevel,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const entry: MonitorEntry = {
    level,
    message: maskSensitive(message),
    platform: platformLabel(),
    appVersion: APP_VERSION,
    route: currentRoute,
    extra: extra ? (maskDeep(extra) as Record<string, unknown>) : undefined,
    at: Date.now(),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  pending.push(toPayload(entry));
  scheduleFlush();
  if (__DEV__) {
    // 鸿蒙无红框,控制台仍是最快的路;真实设备上靠"最近错误"页。
    console.log(`[monitor:${level}] ${entry.message}`);
  }
}

export function captureError(error: unknown, context?: string): void {
  const { message, stack } = describeError(error);
  const entry: MonitorEntry = {
    level: 'ERROR',
    message: context ? `${context} ${message}` : message,
    stack,
    platform: platformLabel(),
    appVersion: APP_VERSION,
    route: currentRoute,
    at: Date.now(),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  pending.push(toPayload(entry));
  scheduleFlush();
  if (__DEV__) console.warn(`[monitor] ${entry.message}`, stack ?? '');
}

function toPayload(entry: MonitorEntry): ClientLogPayload {
  const payload: ClientLogPayload = {
    level: entry.level,
    message: entry.message,
    platform: entry.platform,
    appVersion: entry.appVersion,
    route: entry.route,
  };
  if (entry.stack) payload.stack = entry.stack;
  if (entry.extra) payload.extra = entry.extra;
  return payload;
}

function scheduleFlush(): void {
  if (pending.length >= FLUSH_THRESHOLD) {
    void flush();
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

/** 契约 8 节是"逐条 POST";为省请求量按批发送,服务端按数组解析即可。 */
export async function flush(): Promise<number> {
  if (!pending.length) return 0;
  const batch = pending;
  pending = [];
  try {
    // client-log 属"可选登录",不带 token 也能收;走 api 以复用超时与解包。
    await Promise.all(
      batch.map((payload) => api.post<null>('/app/client-log', payload, { anonymous: false })),
    );
    return batch.length;
  } catch (error) {
    droppedBatches += 1;
    if (__DEV__) console.warn('[monitor] 上报失败,已丢弃批次', error);
    return 0;
  }
}

/** 供"我的-诊断"页与 ErrorBoundary 展示:最近的错误,已掩码。 */
export function recentErrors(limit = 10): MonitorEntry[] {
  return entries
    .filter((entry) => entry.level === 'ERROR')
    .slice(-limit)
    .reverse();
}

export function recentEntries(limit = 20): MonitorEntry[] {
  return entries.slice(-limit).reverse();
}

export function droppedBatchCount(): number {
  return droppedBatches;
}

export function summaryOf(entry: MonitorEntry): string {
  const head = `${new Date(entry.at).toISOString()} ${entry.level} ${entry.route}`;
  return entry.stack ? `${head}\n${entry.message}\n${entry.stack}` : `${head}\n${entry.message}`;
}

export function copyableSummary(): string {
  return recentEntries(20)
    .map((entry) => summaryOf(entry))
    .join('\n---\n');
}

export function __resetMonitorForTests(): void {
  entries.length = 0;
  pending = [];
  droppedBatches = 0;
  currentRoute = '/';
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
