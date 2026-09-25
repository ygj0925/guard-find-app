/**
 * 游标信息流(spec 2.8 + 契约 0 节 FeedResp)。广场四流、搜索、消息列表共用。
 *
 * 四条必须可测的性质:
 *   1. 不重不漏:`records` 按 id 去重,重复返回的条目不会二次插入;
 *   2. `hasMore=false` 之后 MUST NOT 再发请求;
 *   3. 竞态丢弃:切流/切城市后,旧请求的响应不能覆盖新数据;
 *   4. 每条流(slot)保留自己的 items 与游标,切走再切回不重新从第 1 页加载。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/error';
import type { FeedResp } from '@/lib/api/endpoints/common';

export interface FeedSlot<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  loadedOnce: boolean;
}

export type FeedLoadPhase = 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'error';

export interface UseFeedResult<T> {
  items: T[];
  phase: FeedLoadPhase;
  error: ApiError | null;
  hasMore: boolean;
  loadedOnce: boolean;
  isEmpty: boolean;
  /** 首屏且还没有任何数据 -> 骨架屏。 */
  showSkeleton: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  patchItem: (id: string, patch: Partial<T>) => void;
}

function emptySlot<T>(): FeedSlot<T> {
  return { items: [], nextCursor: null, hasMore: true, loadedOnce: false };
}

function toApiError(caught: unknown): ApiError {
  if (caught instanceof ApiError) return caught;
  return new ApiError({
    code: -1,
    msg: caught instanceof Error ? caught.message : '加载失败,请稍后重试',
    bizCode: 'NETWORK',
    cause: caught,
  });
}

/**
 * @param slotKey 流身份(如 `urgent|130400|female`)。变化即切换 slot。
 * @param fetcher 传入游标(首屏为 null)返回一页。
 * @param deps    额外依赖:变化后当前 slot 视为过期,重新拉第一页。
 */
export function useFeed<T extends { id: string }>(
  slotKey: string,
  fetcher: (cursor: string | null) => Promise<FeedResp<T>>,
  deps: readonly unknown[] = [],
): UseFeedResult<T> {
  const [slots, setSlots] = useState<Record<string, FeedSlot<T>>>({});
  const [phase, setPhase] = useState<FeedLoadPhase>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  /** 每次发起请求自增;回包时序号不是最新就丢弃(竞态保护)。 */
  const generationRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const writeSlot = useCallback(
    (key: string, updater: (previous: FeedSlot<T>) => FeedSlot<T>) => {
      setSlots((current) => {
        const previous = current[key] ?? emptySlot<T>();
        return { ...current, [key]: updater(previous) };
      });
    },
    [],
  );

  const load = useCallback(
    async (mode: 'refresh' | 'more', targetSlot: string) => {
      const current = slotsRef.current[targetSlot] ?? emptySlot<T>();
      if (mode === 'more' && (!current.hasMore || !current.nextCursor)) return;
      const generation = ++generationRef.current;
      setPhase(mode === 'refresh' ? (current.items.length ? 'refreshing' : 'loading') : 'loadingMore');
      try {
        const resp = await fetcherRef.current(mode === 'refresh' ? null : current.nextCursor);
        if (generation !== generationRef.current) return;
        const fresh = Array.isArray(resp?.records) ? resp.records : [];
        writeSlot(targetSlot, (previous) => {
          const base = mode === 'refresh' ? [] : previous.items;
          const seen = new Set(base.map((item) => item.id));
          const merged = base.slice();
          for (const item of fresh) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
          }
          return {
            items: merged,
            nextCursor: resp?.nextCursor ?? null,
            hasMore: Boolean(resp?.hasMore),
            loadedOnce: true,
          };
        });
        setError(null);
        setPhase('idle');
      } catch (caught) {
        if (generation !== generationRef.current) return;
        const apiError = toApiError(caught);
        if (apiError.bizCode === 'ABORTED') {
          setPhase('idle');
          return;
        }
        // 失败保留已有数据(spec: 失败重试保留数据)。
        setError(apiError);
        setPhase('error');
      }
    },
    [writeSlot],
  );

  const refresh = useCallback(() => load('refresh', slotKey), [load, slotKey]);
  const loadMore = useCallback(() => load('more', slotKey), [load, slotKey]);

  // slot 变化或依赖变化:没加载过就拉第一页。
  useEffect(() => {
    const current = slotsRef.current[slotKey];
    if (!current?.loadedOnce) void load('refresh', slotKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey, ...deps]);

  const patchItem = useCallback(
    (id: string, patch: Partial<T>) => {
      writeSlot(slotKey, (previous) => ({
        ...previous,
        items: previous.items.map((item) =>
          item.id === id ? ({ ...item, ...patch } as T) : item,
        ),
      }));
    },
    [slotKey, writeSlot],
  );

  const slot = slots[slotKey] ?? emptySlot<T>();

  return useMemo(
    () => ({
      items: slot.items,
      phase,
      error,
      hasMore: slot.hasMore,
      loadedOnce: slot.loadedOnce,
      isEmpty: slot.loadedOnce && slot.items.length === 0,
      showSkeleton: !slot.loadedOnce && phase !== 'error',
      refresh,
      loadMore,
      patchItem,
    }),
    [slot, phase, error, refresh, loadMore, patchItem],
  );
}
