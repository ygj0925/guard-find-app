export {};

type DriverModule = typeof import('../native-kv-driver');

function loadWith(factory: () => unknown): DriverModule {
  let mod: DriverModule | undefined;
  // 驱动内部是懒 require,在 isolateModules 之外才执行,必须清掉上个用例缓存的 mock。
  jest.resetModules();
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', factory);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 每个用例换一份 async-storage mock
    mod = require('../native-kv-driver') as DriverModule;
  });
  return mod as DriverModule;
}

afterEach(() => {
  jest.dontMock('@react-native-async-storage/async-storage');
});

describe('loadNativeKvDriver', () => {
  it('async-storage 可用时返回持久化驱动并透传读写', async () => {
    const mockStore = new Map<string, string>();
    const { loadNativeKvDriver } = loadWith(() => ({
      __esModule: true,
      default: {
        getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
        setItem: jest.fn(async (k: string, v: string) => {
          mockStore.set(k, v);
        }),
        removeItem: jest.fn(async (k: string) => {
          mockStore.delete(k);
        }),
      },
    }));

    const driver = loadNativeKvDriver();
    expect(driver).toMatchObject({ name: 'async-storage', persistent: true });
    await driver!.setItem('k', 'v');
    expect(await driver!.getItem('k')).toBe('v');
    await driver!.removeItem('k');
    expect(await driver!.getItem('k')).toBeNull();
  });

  it('原生模块缺失(包顶层抛错)时返回 null', () => {
    const { loadNativeKvDriver } = loadWith(() => {
      throw new Error('[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.');
    });
    expect(loadNativeKvDriver()).toBeNull();
  });
});
