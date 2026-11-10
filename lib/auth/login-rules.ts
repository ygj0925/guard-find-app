/**
 * 登录与注销页的纯规则(spec: 验证码登录为主入口 / 资料与账号安全)。
 * 页面只管状态与渲染,判定都在这里,便于单测覆盖"重复点击、3 次错误、回跳、二次确认"。
 */
import { ApiCode, ApiError, parseRetrySeconds, toUserMessage } from '@/lib/api/error';
import { formatDuration } from '@/lib/format';
import type { PendingAction } from '@/lib/nav';

export const PHONE_PATTERN = /^1[3-9]\d{9}$/;
export const CODE_PATTERN = /^\d{6}$/;
export const CAPTCHA_AFTER_FAILURES = 3;
export const DEFAULT_RESEND_SECONDS = 60;
export const DEFAULT_LOGIN_TARGET = '/(tabs)/plaza';

export type LoginMode = 'PHONE' | 'ACCOUNT';

/** 同一时刻只放行一个请求;状态在闭包里同步翻转,不依赖下一次渲染。 */
export interface SingleFlight {
  readonly busy: boolean;
  run<T>(task: () => Promise<T>): Promise<T | undefined>;
}

export function createSingleFlight(): SingleFlight {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    async run<T>(task: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await task();
      } finally {
        busy = false;
      }
    },
  };
}

export function requiresCaptcha(failures: number, captchaDisabled: boolean): boolean {
  return failures >= CAPTCHA_AFTER_FAILURES && !captchaDisabled;
}

export interface LoginInput {
  mode: LoginMode;
  agreed: boolean;
  phone: string;
  code: string;
  account: string;
  password: string;
  requireCaptcha: boolean;
  captchaLoaded: boolean;
  captchaValue: string;
}

export interface LoginCheck {
  errors: Record<string, string>;
  formError: string | null;
}

/** 返回 null 表示可以提交;否则给出字段错误或整表错误。 */
export function checkLoginInput(input: LoginInput): LoginCheck | null {
  if (!input.agreed) return { errors: {}, formError: '请先阅读并同意《用户协议》与《隐私政策》要点' };
  if (input.mode === 'PHONE') {
    if (!PHONE_PATTERN.test(input.phone)) return { errors: { phone: '请输入 11 位大陆手机号' }, formError: null };
    if (!CODE_PATTERN.test(input.code)) return { errors: { code: '请输入 6 位数字验证码' }, formError: null };
    if (input.requireCaptcha && !input.captchaLoaded) {
      return { errors: { captcha: '图形验证码未加载,请点击图片区域刷新' }, formError: null };
    }
    if (input.requireCaptcha && input.captchaValue.trim().length < 4) {
      return { errors: { captcha: '请输入图中字符' }, formError: null };
    }
    return null;
  }
  if (!input.account.trim() || !input.password) {
    return {
      errors: { account: input.account.trim() ? '' : '请输入账号', password: input.password ? '' : '请输入密码' },
      formError: null,
    };
  }
  return null;
}

/**
 * 登录失败后的验证码错误计数;返回 null 表示本次失败不计数(锁定、断网、超时、密码登录)。
 * 服务端按手机号累计,重进本页本地计数归零,所以服务端已要求图形验证码时直接跳到阈值。
 */
export function nextFailureCount(error: unknown, mode: LoginMode, failures: number): number | null {
  if (mode !== 'PHONE' || !(error instanceof ApiError)) return null;
  if (error.code === ApiCode.ACCOUNT_LOCKED || error.isNetwork || error.isTimeout) return null;
  return (error.msg ?? '').includes('图形验证码')
    ? Math.max(failures + 1, CAPTCHA_AFTER_FAILURES)
    : failures + 1;
}

/** 回跳目标:URL 的 redirect 优先,其次 guard 记下的 pending action;被拦下的动作原样带回。 */
export function resolveLoginReturn(
  redirect: string | null,
  pending: PendingAction | null,
): Omit<PendingAction, 'at'> {
  return {
    href: redirect ?? pending?.href ?? DEFAULT_LOGIN_TARGET,
    run: pending?.run,
    from: pending?.from ?? 'login',
  };
}

/** 注销第一步:原因必填,只打开确认框。 */
export function canStartErase(reason: string): boolean {
  return reason.trim().length > 0;
}

/** 注销第二步:原因与"我已知悉"都满足才发请求。 */
export function canSubmitErase(reason: string, acknowledged: boolean): boolean {
  return acknowledged && canStartErase(reason);
}

/**
 * 登录类错误的用户文案。
 * 4006 锁定要给出剩余时间(契约错误码表),4290 要给出重试等待秒数。
 */
export function describeAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === ApiCode.ACCOUNT_LOCKED) {
      const seconds = parseRetrySeconds(error.msg) ?? firstNumberInData(error.data);
      return seconds ? `账号已锁定,请在 ${formatDuration(seconds)} 后重试` : error.msg || '账号已锁定,请稍后重试';
    }
    if (error.code === ApiCode.RATE_LIMITED) {
      const seconds = error.retryAfterSeconds ?? parseRetrySeconds(error.msg);
      return seconds ? `操作过于频繁,请 ${seconds} 秒后再试` : error.msg;
    }
  }
  return toUserMessage(error);
}

/** 契约未规定 4006 的 data 结构,不猜字段名:只在"单个数字"时用它当剩余秒数。 */
function firstNumberInData(data: unknown): number | undefined {
  if (typeof data === 'number' && Number.isFinite(data) && data > 0) return data;
  return undefined;
}
