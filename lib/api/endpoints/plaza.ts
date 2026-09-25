/**
 * 3. 广场与搜索(`/app/plaza`、`/app/search`)—— 对齐契约 3 节。
 * 字典值一律来自 `GET /app/plaza/filters`,前端 MUST NOT 硬编码枚举(spec 明确要求)。
 */
import { api } from '../client';
import type { CursorQuery, FeedResp, Option, RegionNode } from './common';
import type { AgeGroup, BloodSampleStatus, CasePublic, CaseType, UrgencyLevel } from './case';
import type { Gender } from './auth';

/** 四种流互斥,服务端强制 status,不允许靠前端二次过滤。 */
export type PlazaSort = 'latest' | 'urgent' | 'nearby' | 'found';

export interface PlazaFeedQuery extends CursorQuery {
  sort?: PlazaSort;
  provinceCode?: string;
  cityCode?: string;
  keyword?: string;
}

/**
 * 广场筛选面板的选择结果。
 *
 * 契约约束:`/app/plaza/feed` 只接受 sort/provinceCode/cityCode/keyword,
 * 性别、年龄段、情形、血样、年份区间这些筛选位只在 `/app/search` 上有。
 * 因此一旦有筛选项,列表就改走 `/app/search`(见 components/business/filter-sheet.tsx 的说明)。
 */
export interface PlazaFilterSelection {
  gender?: string;
  ageGroup?: string;
  caseType?: string;
  bloodSampleStatus?: string;
  yearFrom?: number;
  yearTo?: number;
}

export function hasPlazaFilters(filters: PlazaFilterSelection): boolean {
  return Object.entries(filters).some(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
}

export interface PlazaFilters {
  regions: RegionNode[];
  caseTypes: Option[];
  ageGroups: Option[];
  bloodSampleStatuses: Option[];
  genders: Option[];
  relations: Option[];
  urgencyLevels: Option[];
}

/** `GET /app/plaza/statistics` 首屏信任数据。 */
export interface PlazaStatistics {
  totalCase: number;
  foundCase: number;
  recentNewCase: number;
  todayLead: number;
}

export type TrackEventType = 'EXPOSE' | 'CLICK' | 'SHARE';

export interface TrackReq {
  eventType: TrackEventType;
  targetId: string;
  /** 埋点归属的档案 id。 */
  targetCase: string;
  durationMs?: number;
}

export interface SearchQuery extends CursorQuery {
  keyword?: string;
  provinceCode?: string;
  cityCode?: string;
  caseType?: CaseType;
  ageGroup?: AgeGroup;
  gender?: Gender;
  yearFrom?: number;
  yearTo?: number;
  bloodSampleStatus?: BloodSampleStatus;
  /** 契约未给 urgency 过滤位;广场筛选面板因此只放契约里有的六项。 */
  urgencyLevel?: UrgencyLevel;
}

/** 兜底字典读取,首选仍是 /app/plaza/filters。 */
export interface DictItem {
  value: string;
  label: string;
  order?: number;
}

export interface DictResp {
  codes: Record<string, DictItem[]>;
}

export const plazaApi = {
  feed: (query: PlazaFeedQuery) =>
    api.get<FeedResp<CasePublic>>('/app/plaza/feed', { ...query }, { anonymous: true }),
  filters: () => api.get<PlazaFilters>('/app/plaza/filters', undefined, { anonymous: true }),
  statistics: () => api.get<PlazaStatistics>('/app/plaza/statistics', undefined, { anonymous: true }),
  track: (req: TrackReq) => api.post<null>('/app/plaza/track', req),
  search: (query: SearchQuery) =>
    api.get<FeedResp<CasePublic>>('/app/search', { ...query }, { anonymous: true }),
  clearSearchHistory: () => api.post<null>('/app/search/history/clear'),
  dict: (codes: string[]) =>
    api.get<DictResp>('/app/common/dict', { codes: codes.join(',') }, { anonymous: true }),
};

/**
 * 广场列表取数:按"有没有筛选条件"选端点。
 *
 * 契约里 `/app/plaza/feed` 只有 sort + 城市 + keyword,而性别/年龄段/情形/血样/年份区间
 * 只在 `/app/search` 上;两边都不接受对方的参数,所以:
 *   无筛选  -> feed(保留四流语义,urgent/found 由服务端强制 status)
 *   有筛选  -> search(此时流内排序退化为服务端默认序,UI 明示"已按筛选条件搜索")
 * 这条限制已作为契约差异写入交付报告(spec 5.4 要求"筛选叠加流条件")。
 */
export async function fetchPlazaPage(
  query: PlazaFeedQuery & PlazaFilterSelection,
): Promise<FeedResp<CasePublic>> {
  const { sort, cursor, size, provinceCode, cityCode, keyword, ...filters } = query;
  if (!hasPlazaFilters(filters as PlazaFilterSelection)) {
    return plazaApi.feed({ sort, cursor, size, provinceCode, cityCode, keyword });
  }
  return plazaApi.search({
    cursor,
    size,
    provinceCode,
    cityCode,
    keyword,
    ...(filters as SearchQuery),
  });
}

/**
 * 搜索页取数:始终走 `/app/search`。
 *
 * 与 `fetchPlazaPage` 的区别只在"没有筛选条件时也留给服务端":搜索页需要服务端的
 * 关键词长度/敏感词校验与搜索序,不能回落到 `/app/plaza/feed`。
 * 筛选位的窄类型(`CaseType`/`Gender` 等)取值来自字典,前端不复述枚举,统一在这里透传。
 */
export async function fetchSearchPage(
  query: Omit<PlazaFeedQuery, 'sort'> & PlazaFilterSelection,
): Promise<FeedResp<CasePublic>> {
  const { cursor, size, provinceCode, cityCode, keyword, ...filters } = query;
  return plazaApi.search({
    cursor,
    size,
    provinceCode,
    cityCode,
    keyword,
    ...(filters as SearchQuery),
  });
}
