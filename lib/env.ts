/**
 * 集中式环境配置(spec: app-client-infrastructure / 集中式环境配置)。
 *
 * 读取顺序:app.json(app.config.ts 注入)的 `expo.extra` -> `process.env.EXPO_PUBLIC_*` -> 默认值。
 * 业务代码 MUST NOT 出现硬编码 host 或端口,只能通过 `env` 取基址。
 *
 * 注意:`env` 的字段是惰性求值的。缺失基址时不会在 import 期炸掉整个 bundle,
 * 但任何一次真实读取都会抛出可读的 EnvError —— 根布局会主动读一次以保证"启动即报错"。
 */
import Constants from 'expo-constants';

export type EnvName = 'development' | 'staging' | 'production';

export interface AppEnv {
  ENV_NAME: EnvName;
  API_BASE_URL: string;
  WS_BASE_URL: string;
  APP_SCHEME: string;
  AGREEMENT_VERSION: string;
  /** 请求超时(ms),契约要求 15s 中断。 */
  REQUEST_TIMEOUT_MS: number;
  /** WebSocket 断线多久后降级轮询(契约 5 节:10 秒)。 */
  WS_FALLBACK_AFTER_MS: number;
  /** 降级轮询间隔(契约 5 节:30 秒)。 */
  UNREAD_POLL_INTERVAL_MS: number;
}

/** 配置缺失时抛出的可读错误:启动即失败,不发出任何指向猜测地址的请求。 */
export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

type ExtraConfig = Partial<Record<keyof AppEnv, unknown>>;

/**
 * `EXPO_PUBLIC_*` 必须按字面量静态读取(babel 在构建期把它们内联成常量,
 * 动态拼出来的 `process.env[xxx]` 在打包后永远是 undefined)。
 * 因此这里显式列出每个键的字面量访问,再按 key 取用,不用模板字符串取值。
 */
const EXPO_PUBLIC_VALUES: Readonly<Record<keyof AppEnv, string | undefined>> = {
  ENV_NAME: process.env.EXPO_PUBLIC_ENV_NAME,
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  WS_BASE_URL: process.env.EXPO_PUBLIC_WS_BASE_URL,
  APP_SCHEME: process.env.EXPO_PUBLIC_APP_SCHEME,
  AGREEMENT_VERSION: process.env.EXPO_PUBLIC_AGREEMENT_VERSION,
  REQUEST_TIMEOUT_MS: process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS,
  WS_FALLBACK_AFTER_MS: process.env.EXPO_PUBLIC_WS_FALLBACK_AFTER_MS,
  UNREAD_POLL_INTERVAL_MS: process.env.EXPO_PUBLIC_UNREAD_POLL_INTERVAL_MS,
};

function readExtra(): ExtraConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  return extra ?? {};
}

function pickString(key: keyof AppEnv, extra: ExtraConfig, fallback?: string) {
  const fromExtra = extra[key];
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  const runtime = EXPO_PUBLIC_VALUES[key];
  if (typeof runtime === 'string' && runtime.trim()) return runtime.trim();
  return fallback;
}

function normalize(raw: string, isWs: boolean): string {
  const url = raw.replace(/\/+$/, '');
  if (/^(https?|wss?):\/\//.test(url)) return url;
  return `${isWs ? 'ws' : 'http'}://${url}`;
}

function buildEnv(): AppEnv {
  const extra = readExtra();
  const rawEnvName = pickString('ENV_NAME', extra) ?? process.env.NODE_ENV ?? 'development';
  const ENV_NAME: EnvName =
    rawEnvName === 'production' || rawEnvName === 'staging' ? rawEnvName : 'development';

  const rawApi = pickString('API_BASE_URL', extra);
  if (!rawApi) {
    throw new EnvError(
      [
        '缺少 API 基址配置(env.API_BASE_URL)。',
        '请在项目根目录创建 .env(可从 .env.example 复制)并设置:',
        '  EXPO_PUBLIC_API_BASE_URL=http://<host>:<port>',
        '或在 app.json 的 expo.extra.API_BASE_URL 中提供。',
        '应用已拒绝向任何猜测出来的地址发请求。',
      ].join('\n'),
    );
  }

  const api = normalize(rawApi, false);
  const rawWs = pickString('WS_BASE_URL', extra);
  const ws = rawWs ? normalize(rawWs, true) : api.replace(/^http/, 'ws');

  if (ENV_NAME !== 'development') {
    if (!api.startsWith('https://')) {
      throw new EnvError(
        `契约 0 节要求生产强制 HTTPS,当前 env.API_BASE_URL=${api}`,
      );
    }
    if (!ws.startsWith('wss://')) {
      throw new EnvError(
        `契约 0 节要求生产强制 WSS,当前 env.WS_BASE_URL=${ws}`,
      );
    }
  }

  return {
    ENV_NAME,
    API_BASE_URL: api,
    WS_BASE_URL: ws,
    APP_SCHEME: pickString('APP_SCHEME', extra, 'guardfind') as string,
    AGREEMENT_VERSION: pickString('AGREEMENT_VERSION', extra, 'v1') as string,
    REQUEST_TIMEOUT_MS: numberOr(extra.REQUEST_TIMEOUT_MS, 15000),
    WS_FALLBACK_AFTER_MS: numberOr(extra.WS_FALLBACK_AFTER_MS, 10000),
    UNREAD_POLL_INTERVAL_MS: numberOr(extra.UNREAD_POLL_INTERVAL_MS, 30000),
  };
}

function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : fallback;
}

let cached: AppEnv | null = null;

/** 强制重新解析配置(测试与热切换环境用)。 */
export function resetEnvCache(): void {
  cached = null;
}

export function getEnv(): AppEnv {
  if (!cached) cached = buildEnv();
  return cached;
}

export const env: AppEnv = {
  get ENV_NAME() {
    return getEnv().ENV_NAME;
  },
  get API_BASE_URL() {
    return getEnv().API_BASE_URL;
  },
  get WS_BASE_URL() {
    return getEnv().WS_BASE_URL;
  },
  get APP_SCHEME() {
    return getEnv().APP_SCHEME;
  },
  get AGREEMENT_VERSION() {
    return getEnv().AGREEMENT_VERSION;
  },
  get REQUEST_TIMEOUT_MS() {
    return getEnv().REQUEST_TIMEOUT_MS;
  },
  get WS_FALLBACK_AFTER_MS() {
    return getEnv().WS_FALLBACK_AFTER_MS;
  },
  get UNREAD_POLL_INTERVAL_MS() {
    return getEnv().UNREAD_POLL_INTERVAL_MS;
  },
};

/** 配置是否可用;不可用时返回错误文案,供根布局展示而非抛异常。 */
export function readEnvError(): string | null {
  try {
    getEnv();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
