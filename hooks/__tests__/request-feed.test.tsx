import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useRequest } from '../useRequest';
import { useFeed } from '../useFeed';
import type { FeedResp } from '@/lib/api/endpoints/common';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// @testing-library/react-native 14 要求 React 19;项目在 React 18,直接用 react-test-renderer
async function renderHook<P, R>(hook: (props: P) => R, options: { initialProps?: P } = {}) {
  const result = { current: undefined as unknown as R };
  function Probe({ hookProps }: { hookProps: P }) {
    result.current = hook(hookProps);
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Probe hookProps={options.initialProps as P} />);
  });
  const rerender = (props: P) =>
    act(async () => {
      renderer.update(<Probe hookProps={props} />);
    });
  return { result, rerender };
}

async function waitFor(assertion: () => void, timeoutMs = 1000) {
  const started = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - started > timeoutMs) throw error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }
  }
}

function page(ids: string[], hasMore: boolean, nextCursor: string | null = null): FeedResp<{ id: string }> {
  return { records: ids.map((id) => ({ id })), hasMore, nextCursor } as FeedResp<{ id: string }>;
}

describe('useRequest 竞态丢弃', () => {
  it('先发的请求后回包时不覆盖后发请求的结果', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const calls = [first, second];
    let index = 0;
    const { result, rerender } = await renderHook(({ city }: { city: string }) =>
      useRequest(() => calls[index++].promise, [city]),
    { initialProps: { city: 'A' } });

    await waitFor(() => expect(index).toBe(1));
    await rerender({ city: 'B' });
    await waitFor(() => expect(index).toBe(2));

    await act(async () => {
      second.resolve('B');
    });
    await act(async () => {
      first.resolve('A');
    });
    expect(result.current.data).toBe('B');
    expect(result.current.status).toBe('success');
  });

  it('失败时默认保留上一份数据', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce('ok').mockRejectedValueOnce(new Error('boom'));
    const { result } = await renderHook(() => useRequest(fetcher, []));
    await waitFor(() => expect(result.current.data).toBe('ok'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.data).toBe('ok');
  });
});

describe('useFeed 游标分页', () => {
  it('重复返回的条目按 id 去重,hasMore=false 后不再请求', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(page(['1', '2'], true, 'c1'))
      .mockResolvedValueOnce(page(['2', '3'], false));
    const { result } = await renderHook(() => useFeed('latest', fetcher));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['1', '2', '3']);
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('c1');
  });

  it('切走再切回不重新拉第一页,各 slot 保留自己的数据', async () => {
    let calls = 0;
    const fetcher = jest.fn((cursor: string | null): Promise<FeedResp<{ id: string }>> => {
      calls += 1;
      return Promise.resolve(page([`${calls}-${cursor ?? 'first'}`], false));
    });
    const { result, rerender } = await renderHook(({ slot }: { slot: string }) => useFeed(slot, fetcher), {
      initialProps: { slot: 'latest|all|' },
    });
    await waitFor(() => expect(result.current.loadedOnce).toBe(true));
    const latestItems = result.current.items;

    await rerender({ slot: 'urgent|all|' });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loadedOnce).toBe(true));

    await rerender({ slot: 'latest|all|' });
    await waitFor(() => expect(result.current.items).toEqual(latestItems));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('加载更多失败时保留已加载的数据并暴露错误', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(page(['1'], true, 'c1'))
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useFeed('latest', fetcher));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.error).not.toBeNull();
    expect(result.current.items.map((item) => item.id)).toEqual(['1']);
  });
});
