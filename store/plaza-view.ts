/**
 * 广场视图态(zustand + 本地持久化)。
 *
 * 一期没有定位权限(spec 硬约束),"就近"流的城市完全来自:
 *   用户常驻地(AppUser.provinceCode/cityCode)-> 手选城市 -> 都没有则弹城市选择器。
 * 城市与筛选条件是跨页面共享的(搜索页复用),所以不放组件 state。
 */
import { create } from 'zustand';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';
import type { PlazaSort } from '@/lib/api/endpoints/plaza';
import { useSession } from './session';

const PLAZA_KEY = 'guardfind.plaza-view.v1';

export interface PlazaFilterSelection {
  gender?: string;
  ageGroup?: string;
  caseType?: string;
  bloodSampleStatus?: string;
  yearFrom?: number;
  yearTo?: number;
}

export interface CitySelection {
  provinceCode: string | null;
  cityCode: string | null;
  cityLabel: string;
}

interface PlazaState {
  hydrated: boolean;
  sort: PlazaSort;
  /** 用户手选城市;null 表示"用常驻地"。 */
  city: CitySelection | null;
  filters: PlazaFilterSelection;
  hydrate: () => Promise<void>;
  setSort: (sort: PlazaSort) => void;
  setCity: (city: CitySelection | null) => void;
  setFilters: (filters: PlazaFilterSelection) => void;
  resetFilters: () => void;
  /** 就近流的实际城市:手选优先,其次常驻地。 */
  effectiveCity: () => CitySelection | null;
  /** 信息流 slot 身份:切流/切城市/改筛选都会新开 slot,互不覆盖。 */
  slotKey: () => string;
}

function snapshot(state: PlazaState) {
  return { sort: state.sort, city: state.city, filters: state.filters };
}

async function persist(next: ReturnType<typeof snapshot>): Promise<void> {
  await kvSetJson(PLAZA_KEY, next);
}

export const usePlazaView = create<PlazaState>((set, get) => ({
  hydrated: false,
  sort: 'latest',
  city: null,
  filters: {},

  async hydrate() {
    if (get().hydrated) return;
    const stored = await kvGetJson<Partial<ReturnType<typeof snapshot>>>(PLAZA_KEY, {});
    set({
      hydrated: true,
      sort: stored?.sort ?? 'latest',
      city: stored?.city ?? null,
      filters: stored?.filters ?? {},
    });
  },

  setSort(sort) {
    set({ sort });
    void persist(snapshot(get()));
  },

  setCity(city) {
    set({ city });
    void persist(snapshot(get()));
  },

  setFilters(filters) {
    set({ filters });
    void persist(snapshot(get()));
  },

  resetFilters() {
    set({ filters: {} });
    void persist(snapshot(get()));
  },

  effectiveCity() {
    const { city } = get();
    if (city && city.cityCode) return city;
    const user = useSession.getState().user;
    if (user?.cityCode) {
      return {
        provinceCode: user.provinceCode,
        cityCode: user.cityCode,
        cityLabel: user.cityCode,
      };
    }
    return null;
  },

  slotKey() {
    const { sort, filters } = get();
    const city = sort === 'nearby' ? get().effectiveCity()?.cityCode ?? 'all' : 'all';
    return buildSlotKey(sort, city === 'all' ? null : city, filters);
  },
}));

/**
 * 信息流 slot 身份的纯函数版。
 *
 * 组件里 MUST NOT 用 `usePlazaView((s) => s.slotKey())` 这类返回新对象的 selector:
 * zustand v5 依赖 Object.is 判定快照,函数每次返回新值会触发
 * "getSnapshot should be cached" 的无限渲染。这里给组件用 useMemo 调。
 */
export function buildSlotKey(
  sort: PlazaSort,
  cityCode: string | null | undefined,
  filters: PlazaFilterSelection,
): string {
  const flat = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
  return `${sort}|${cityCode || 'all'}|${flat}`;
}

/** 就近流的实际城市:手选优先,其次常驻地。纯函数,供组件用 useMemo 调。 */
export function resolveCity(
  handPicked: CitySelection | null,
  user: { provinceCode: string | null; cityCode: string | null } | null,
): CitySelection | null {
  if (handPicked?.cityCode) return handPicked;
  if (user?.cityCode) {
    return { provinceCode: user.provinceCode, cityCode: user.cityCode, cityLabel: user.cityCode };
  }
  return null;
}
