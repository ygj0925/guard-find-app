/**
 * 键值存储驱动单测:持久化标记、注册驱动与失败回退。
 */
import {
  __resetKvForTests,
  getKvDriverName,
  getKvLastError,
  isKvPersistent,
  kvGet,
  kvRemove,
  kvSet,
  registerKvDriver,
  type KvDriver,
} from '../kv';

describe('kv 存储驱动', () => {
  afterEach(() => {
    __resetKvForTests();
  });

  it('默认驱动的持久化标记与实现一致', () => {
    expect(isKvPersistent()).toBe(getKvDriverName() === 'web-localStorage');
  });

  it('注册持久化驱动后读写走该驱动', async () => {
    const store = new Map<string, string>();
    const driver: KvDriver = {
      name: 'test-persistent',
      persistent: true,
      getItem: async (key) => store.get(key) ?? null,
      setItem: async (key, value) => {
        store.set(key, value);
      },
      removeItem: async (key) => {
        store.delete(key);
      },
    };
    registerKvDriver(driver);

    expect(isKvPersistent()).toBe(true);
    expect(getKvDriverName()).toBe('test-persistent');
    await kvSet('note', 'hello');
    expect(store.get('note')).toBe('hello');
    expect(await kvGet('note')).toBe('hello');
    await kvRemove('note');
    expect(store.has('note')).toBe(false);
    expect(await kvGet('note')).toBeNull();
  });

  it('驱动写入失败不抛错,回退到进程内镜像并记录错误', async () => {
    registerKvDriver({
      name: 'broken',
      persistent: true,
      getItem: async () => {
        throw new Error('read failed');
      },
      setItem: async () => {
        throw new Error('disk full');
      },
      removeItem: async () => {
        throw new Error('remove failed');
      },
    });

    await expect(kvSet('draft', 'v1')).resolves.toBeUndefined();
    expect(getKvLastError()).toContain('kvSet');
    expect(await kvGet('draft')).toBe('v1');

    await expect(kvRemove('draft')).resolves.toBeUndefined();
    expect(getKvLastError()).toContain('kvRemove');
    expect(await kvGet('draft')).toBeNull();
  });
});
