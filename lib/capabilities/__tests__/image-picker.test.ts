export {};

type PickerModule = typeof import('../image-picker');

function loadWith(factory: () => unknown): PickerModule {
  let mod: PickerModule | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-image-picker', factory);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 模块加载时就按 mock 选定实现
    mod = require('../image-picker') as PickerModule;
  });
  return mod as PickerModule;
}

afterEach(() => {
  jest.dontMock('expo-image-picker');
});

describe('imagePicker (expo-image-picker)', () => {
  it('映射选中资源,并按上限截断与透传 selectionLimit', async () => {
    const mockLaunch = jest.fn().mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', fileSize: 100, width: 10, height: 20 },
        { uri: 'file:///b.jpg', fileName: null, mimeType: null, fileSize: null },
        { uri: 'file:///c.jpg' },
      ],
    });
    const { imagePicker } = loadWith(() => ({ launchImageLibraryAsync: mockLaunch }));

    expect(imagePicker.kind).toBe('image-picker:expo');
    expect(imagePicker.isAvailable()).toBe(true);
    const result = await imagePicker.pickImages(2);

    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 2 }),
    );
    expect(result).toEqual({
      ok: true,
      via: 'image-picker:expo',
      value: [
        { uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', size: 100, width: 10, height: 20 },
        { uri: 'file:///b.jpg', fileName: undefined, mimeType: undefined, size: undefined, width: undefined, height: undefined },
      ],
    });
  });

  it('用户取消或空选返回 cancelled', async () => {
    const mockLaunch = jest.fn().mockResolvedValue({ canceled: true, assets: null });
    const { imagePicker } = loadWith(() => ({ launchImageLibraryAsync: mockLaunch }));

    const result = await imagePicker.pickImages(1);
    expect(result).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: false, selectionLimit: 1 }));
  });

  it('原生调用抛错返回可识别的 failed,不抛出', async () => {
    const mockLaunch = jest.fn().mockRejectedValue(new Error('permission denied'));
    const { imagePicker } = loadWith(() => ({ launchImageLibraryAsync: mockLaunch }));

    const result = await imagePicker.pickImages(3);
    expect(result).toMatchObject({ ok: false, reason: 'failed', detail: 'permission denied' });
  });

  it('原生模块加载失败时降级为 unsupported', async () => {
    const { imagePicker } = loadWith(() => {
      throw new Error("Cannot find native module 'ExponentImagePicker'");
    });

    expect(imagePicker.isAvailable()).toBe(false);
    const result = await imagePicker.pickImages(1);
    expect(result).toMatchObject({ ok: false, reason: 'unsupported' });
  });
});
