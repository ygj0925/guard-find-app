/**
 * 通用请求封装(spec 2.8 / D2:自建 useRequest,一期不引 react-query)。
 *
 * 只解决四件事:加载态、错误态、重试、竞态丢弃。
 * 竞态丢弃是硬需求 —— "200ms 内先后切到城市 A 再切到 B,而 A 后到"时界面只能显示 B。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/error';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseRequestState<T> {
  data: T | null;
  error: ApiError | null;
  status: RequestStatus;
  /** 首次加载才显示骨架屏;刷新时保留旧数据。 */
  isInitialLoading: boolean;
  reload: () => Promise<T | null>;
  /** 手动覆盖数据(乐观更新用)。 */
  setData: (next: T | null) => void;
}

export interface UseRequestOptions<T> {
  /** false 时不自动发起,等 reload()。 */
  enabled?: boolean;
  /** 失败时保留上一版数据(列表页要求)。默认 true。 */
  keepDataOnError?: boolean;
  /**
   * 数据落地回调:只在竞态校验通过、这一份响应确实被采纳之后调用一次。
   *
   * 需要"把分页结果并入本地列表""用服务端数据重置本地副本"的页面写在这里:
   * 它发生在异步续体里,而不是 effect 同步体,不会造成级联渲染。
   */
  onData?: (data: T) => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof ApiError && error.bizCode === 'ABORTED';
}

/**
 * @param fetcher 依赖被 `deps` 描述;每次 deps 变化都会重发并丢弃旧响应。
 */
export function useRequest<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  options: UseRequestOptions<T> = {},
): UseRequestState<T> {
  const { enabled = true, keepDataOnError = true, onData } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const latestRef = useRef(0);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  /** 数据落地回调:每次提交后刷新成最新闭包,回包时读到的 page 等依赖与本次请求一致。 */
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (): Promise<T | null> => {
    const token = latestRef.current + 1;
    latestRef.current = token;
    setStatus((current) => (current === 'idle' ? 'loading' : current));
    try {
      const value = await fetcherRef.current();
      // 后到的旧响应直接丢,不写 state。
      if (!mountedRef.current || latestRef.current !== token) return null;
      setData(value);
      setError(null);
      setStatus('success');
      // 竞态校验通过才通知调用方:这里是异步续体,调用方的 setState 不会落在 effect 同步体里。
      onDataRef.current?.(value);
      return value;
    } catch (caught) {
      if (!mountedRef.current || latestRef.current !== token) return null;
      if (isAbortError(caught)) return null;
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError({
              code: -1,
              msg: caught instanceof Error ? caught.message : '请求失败,请稍后重试',
              bizCode: 'NETWORK',
              cause: caught,
            });
      setError(apiError);
      setStatus('error');
      if (!keepDataOnError) setData(null);
      return null;
    }
  }, [keepDataOnError]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    void run();
    // deps 由调用方声明;run 自身稳定,不该进依赖数组。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return {
    data,
    error,
    status,
    isInitialLoading: status === 'loading' && data === null,
    reload: run,
    setData,
  };
}
