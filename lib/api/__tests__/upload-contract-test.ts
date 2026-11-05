/**
 * 上传契约回归:C 端必须打到 `/app/file/upload`。
 *
 * 事故背景:App 曾指向 `/file/upload`,而服务端只有后台 `/system/file/upload`
 * 与公共 `/system/common/file`,该路径无处理器,真机上传必然 404。
 * 这里把路径、字段名、超时钉死,避免后续改动又漂回不存在的端点。
 */
import { uploadApi } from '../endpoints/upload';

const mockPost = jest.fn();

jest.mock('../client', () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
}));

describe('上传接口契约', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPost.mockResolvedValue({ url: '/a.png', name: 'a.png', size: 3 });
  });

  it('走 /app/file/upload 且字段为 path + file', async () => {
    await uploadApi.file(
      { uri: 'file:///tmp/a.png', name: 'a.png', type: 'image/png' },
      'avatar',
    );

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, params, options] = mockPost.mock.calls[0] as [
      string,
      unknown,
      { rawBody: FormData; timeoutMs: number },
    ];
    expect(url).toBe('/app/file/upload');
    expect(params).toBeUndefined();
    expect(options.timeoutMs).toBe(60_000);

    const form = options.rawBody;
    const pathValue = form.get('path');
    expect(pathValue).toBe('avatar');
    expect(form.get('file')).toBeTruthy();
  });
});
