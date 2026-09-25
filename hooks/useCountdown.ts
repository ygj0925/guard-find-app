/**
 * 秒级倒计时(验证码重发、限流等待共用)。
 *
 * 单独成 hook 的原因:spec 4.5 要求"倒计时期间重复点击不发起请求"可测 ——
 * 规则只有一条:`running` 为真时 `start()` 之外的入口都该被调用方禁用。
 */
import { useCallback, useEffect, useState } from 'react';

export interface CountdownApi {
  secondsLeft: number;
  running: boolean;
  /** 开始/覆盖倒计时;<=0 视为立即结束。 */
  start: (seconds: number) => void;
  stop: () => void;
}

export function useCountdown(initial = 0): CountdownApi {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor(initial)));
  const running = secondsLeft > 0;

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const start = useCallback((seconds: number) => {
    setSecondsLeft(Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0)));
  }, []);

  const stop = useCallback(() => setSecondsLeft(0), []);

  return { secondsLeft, running, start, stop };
}

/**
 * 重发冷却秒数。
 * 契约 1.1 的 `expireSeconds` 是"验证码有效期"(默认 300),
 * 而重发限流是"同号 1/分",所以取两者较小值:既不信口开河 60 秒,
 * 也不会让用户等到验证码过期还不能重发。
 */
export function resendCooldownSeconds(
  expireSeconds: number | null | undefined,
  limitSeconds = 60,
): number {
  const raw = typeof expireSeconds === 'number' && expireSeconds > 0 ? expireSeconds : limitSeconds;
  return Math.min(limitSeconds, Math.max(1, Math.floor(raw)));
}
