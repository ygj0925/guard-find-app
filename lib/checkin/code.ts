/**
 * 签到动态码(与服务端 CheckinCodeGenerator 同一算法/同一测试向量)。
 *
 * FNV-1a 32 位哈希,输入 = secret + ':' + 时间窗序号(30 秒一格),输出 6 位数字码。
 * 防代签核心:码每 30 秒轮换且只在发起人屏幕展示,拿到截图/旧码也会过期。
 */
export const CHECKIN_WINDOW_SECONDS = 30;

/** 生成某时间窗的 6 位数字码(与服务端逐字符一致)。 */
export function checkinCode(secret: string, windowIndex: number): string {
  const input = `${secret}:${windowIndex}`;
  // FNV-1a 32 位;Math.imul 保证 32 位溢出语义与 Java int 一致
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= byte & 0xff;
    hash = Math.imul(hash, 16777619);
  }
  const positive = hash & 0x7fffffff;
  return String(positive % 1_000_000).padStart(6, '0');
}

/** 当前时间窗序号。 */
export function checkinWindowIndex(epochSeconds: number): number {
  return Math.floor(epochSeconds / CHECKIN_WINDOW_SECONDS);
}

/** 当前应显示的码。 */
export function currentCheckinCode(secret: string, now: Date = new Date()): string {
  return checkinCode(secret, checkinWindowIndex(Math.floor(now.getTime() / 1000)));
}

/** 距下一个时间窗的秒数(用于倒计时刷新展示)。 */
export function secondsToNextWindow(now: Date = new Date()): number {
  return CHECKIN_WINDOW_SECONDS - (Math.floor(now.getTime() / 1000) % CHECKIN_WINDOW_SECONDS);
}
