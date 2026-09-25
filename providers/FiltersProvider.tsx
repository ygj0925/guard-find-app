/**
 * 字典与区划提供者。
 *
 * 契约要求"选项一律由 GET /app/plaza/filters 提供,前端不硬编码",
 * 所以任何下拉/单选面板都从这里取;拉不到时展示错误态而不是退回内置枚举。
 * 进程内缓存一次即可(区划与字典一天内不会变)。
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { plazaApi, type PlazaFilters } from '@/lib/api/endpoints/plaza';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';
import type { Option, RegionNode } from '@/lib/api/endpoints/common';
import { toUserMessage } from '@/lib/api/error';

const FILTERS_KEY = 'guardfind.plaza-filters.v1';

interface FiltersApi {
  filters: PlazaFilters | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** 按字典 code 取选项;取不到返回空数组,调用方据此禁用面板。 */
  optionsOf: (key: keyof PlazaFilters) => Option[];
  /** 区划码 -> 名称,用于把 provinceCode/cityCode 显示成文字。 */
  regionLabel: (code: string | null | undefined) => string;
}

const EMPTY: PlazaFilters = {
  regions: [],
  caseTypes: [],
  ageGroups: [],
  bloodSampleStatuses: [],
  genders: [],
  relations: [],
  urgencyLevels: [],
};

const FiltersContext = createContext<FiltersApi>({
  filters: null,
  loading: true,
  error: null,
  reload: async () => undefined,
  optionsOf: () => [],
  regionLabel: () => '',
});

export function useFilters(): FiltersApi {
  return useContext(FiltersContext);
}

function indexRegions(nodes: RegionNode[], map: Map<string, string>): void {
  for (const node of nodes) {
    map.set(node.code, node.name);
    if (node.children?.length) indexRegions(node.children, map);
  }
}

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<PlazaFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      if (force) {
        const fresh = await plazaApi.filters();
        setFilters(fresh ?? EMPTY);
        void kvSetJson(FILTERS_KEY, fresh);
        return;
      }
      // 先用本地缓存渲染,再后台刷新:首屏不该被一个字典请求挡住。
      const cached = await kvGetJson<PlazaFilters | null>(FILTERS_KEY, null);
      if (cached?.regions) setFilters(cached);
      const fresh = await plazaApi.filters();
      if (fresh) {
        setFilters(fresh);
        void kvSetJson(FILTERS_KEY, fresh);
      } else if (!cached) {
        setFilters(EMPTY);
      }
    } catch (caught) {
      setError(toUserMessage(caught));
      const cached = await kvGetJson<PlazaFilters | null>(FILTERS_KEY, null);
      if (cached?.regions) setFilters(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const regionIndex = useMemo(() => {
    const map = new Map<string, string>();
    indexRegions(filters?.regions ?? [], map);
    return map;
  }, [filters]);

  const value = useMemo<FiltersApi>(
    () => ({
      filters,
      loading,
      error,
      reload: () => load(true),
      optionsOf: (key) => {
        if (key === 'regions') return [];
        return filters?.[key] ?? [];
      },
      regionLabel: (code) => (code ? regionIndex.get(code) ?? code : ''),
    }),
    [filters, loading, error, load, regionIndex],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}
