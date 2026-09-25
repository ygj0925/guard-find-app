/**
 * 响应信封解包的回归测试。
 *
 * 存在的理由是一个真实事故:框架 `top.continew.starter.web.model.R#code` 是 **String**
 * (实测返回 `{"code":"0",...}`),而客户端一度按 `typeof code === 'number'` 判定,
 * 导致所有成功响应退化成 HTTP 状态码 200 被当成失败。这里把"字符串码"钉死。
 */
import { ApiCode, ApiError } from '../error';
import { __resetUnauthorizedGate, configureClient, request } from '../client';

jest.mock('../../env', () => ({
  env: {
    API_BASE_URL: 'http://api.test',
    WS_BASE_URL: 'ws://api.test',
    REQUEST_TIMEOUT_MS: 15000,
    ENV_NAME: 'development',
  },
  getEnv: () => ({
    API_BASE_URL: 'http://api.test',
    WS_BASE_URL: 'ws://api.test',
    REQUEST_TIMEOUT_MS: 15000,
    ENV_NAME: 'development',
  }),
  EnvError: class EnvError extends Error {},
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('API 信封解包(契约 0 节:code 为字符串)', () => {
  const unauthorized = jest.fn();

  beforeEach(() => {
    __resetUnauthorizedGate();
    unauthorized.mockClear();
    configureClient({
      getToken: () => 'token-value',
      getTokenName: () => 'Authorization',
      onUnauthorized: unauthorized,
    });
  });

  it('字符串 "0" 视为成功并返回 data', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ code: '0', msg: '操作成功', success: true, data: { totalCase: 0 } }),
    ) as never;

    await expect(request('/app/plaza/statistics')).resolves.toEqual({ totalCase: 0 });
  });

  it('数字 0 也兼容(不因服务端序列化方式变化而误判)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 0, msg: '操作成功', data: 'ok' })) as never;

    await expect(request('/app/plaza/statistics')).resolves.toBe('ok');
  });

  it('"401" 归一为数值 401 并抛出 ApiError', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: '401', msg: '登录已过期，请重新登录', data: null })) as never;

    const error = await request('/app/auth/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ApiCode.UNAUTHORIZED);
    expect((error as ApiError).msg).toBe('登录已过期，请重新登录');
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('并发多个 401 只触发一次会话清理', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ code: '401', msg: '登录已过期，请重新登录', data: null }),
    ) as never;

    const results = await Promise.allSettled([
      request('/app/message/unread'),
      request('/app/auth/me'),
      request('/app/find/case/mine'),
    ]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('业务层码 "4005" / "4290" 原样归一并可被识别', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: '4005', msg: '疑似重复档案：XC20260901' })) as never;
    const duplicate = await request('/app/find/case', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect((duplicate as ApiError).code).toBe(ApiCode.DUPLICATE_CASE);

    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: '4290', msg: '操作过于频繁，请 30 秒后再试' })) as never;
    const limited = await request('/app/find/case', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect((limited as ApiError).code).toBe(ApiCode.RATE_LIMITED);
    expect((limited as ApiError).retryAfterSeconds).toBe(30);
  });

  it('参数校验失败码 "400" 不再被当成未知错误', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: '400', msg: '姓名不能为空', data: null })) as never;

    const error = await request('/app/find/case', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe(ApiCode.VALIDATE_FAILED);
  });

  it('非信封响应(HTTP 200 + HTML)按 BAD_ENVELOPE 归类而不是静默成功', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      json: async () => {
        throw new Error('not json');
      },
      text: async () => '<html>login</html>',
    } as unknown as Response) as never;

    const error = await request('/app/plaza/feed').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).bizCode).toBeTruthy();
  });
});
