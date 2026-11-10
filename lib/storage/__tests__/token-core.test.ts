import { createTokenStore } from '../token-core';
import type { KvDriver } from '../kv';

function driverWith(overrides: Partial<KvDriver>): KvDriver {
  return {
    name: 'fake',
    persistent: true,
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
    ...overrides,
  };
}

describe('token 存储降级', () => {
  it('读取抛异常时按未登录处理而不是崩溃', async () => {
    const store = createTokenStore(
      () => ({ driver: driverWith({ getItem: async () => Promise.reject(new Error('io')) }), kind: 'fake' }),
      'fake',
    );
    await expect(store.read()).resolves.toBeNull();
  });

  it('存储里是坏 JSON 或缺 token 时返回 null', async () => {
    const bad = createTokenStore(() => ({ driver: driverWith({ getItem: async () => '{oops' }), kind: 'fake' }), 'fake');
    const empty = createTokenStore(
      () => ({ driver: driverWith({ getItem: async () => JSON.stringify({ token: '' }) }), kind: 'fake' }),
      'fake',
    );
    await expect(bad.read()).resolves.toBeNull();
    await expect(empty.read()).resolves.toBeNull();
  });

  it('持久化写入失败不抛错', async () => {
    const store = createTokenStore(
      () => ({ driver: driverWith({ setItem: async () => Promise.reject(new Error('quota')) }), kind: 'fake' }),
      'fake',
    );
    await expect(
      store.write({ token: 't', tokenName: 'Authorization', expiresAt: null }),
    ).resolves.toBeUndefined();
  });
});
