/**
 * 会话提供者:冷启动恢复 -> 401 回跳 -> 登录后恢复目标与动作 -> 实时通道开关。
 *
 * 守卫规则(spec: 会话恢复与路由守卫):
 *   - 广场与档案详情允许未登录浏览;
 *   - 发布 / 线索 / 收藏 / 消息属写操作,未登录时记录回跳目标并跳登录,
 *     登录成功后既回到目标页,也补做被拦下的那一次动作(如"点收藏")。
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useSession } from '@/store/session';
import { requireLogin, takePendingAction } from '@/lib/nav';
import { startRealtime, stopRealtime } from '@/lib/realtime';
import { capture, setMonitorRoute } from '@/lib/monitor';

interface SessionApi {
  /** 冷启动是否已完成:完成前不渲染业务页,避免闪一下登录页。 */
  ready: boolean;
  signedIn: boolean;
  /** 未登录则记录目标并跳登录,返回 true 表示调用方应中止本次动作。 */
  guard: (action: { href?: string | null; run?: string; label?: string }) => boolean;
  /** 登录后待补做的动作 id(消费后自动清空)。 */
  takePendingRun: () => string | null;
}

const SessionContext = createContext<SessionApi>({
  ready: false,
  signedIn: false,
  guard: () => false,
  takePendingRun: () => null,
});

export function useSessionGuard(): SessionApi {
  return useContext(SessionContext);
}

/** 收藏等"登录后自动补做"的动作约定:`favorite:<caseId>`。 */
export function favoriteRunId(caseId: string): string {
  return `favorite:${caseId}`;
}

/** 最后一次可见的路径,401 回来时用它当回跳目标。 */
let lastHref = '/(tabs)/plaza';

export function currentHref(): string {
  return lastHref;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const phase = useSession((state) => state.phase);
  const token = useSession((state) => state.token);
  const unauthorized = useSession((state) => state.unauthorized);
  const restore = useSession((state) => state.restore);
  const clearUnauthorized = useSession((state) => state.clearUnauthorized);
  const [ready, setReady] = useState(false);
  const [pendingRun, setPendingRun] = useState<string | null>(null);

  useEffect(() => {
    lastHref = pathname || lastHref;
    setMonitorRoute(pathname || '/');
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await restore();
      } catch (error) {
        capture('ERROR', '会话恢复异常,按未登录处理', {
          detail: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restore]);

  // 401 由 client.ts 全局只触发一次,这里把它变成一次导航。
  useEffect(() => {
    if (!unauthorized) return;
    const target = unauthorized.fromPath ?? lastHref;
    clearUnauthorized();
    void requireLogin({ href: target, from: 'unauthorized' });
    router.replace(`/auth/login?redirect=${encodeURIComponent(target)}` as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unauthorized]);

  useEffect(() => {
    if (phase === 'authenticated' && token) startRealtime();
    else stopRealtime();
  }, [phase, token]);

  useEffect(() => () => stopRealtime(), []);

  // 登录后恢复回跳目标,并把被拦下的动作交给页面消费一次。
  // 导航统一在这里做:登录页只负责写 pending action + 发请求,避免两处各推一次栈。
  useEffect(() => {
    if (phase !== 'authenticated' || !ready) return;
    let cancelled = false;
    void (async () => {
      const pending = await takePendingAction();
      if (cancelled || !pending) return;
      if (pending.run) setPendingRun(pending.run);
      const target = pending.href && pending.href !== '/' ? pending.href : null;
      // 登录页是 modal:先收回模态再落到目标,否则目标页会压在登录页之上。
      if (target && target !== lastHref) {
        router.dismissTo(target as never);
      } else {
        router.dismissAll();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready]);

  const guard = useCallback<SessionApi['guard']>(
    (action) => {
      const state = useSession.getState();
      if (state.phase === 'authenticated' && state.token) return false;
      const target = action.href ?? lastHref;
      void requireLogin({ href: target, run: action.run, from: action.label ?? 'guard' });
      router.push(`/auth/login?redirect=${encodeURIComponent(target)}` as never);
      return true;
    },
    [router],
  );

  const takePendingRun = useCallback(() => {
    const run = pendingRun;
    if (run) setPendingRun(null);
    return run;
  }, [pendingRun]);

  const value = useMemo<SessionApi>(
    () => ({ ready, signedIn: phase === 'authenticated', guard, takePendingRun }),
    [ready, phase, guard, takePendingRun],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
