/**
 * 广场筛选叠加回归(spec 5.4):筛选位必须和 sort 一起打到 `/app/plaza/feed`。
 * 曾经有筛选时改走 `/app/search`,而搜索要求关键词非空,无关键词的筛选必然被服务端拒绝。
 */
import { fetchPlazaPage } from '../endpoints/plaza';

const mockGet = jest.fn();

jest.mock('../client', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

describe('广场取数契约', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ records: [], hasMore: false, nextCursor: null });
  });

  it('有筛选时仍走 feed,并与 sort 一起提交', async () => {
    await fetchPlazaPage({
      sort: 'urgent',
      size: 10,
      cityCode: '130400',
      gender: 'FEMALE',
      ageGroup: '',
      yearFrom: 2020,
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url, params] = mockGet.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/app/plaza/feed');
    expect(params).toMatchObject({ sort: 'urgent', cityCode: '130400', gender: 'FEMALE', yearFrom: 2020 });
    expect(params).not.toHaveProperty('ageGroup');
  });

  it('无筛选时只带流参数', async () => {
    await fetchPlazaPage({ sort: 'found', size: 10 });
    const [url, params] = mockGet.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/app/plaza/feed');
    expect(params).toMatchObject({ sort: 'found', size: 10 });
    expect(params).not.toHaveProperty('gender');
  });
});
