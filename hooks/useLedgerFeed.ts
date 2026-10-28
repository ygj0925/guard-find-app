/**
 * 记账日账单的分页流(页码制)。与 useFeed(游标制)平行:服务端
 * /app/ledger/record/page 是 page/size + total 的经典分页,且列表需要
 * 客户端按天合并分组,所以单独出一个小 hook,不硬塞游标接口。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LedgerRecord } from '@/lib/api/endpoints/ledger';
import { fetchLedgerRecords } from '@/lib/api/endpoints/ledger';
import { groupByDay, mergeDayGroups } from '@/lib/ledger/stats';
import { ApiError } from '@/lib/api/error';

export type LedgerFeedPhase = 'loading' | 'refreshing' | 'loadingMore' | 'idle' | 'error';

export interface LedgerDayGroup {
  key: string;
  label: string;
  expense: number;
  income: number;
  records: LedgerRecord[];
}

const PAGE_SIZE = 20;

/** 月份+作用域的组合缓存键(模块级,避免 hook 内声明顺序问题)。 */
function scopeKey(month: string, groupId: string | null): string {
  return groupId ? `${groupId}:${month}` : month;
}

export function useLedgerFeed(month: string, enabled: boolean, groupId: string | null = null) {
  const [groups, setGroups] = useState<LedgerDayGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<LedgerFeedPhase>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  /** 已成功加载的月份;页面用它判断"返回页面时是否需要刷新"。 */
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const pageRef = useRef(1);
  const loadedRef = useRef<Set<string>>(new Set());
  const generationRef = useRef(0);

  const load = useCallback(
    async (targetMonth: string, targetPage: number, mode: 'initial' | 'more') => {
      const generation = ++generationRef.current;
      setPhase(mode === 'more' ? 'loadingMore' : 'loading');
      setError(null);
      try {
        const resp = await fetchLedgerRecords({
          month: targetMonth,
          groupId: groupId ?? undefined,
          page: targetPage,
          size: PAGE_SIZE,
        });
        if (generation !== generationRef.current) return;
        const incoming = groupByDay(Array.isArray(resp.records) ? resp.records : []);
        setGroups((prev) => (mode === 'more' ? mergeDayGroups(prev, incoming) : incoming));
        setTotal(resp.total);
        pageRef.current = targetPage;
        loadedRef.current.add(scopeKey(targetMonth, groupId));
        setLoadedMonth(targetMonth);
        setPhase('idle');
      } catch (caught) {
        if (generation !== generationRef.current) return;
        setError(toApiError(caught));
        setPhase('error');
      }
    },
    [groupId],
  );

  useEffect(() => {
    if (!enabled) return;
    if (!loadedRef.current.has(scopeKey(month, groupId))) void load(month, 1, 'initial');
    // month/scope 切换即重查:账本作用域是显式导航,不做 slot 缓存。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, enabled, groupId]);

  const refresh = useCallback(
    () => (enabled ? load(month, 1, 'initial') : Promise.resolve(null)),
    [enabled, load, month],
  );

  const loadMore = useCallback(() => {
    if (phase !== 'idle' || !enabled) return;
    if (groups.reduce((sum, group) => sum + group.records.length, 0) >= total) return;
    return load(month, pageRef.current + 1, 'more');
  }, [phase, enabled, groups, total, month, load]);

  const monthExpense = useMemo(() => groups.reduce((sum, g) => sum + g.expense, 0), [groups]);
  const monthIncome = useMemo(() => groups.reduce((sum, g) => sum + g.income, 0), [groups]);
  const recordCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.records.length, 0),
    [groups],
  );

  return {
    groups,
    total,
    phase,
    error,
    loadedMonth,
    hasMore: recordCount < total,
    monthExpense,
    monthIncome,
    refresh,
    loadMore,
    /** 增删改后强制重拉当月。 */
    reload: refresh,
  };
}

// 错误统一收敛为 ApiError,与 useFeed 的兜底口径一致。
function toApiError(caught: unknown): ApiError {
  if (caught instanceof ApiError) return caught;
  return new ApiError({
    code: -1,
    msg: caught instanceof Error ? caught.message : '加载失败,请稍后重试',
    bizCode: 'NETWORK',
    cause: caught,
  });
}
