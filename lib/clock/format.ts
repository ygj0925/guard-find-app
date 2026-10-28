/**
 * 时钟/秒表/计时器纯函数。展示层格式化与时长运算,不碰任何副作用。
 */

/** 毫秒 -> `mm:ss.cs`(秒表);超 1 小时进位为 `h:mm:ss.cs`。 */
export function formatStopwatch(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00.00';
  const total = Math.floor(ms / 10); // 厘秒
  const cs = total % 100;
  const totalSeconds = Math.floor(total / 100);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  const core = `${pad(m)}:${pad(s)}.${pad(cs)}`;
  return h > 0 ? `${h}:${core}` : core;
}

/** 秒 -> `mm:ss` / `h:mm:ss`(计时器倒计时展示)。 */
export function formatCountdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '00:00';
  const s = Math.floor(totalSeconds) % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 数字时钟表盘三根指针的角度(0-360,0°=12 点方向)。 */
export function clockHands(date: Date): { hour: number; minute: number; second: number } {
  const second = date.getSeconds() * 6;
  const minute = date.getMinutes() * 6 + date.getSeconds() * 0.1;
  const hour = (date.getHours() % 12) * 30 + date.getMinutes() * 0.5;
  return { hour, minute, second };
}

/** 计次列表:每个计次点的分段时间与累计时间(毫秒)。 */
export interface LapEntry {
  index: number;
  lapTime: number;
  totalTime: number;
}

export function buildLaps(cumulativeTimes: number[]): LapEntry[] {
  return cumulativeTimes.map((total, index) => ({
    index: index + 1,
    totalTime: total,
    lapTime: total - (cumulativeTimes[index - 1] ?? 0),
  }));
}
