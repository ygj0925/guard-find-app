import { ApiCode, ApiError, ClientCode } from '@/lib/api/error';
import { resendCooldownSeconds } from '@/hooks/useCountdown';
import {
  CAPTCHA_AFTER_FAILURES,
  DEFAULT_LOGIN_TARGET,
  canStartErase,
  canSubmitErase,
  checkLoginInput,
  createSingleFlight,
  describeAuthError,
  nextFailureCount,
  requiresCaptcha,
  resolveLoginReturn,
  type LoginInput,
} from '../login-rules';

function input(overrides: Partial<LoginInput> = {}): LoginInput {
  return {
    mode: 'PHONE',
    agreed: true,
    phone: '13800138000',
    code: '123456',
    account: '',
    password: '',
    requireCaptcha: false,
    captchaLoaded: false,
    captchaValue: '',
    ...overrides,
  };
}

function bizError(code: number, msg = '验证码错误'): ApiError {
  return new ApiError({ code, msg, bizCode: code });
}

describe('验证码倒计时与重复点击(spec 4.5)', () => {
  it('冷却秒数取有效期与 60 秒限流的较小值', () => {
    expect(resendCooldownSeconds(300)).toBe(60);
    expect(resendCooldownSeconds(45)).toBe(45);
    expect(resendCooldownSeconds(null)).toBe(60);
    expect(resendCooldownSeconds(0)).toBe(60);
  });

  it('请求未返回前的第二次点击不发起请求', async () => {
    const gate = createSingleFlight();
    let release: () => void = () => undefined;
    const send = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('sent');
        }),
    );

    const first = gate.run(send);
    const second = gate.run(send);
    expect(gate.busy).toBe(true);
    await expect(second).resolves.toBeUndefined();
    release();
    await expect(first).resolves.toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
    expect(gate.busy).toBe(false);
  });

  it('请求失败后闸门放开,允许再次发送', async () => {
    const gate = createSingleFlight();
    await expect(gate.run(async () => Promise.reject(new Error('net')))).rejects.toThrow('net');
    expect(gate.busy).toBe(false);
    await expect(gate.run(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('连续错误后要求图形验证码', () => {
  it('第 3 次验证码错误后进入图形验证', () => {
    let failures = 0;
    for (let attempt = 0; attempt < CAPTCHA_AFTER_FAILURES; attempt += 1) {
      failures = nextFailureCount(bizError(ApiCode.SERVER_ERROR), 'PHONE', failures) ?? failures;
      expect(requiresCaptcha(failures, false)).toBe(attempt === CAPTCHA_AFTER_FAILURES - 1);
    }
  });

  it('服务端已要求图形验证码:重进页面后第一次失败直接到阈值', () => {
    expect(nextFailureCount(bizError(ApiCode.SERVER_ERROR, '请输入图形验证码'), 'PHONE', 0)).toBe(3);
  });

  it('锁定、断网、超时与密码登录不计数', () => {
    expect(nextFailureCount(bizError(ApiCode.ACCOUNT_LOCKED), 'PHONE', 1)).toBeNull();
    expect(nextFailureCount(new ApiError({ code: 0, msg: '', bizCode: ClientCode.NETWORK }), 'PHONE', 1)).toBeNull();
    expect(nextFailureCount(new ApiError({ code: 0, msg: '', bizCode: ClientCode.TIMEOUT }), 'PHONE', 1)).toBeNull();
    expect(nextFailureCount(bizError(ApiCode.SERVER_ERROR), 'ACCOUNT', 1)).toBeNull();
  });

  it('服务端关闭图形验证码时不拦截', () => {
    expect(requiresCaptcha(5, true)).toBe(false);
  });

  it('要求图形验证码时:未加载或字符不足都阻断提交', () => {
    expect(checkLoginInput(input({ requireCaptcha: true }))?.errors.captcha).toContain('未加载');
    expect(
      checkLoginInput(input({ requireCaptcha: true, captchaLoaded: true, captchaValue: 'ab' }))?.errors.captcha,
    ).toBe('请输入图中字符');
    expect(checkLoginInput(input({ requireCaptcha: true, captchaLoaded: true, captchaValue: 'ab3d' }))).toBeNull();
  });
});

describe('登录表单前置校验', () => {
  it('未同意协议先拦', () => {
    expect(checkLoginInput(input({ agreed: false }))?.formError).toContain('用户协议');
  });

  it('手机号与验证码格式', () => {
    expect(checkLoginInput(input({ phone: '1380013800' }))?.errors.phone).toBe('请输入 11 位大陆手机号');
    expect(checkLoginInput(input({ code: '12345' }))?.errors.code).toBe('请输入 6 位数字验证码');
  });

  it('账号密码模式只校验账号与密码', () => {
    expect(checkLoginInput(input({ mode: 'ACCOUNT', phone: '' }))?.errors).toEqual({
      account: '请输入账号',
      password: '请输入密码',
    });
    expect(checkLoginInput(input({ mode: 'ACCOUNT', phone: '', account: 'ops', password: 'secret12' }))).toBeNull();
  });
});

describe('登录回跳携带内容', () => {
  it('URL redirect 优先,并保留被拦下的收藏动作', () => {
    const pending = { href: '/case/c-1', run: 'favorite:c-1', from: 'favorite', at: 1 };
    expect(resolveLoginReturn('/me/leads', pending)).toEqual({ href: '/me/leads', run: 'favorite:c-1', from: 'favorite' });
  });

  it('没有 redirect 时用 pending 目标,都没有回广场', () => {
    expect(resolveLoginReturn(null, { href: '/case/c-1', run: 'favorite:c-1', at: 1 }).href).toBe('/case/c-1');
    expect(resolveLoginReturn(null, null)).toEqual({ href: DEFAULT_LOGIN_TARGET, run: undefined, from: 'login' });
  });
});

describe('注销二次确认', () => {
  it('原因为空时第一步不可点', () => {
    expect(canStartErase('   ')).toBe(false);
    expect(canStartErase('不再使用')).toBe(true);
  });

  it('未勾选"我已知悉"不提交', () => {
    expect(canSubmitErase('不再使用', false)).toBe(false);
    expect(canSubmitErase('', true)).toBe(false);
    expect(canSubmitErase('不再使用', true)).toBe(true);
  });
});

describe('登录错误文案', () => {
  it('锁定给剩余时间,限流给等待秒数', () => {
    expect(describeAuthError(new ApiError({ code: ApiCode.ACCOUNT_LOCKED, msg: '账号已锁定', bizCode: 4006, data: 120 }))).toContain(
      '后重试',
    );
    expect(
      describeAuthError(
        new ApiError({ code: ApiCode.RATE_LIMITED, msg: '操作过于频繁', bizCode: 4290, retryAfterSeconds: 30 }),
      ),
    ).toBe('操作过于频繁,请 30 秒后再试');
  });
});
