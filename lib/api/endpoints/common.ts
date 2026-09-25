/**
 * 契约派生的公共分页 / 字典类型。字段名逐字对齐 `doc/天下无拐接口契约v1.md` 0 节。
 * ID 一律字符串承载(雪花 ID 超出 JS 安全整数)。
 */

/** 列表分页出参。 */
export interface PageResp<T> {
  records: T[];
  total: number;
}

/** 信息流游标分页出参。 */
export interface FeedResp<T> {
  records: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** 分页入参(列表)。`page` 从 1 起。 */
export interface PageQuery {
  page?: number;
  size?: number;
}

/** 游标入参(信息流)。 */
export interface CursorQuery {
  cursor?: string | null;
  size?: number;
}

/** 字典选项:`GET /app/plaza/filters` 提供,前端不硬编码。 */
export interface Option {
  value: string;
  label: string;
  order: number;
}

/** 行政区划树节点。 */
export interface RegionNode {
  code: string;
  name: string;
  level: number;
  children?: RegionNode[];
}

/** 服务端时间格式 `yyyy-MM-dd HH:mm:ss` 的字符串别名,便于类型自解释。 */
export type DateTimeString = string;
export type DateString = string;

/** `yyyy-MM` —— CasePublic 的失踪时间只到月(脱敏要求)。 */
export type MonthString = string;
