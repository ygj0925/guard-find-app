/**
 * 记账日账单的分页流(页码制)。与 useFeed(游标制)平行:服务端
 * /app/ledger/record/page 是 page/size + total 的经典分页,且列表需要
 * 客户端按天合并分组,所以单独出一个小 hook,不硬塞游标接口。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LedgerRecord } from '@/lib/api/endpoints/ledger';
import {
  fetchLedgerRecords,
  fetchLedgerSummary,
} from '@/lib/api/endpoints/ledger';
import { useSession } from '@/store/session';
import { groupByDay, mergeDayGroups } from '@/lib/ledger/stats';
import { ApiError } from '@/lib/api/error';

export type LedgerFeedPhase =
  | 'loading'
  | 'refreshing'
  | 'loadingMore'
  | 'idle'
  | 'error';

export interface LedgerDayGroup {
  key: string;
  label: string;
  expense: number;
  income: number;
  records: LedgerRecord[];
}

const PAGE_SIZE = 20;

export function useLedgerFeed(
  month: string,
  enabled: boolean,
  groupId: string | null = null,
) {
  const sessionToken = useSession((state) => state.token);
  const currentKey = `${sessionToken}:${groupId}:${month}`;
  const [dataKey, setDataKey] = useState(currentKey);
  const [groups, setGroups] = useState<LedgerDayGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<LedgerFeedPhase>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  /** 已成功加载的月份;页面用它判断"返回页面时是否需要刷新"。 */
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const pageRef = useRef(1);
  const [totals, setTotals] = useState({ expense: 0, income: 0 });
  const inFlightRef = useRef(false);
  const generationRef = useRef(0);

  const load = useCallback(
    async (
      targetMonth: string,
      targetPage: number,
      mode: 'initial' | 'more',
    ) => {
      if (
        !enabled ||
        !sessionToken ||
        useSession.getState().token !== sessionToken
      )
        return;
      if (mode === 'more' && inFlightRef.current) return;
      const generation = ++generationRef.current;
      inFlightRef.current = true;
      setPhase(mode === 'more' ? 'loadingMore' : 'loading');
      setError(null);
      try {
        const [resp, summary] = await Promise.all([
          fetchLedgerRecords({
            month: targetMonth,
            groupId: groupId ?? undefined,
            page: targetPage,
            size: PAGE_SIZE,
          }),
          mode === 'initial'
            ? fetchLedgerSummary({
                period: 'month',
                date: `${targetMonth}-01`,
                groupId: groupId ?? undefined,
              })
            : Promise.resolve(null),
        ]);
        if (
          generation !== generationRef.current ||
          useSession.getState().token !== sessionToken
        )
          return;
        const incoming = groupByDay(
          Array.isArray(resp.records) ? resp.records : [],
        );
        setGroups((prev) =>
          mode === 'more' ? mergeDayGroups(prev, incoming) : incoming,
        );
        setTotal(resp.total);
        pageRef.current = targetPage;
        if (summary)
          setTotals({
            expense: summary.totalExpense,
            income: summary.totalIncome,
          });
        setLoadedMonth(targetMonth);
        setPhase('idle');
      } catch (caught) {
        if (
          generation !== generationRef.current ||
          useSession.getState().token !== sessionToken
        )
          return;
        setError(toApiError(caught));
        setPhase('error');
      } finally {
        if (generation === generationRef.current) inFlightRef.current = false;
      }
    },
    [enabled, groupId, sessionToken],
  );

  useEffect(() => {
    generationRef.current++;
    inFlightRef.current = false;
    const timer = setTimeout(() => {
      setDataKey(currentKey);
      setGroups([]);
      setTotal(0);
      setTotals({ expense: 0, income: 0 });
      setLoadedMonth(null);
      setError(null);
      setPhase('idle');
      if (enabled) void load(month, 1, 'initial');
    }, 0);
    // month/scope 切换即重查:账本作用域是显式导航,不做 slot 缓存。
    const requests = generationRef;
    const running = inFlightRef;
    return () => {
      clearTimeout(timer);
      requests.current++;
      running.current = false;
    };
  }, [month, enabled, groupId, sessionToken, load, currentKey]);

  const refresh = useCallback(
    () => (enabled ? load(month, 1, 'initial') : Promise.resolve(null)),
    [enabled, load, month],
  );

  const loadMore = useCallback(() => {
    if (phase !== 'idle' || !enabled) return;
    if (groups.reduce((sum, group) => sum + group.records.length, 0) >= total)
      return;
    return load(month, pageRef.current + 1, 'more');
  }, [phase, enabled, groups, total, month, load]);

  const recordCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.records.length, 0),
    [groups],
  );

  return {
    groups: dataKey === currentKey && enabled ? groups : [],
    total: dataKey === currentKey && enabled ? total : 0,
    phase:
      dataKey === currentKey
        ? phase
        : enabled
          ? ('loading' as const)
          : ('idle' as const),
    error: dataKey === currentKey && enabled ? error : null,
    loadedMonth: dataKey === currentKey && enabled ? loadedMonth : null,
    hasMore: dataKey === currentKey && recordCount < total,
    monthExpense: dataKey === currentKey && enabled ? totals.expense : 0,
    monthIncome: dataKey === currentKey && enabled ? totals.income : 0,
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
