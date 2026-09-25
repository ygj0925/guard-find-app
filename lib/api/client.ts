/**
 * 统一 API 客户端(契约 0 节 + spec: 统一 API 客户端)。
 *
 * 职责边界:
 *   - 注入 `Authorization: {token}`(契约里 tokenName 由登录响应给出,默认 Authorization)
 *   - 解 `{code,msg,data}` 包裹,`code!==0` 抛类型化 ApiError
 *   - 15 秒超时中断(env.REQUEST_TIMEOUT_MS)
 *   - 401 全局只触发一次会话清理与回跳登录
 *   - 网络错误 / 超时 / 业务错误三类可区分
 * 不做的事:缓存、重试策略、路由 —— 那些在 hooks/useRequest 与 store 里。
 *
 * 这是全仓库唯一允许直接调用 `fetch` 的模块(eslint 有 no-restricted-globals 保障)。
 */
import { env } from '../env';
import {
  ApiCode,
  ApiError,
  ClientCode,
  fallbackMessageOf,
  parseFieldErrors,
  parseRetrySeconds,
} from './error';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEnvelope<T> {
  /** 服务端 `R#code` 是字符串("0"/"401"/"4005"…);保留 number 只为容错。见契约 0 节。 */
  code: string | number;
  msg?: string;
  data?: T;
}

export interface RequestOptions {
  method?: HttpMethod;
  /** 查询参数;undefined / null / '' 会被丢掉。数组按 `a=1&a=2` 展开。 */
  params?: Record<string, unknown> | undefined;
  body?: unknown;
  /** 已经序列化好的请求体(上传用 FormData 时)。传了它就不再处理 body。 */
  rawBody?: unknown;
  headers?: Record<string, string>;
  /** 覆盖默认超时;上传类请求应给更长。 */
  timeoutMs?: number;
  /** 传 AbortSignal 以便页面切换时取消。 */
  signal?: AbortSignal;
  /** 不带 Authorization 头(登录、公开接口用)。 */
  anonymous?: boolean;
}

/** 最小 FormData 形状,避免依赖 lib.dom。 */
export interface BodyInitLike {
  readonly isFormData?: boolean;
}

interface ClientHooks {
  getToken: () => string | null;
  getTokenName: () => string;
  onUnauthorized: (error: ApiError) => void;
  onBusinessError?: (error: ApiError, meta: { path: string; method: HttpMethod }) => void;
}

const hooks: ClientHooks = {
  getToken: () => null,
  getTokenName: () => 'Authorization',
  onUnauthorized: () => undefined,
};

/** 由 store/session.ts 在模块加载时注册,避免 client <-> store 的循环依赖。 */
export function configureClient(next: Partial<ClientHooks>): void {
  Object.assign(hooks, next);
}

/** 401 去重:并发多个未授权响应只触发一次登出与跳转。 */
let unauthorizedHandling = false;

export function __resetUnauthorizedGate(): void {
  unauthorizedHandling = false;
}

export function isHandlingUnauthorized(): boolean {
  return unauthorizedHandling;
}

/** 重新登录成功后调用,让下一次 401 仍能触发一次处理。 */
export function notifyAuthenticated(): void {
  unauthorizedHandling = false;
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const base = env.API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const query = buildQuery(params);
  return `${base}${cleanPath}${query ? `?${query}` : ''}`;
}

export function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue;
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
      continue;
    }
    if (typeof value === 'boolean') {
      parts.push(`${encodeURIComponent(key)}=${value ? 'true' : 'false'}`);
      continue;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}

/** 剥掉服务端可能带的 `/app` 前缀重复,保证拼接结果与契约逐字一致。 */
function normalizePath(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!/^\/(app|system|file)\//.test(cleanPath)) {
    throw new ApiError({
      code: -1,
      msg: `非法接口路径 "${path}":所有请求必须以契约中的 /app、/system 或 /file 开头。`,
      bizCode: ClientCode.BAD_ENVELOPE,
    });
  }
  return cleanPath;
}

/**
 * 发起请求并返回 `data` 载荷。
 * 抛错只有 ApiError 一种,调用方按 `error.code` / `error.bizCode` 分流。
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const url = buildUrl(normalizePath(path), options.params);
  const timeoutMs = options.timeoutMs ?? env.REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('TIMEOUT')), timeoutMs);
  const outerSignal = options.signal;
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort(new Error('ABORTED'));
    else outerSignal.addEventListener('abort', () => controller.abort(new Error('ABORTED')), {
      once: true,
    });
  }

  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (!options.anonymous) {
    const token = hooks.getToken();
    if (token) headers[hooks.getTokenName()] = token;
  }
  const isPlainBody =
    options.body !== undefined && options.body !== null && !options.rawBody;
  if (isPlainBody) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.rawBody
        ? (options.rawBody as unknown as BodyInit)
        : isPlainBody
          ? JSON.stringify(options.body)
          : undefined,
      signal: controller.signal as unknown as AbortSignal,
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted =
      (error as { name?: string })?.name === 'AbortError' ||
      (error as { message?: string })?.message === 'TIMEOUT';
    if (aborted && outerSignal?.aborted) {
      // 调用方主动取消:不当成错误冒泡,交上层按"过期响应丢弃"处理。
      throw new ApiError({
        code: -1,
        msg: '请求已取消',
        bizCode: ClientCode.ABORTED,
        cause: error,
      });
    }
    if (aborted) throw ApiError.timeout(timeoutMs);
    throw ApiError.network('网络连接失败,请检查网络后重试', error);
  }
  clearTimeout(timer);

  let envelope: ApiEnvelope<T> | null = null;
  const rawText = await readText(response);
  if (rawText) {
    try {
      envelope = JSON.parse(rawText) as ApiEnvelope<T>;
    } catch {
      envelope = null;
    }
  }

  // 服务端 `R#code` 是字符串("0"/"401"/"4005"…),必须归一为数值再比较;
  // 解析不出码值时(网关直接返回 HTML、非信封响应)退化到 HTTP 状态码。
  const rawCode = (envelope as { code?: unknown } | null)?.code;
  const normalized = typeof rawCode === 'number' ? rawCode : Number(rawCode);
  const code = Number.isFinite(normalized) ? normalized : response.status;

  if (!response.ok && envelope === null) {
    const error = new ApiError({
      code: response.status,
      msg: fallbackMessageOf(response.status),
      bizCode: response.status,
      httpStatus: response.status,
    });
    return handleFailure(error, { path, method });
  }

  if (envelope === null) {
    const error = new ApiError({
      code: -1,
      msg: '服务端返回了无法解析的响应体',
      bizCode: ClientCode.BAD_ENVELOPE,
      httpStatus: response.status,
    });
    return handleFailure(error, { path, method });
  }

  if (code !== ApiCode.SUCCESS) {
    const msg = envelope.msg?.trim() || fallbackMessageOf(code);
    const error = new ApiError({
      code,
      msg,
      bizCode: code,
      data: envelope.data,
      httpStatus: response.status,
      retryAfterSeconds: code === ApiCode.RATE_LIMITED ? parseRetrySeconds(msg) : undefined,
      fieldErrors: code === ApiCode.VALIDATE_FAILED ? parseFieldErrors(envelope.data) : undefined,
    });
    return handleFailure(error, { path, method });
  }

  return envelope.data as T;
}

async function readText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function handleFailure(error: ApiError, meta: { path: string; method: HttpMethod }): never {
  if (error.code === ApiCode.UNAUTHORIZED) {
    if (!unauthorizedHandling) {
      unauthorizedHandling = true;
      hooks.onUnauthorized(error);
    }
    hooks.onBusinessError?.(error, meta);
    throw error;
  }
  hooks.onBusinessError?.(error, meta);
  throw error;
}

/** 便捷包装,保持 endpoints 文件里只写路径与类型。 */
export const api = {
  get: <T>(path: string, params?: Record<string, unknown>, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET', params }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE', body }),
};
