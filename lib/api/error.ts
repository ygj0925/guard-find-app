/**
 * 统一错误模型(契约 0 节 / 错误码表)。
 *
 * 服务端永远返回 HTTP 200 + `{ code, msg, data }`;`code!=0` 即业务失败。
 * 因此网络层异常、超时、以及业务 code 都要能表达,并且页面只需要一个 `ApiError`。
 */

/**
 * 契约错误码。
 *
 * 服务端响应信封的 `code` 是**字符串**(框架 `R#code` 为 String),取值分两层:
 * 框架层产出 HTTP 状态码样式的 "0"/"400"/"401"/"403"/"405"/"500";
 * 业务层由 `AppBizException` 显式携带 "4002"/"4003"/"4005"/"4006"/"4290"。
 * 本表用数值表达这些码(便于比较与 switch),`client.ts` 负责把字符串码归一为数值。
 */
export const ApiCode = {
  /** 成功。 */
  SUCCESS: 0,
  /** 参数校验失败(框架)。 */
  VALIDATE_FAILED: 400,
  /** 未登录 / token 失效(框架)。 */
  UNAUTHORIZED: 401,
  /** 已登录但无权限(框架)。 */
  FORBIDDEN: 403,
  /** 路由不存在(框架 Spring 层;业务上的"档案已下架/已删除"不走这里,而是 "500" + msg)。 */
  NOT_FOUND: 404,
  /** 请求方式不支持(框架)。 */
  METHOD_NOT_ALLOWED: 405,
  /** 通用业务异常与系统异常(框架)——对外不可见的档案也走这里,按 msg 展示。 */
  SERVER_ERROR: 500,
  /** 状态冲突(业务)。 */
  STATE_CONFLICT: 4002,
  /** 业务规则拒绝(业务)。 */
  RULE_REJECTED: 4003,
  /** 疑似重复档案(业务,msg 内含命中档案编号)。 */
  DUPLICATE_CASE: 4005,
  /** 账号锁定(业务)。 */
  ACCOUNT_LOCKED: 4006,
  /** 触发限流(业务,msg 内含建议等待秒数)。 */
  RATE_LIMITED: 4290,
} as const;

export type ApiCodeValue = (typeof ApiCode)[keyof typeof ApiCode];

/** 客户端自己造出来的码,不来自服务端。 */
export const ClientCode = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',
  BAD_ENVELOPE: 'BAD_ENVELOPE',
  HTTP_ERROR: 'HTTP_ERROR',
  CONFIG_MISSING: 'CONFIG_MISSING',
} as const;

export type ClientCodeValue = (typeof ClientCode)[keyof typeof ClientCode];

export class ApiError extends Error {
  /** 业务 code(服务端);客户端分类错误时为 0。 */
  readonly code: number;
  /** 服务端 msg 原文,可直接展示。 */
  readonly msg: string;
  /** 分类标识:业务 code 原值,或 ClientCode 枚举。 */
  readonly bizCode: number | ClientCodeValue;
  /** 业务负载(如 4005 的 `data.similarCases`、4006 的剩余时间)。 */
  readonly data?: unknown;
  /** 4290 的重试等待秒数。 */
  readonly retryAfterSeconds?: number;
  /** 4001 的字段级错误:`{ 字段名: 原因 }`。 */
  readonly fieldErrors?: Record<string, string>;
  readonly httpStatus?: number;
  readonly cause?: unknown;

  constructor(init: {
    code: number;
    msg: string;
    bizCode: number | ClientCodeValue;
    data?: unknown;
    retryAfterSeconds?: number;
    fieldErrors?: Record<string, string>;
    httpStatus?: number;
    cause?: unknown;
  }) {
    super(init.msg);
    this.name = 'ApiError';
    this.code = init.code;
    this.msg = init.msg;
    this.bizCode = init.bizCode;
    this.data = init.data;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.fieldErrors = init.fieldErrors;
    this.httpStatus = init.httpStatus;
    this.cause = init.cause;
  }

  get isUnauthorized(): boolean {
    return this.code === ApiCode.UNAUTHORIZED;
  }
  get isForbidden(): boolean {
    return this.code === ApiCode.FORBIDDEN;
  }
  get isNotFound(): boolean {
    return this.code === ApiCode.NOT_FOUND;
  }
  get isTimeout(): boolean {
    return this.bizCode === ClientCode.TIMEOUT;
  }
  get isNetwork(): boolean {
    return this.bizCode === ClientCode.NETWORK;
  }
  /** 可自动重试的错误(网络抖动 / 超时 / 服务器异常)。 */
  get isRetryable(): boolean {
    return (
      this.isTimeout ||
      this.isNetwork ||
      this.code === ApiCode.SERVER_ERROR ||
      this.code === ApiCode.RATE_LIMITED
    );
  }

  static network(message: string, cause?: unknown): ApiError {
    return new ApiError({
      code: -1,
      msg: '网络连接失败,请检查网络后重试',
      bizCode: ClientCode.NETWORK,
      cause,
    });
  }

  static timeout(ms: number): ApiError {
    return new ApiError({
      code: -1,
      msg: `请求超过 ${Math.round(ms / 1000)} 秒未响应,请稍后重试`,
      bizCode: ClientCode.TIMEOUT,
    });
  }
}

/**
 * code -> 兜底用户文案。服务端 msg 通常更具体,优先用 msg;
 * 本表用于 msg 为空、或需要按类型改变交互(如 4005 要弹确认框)时的判定。
 */
const FALLBACK_MESSAGE: Record<number, string> = {
  [ApiCode.SERVER_ERROR]: '服务器繁忙,请稍后重试',
  [ApiCode.UNAUTHORIZED]: '登录状态已失效,请重新登录',
  [ApiCode.FORBIDDEN]: '没有权限查看该内容',
  [ApiCode.NOT_FOUND]: '信息不存在或已下架',
  [ApiCode.VALIDATE_FAILED]: '填写内容有误,请检查标红字段',
  [ApiCode.STATE_CONFLICT]: '当前状态已变化,请刷新后重试',
  [ApiCode.RULE_REJECTED]: '未满足发布要求',
  [ApiCode.DUPLICATE_CASE]: '疑似已存在相同档案',
  [ApiCode.ACCOUNT_LOCKED]: '账号已锁定',
  [ApiCode.RATE_LIMITED]: '操作过于频繁,请稍后再试',
};

export function fallbackMessageOf(code: number): string {
  return FALLBACK_MESSAGE[code] ?? '请求失败,请稍后重试';
}

/** 页面直接可用的错误文案。 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const msg = error.msg?.trim();
    if (msg) return error.retryAfterSeconds ? `${msg}` : msg;
    return fallbackMessageOf(error.code);
  }
  if (error instanceof Error && error.message) return error.message;
  return '出现未知错误,请稍后重试';
}

export function isApiError(error: unknown, code?: number): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  return code === undefined || error.code === code;
}

/** 从 4290 的 msg 里抽"等待 N 秒",契约要求展示重试等待秒数。 */
export function parseRetrySeconds(msg: string): number | undefined {
  const matched = /(\d+)\s*秒/.exec(msg ?? '');
  return matched ? Number(matched[1]) : undefined;
}

/** 从 4001 的 data / msg 里抽出字段级错误,供表单定位到具体字段。 */
export function parseFieldErrors(data: unknown): Record<string, string> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  const source = (record.fieldErrors ?? record.errors ?? record) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    if (typeof value === 'string') out[key] = value;
    else if (value && typeof value === 'object') {
      const message = (value as { message?: unknown }).message;
      if (typeof message === 'string') out[key] = message;
    }
  }
  return Object.keys(out).length ? out : undefined;
}
