/**
 * lib/clock/format 与 lib/calc/calculator 单测。
 */
import { appendDigit, applyOperation, formatDisplay } from '../../calc/calculator';
import { buildLaps, clockHands, formatCountdown, formatStopwatch } from '../../clock/format';

describe('formatStopwatch', () => {
  it('分:秒.厘秒', () => {
    expect(formatStopwatch(0)).toBe('00:00.00');
    expect(formatStopwatch(61_230)).toBe('01:01.23');
  });
  it('超一小时进位', () => {
    expect(formatStopwatch(3_661_000)).toBe('1:01:01.00');
    expect(formatStopwatch(-5)).toBe('00:00.00');
  });
});

describe('formatCountdown / clockHands', () => {
  it('倒计时 mm:ss 与 h:mm:ss', () => {
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(3_600)).toBe('1:00:00');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('指针角度:3 点整 = 90°,秒针 30 秒 = 180°', () => {
    const hands = clockHands(new Date(2026, 9, 29, 15, 0, 30));
    expect(hands.hour).toBeCloseTo(90, 6);
    expect(hands.minute).toBeCloseTo(3, 6);
    expect(hands.second).toBeCloseTo(180, 6);
  });

  it('计次:分段时间 = 累计差', () => {
    const laps = buildLaps([10_000, 25_000, 30_000]);
    expect(laps[0].lapTime).toBe(10_000);
    expect(laps[1].lapTime).toBe(15_000);
    expect(laps[2].lapTime).toBe(5_000);
    expect(laps[2].totalTime).toBe(30_000);
  });
});

describe('calculator', () => {
  it('四则运算,除零返回 null', () => {
    expect(applyOperation(6, 3, '+')).toBe(9);
    expect(applyOperation(6, 3, '×')).toBe(18);
    expect(applyOperation(6, 0, '÷')).toBeNull();
  });

  it('显示去尾噪:0.1+0.2 = 0.3', () => {
    expect(formatDisplay(0.1 + 0.2)).toBe('0.3');
    expect(formatDisplay(Number.NaN)).toBe('错误');
  });

  it('输入追加:小数点唯一,前导零规整,超长截断', () => {
    expect(appendDigit('0', '5')).toBe('5');
    expect(appendDigit('', '.')).toBe('0.');
    expect(appendDigit('1.2', '.')).toBe('1.2');
    expect(appendDigit('123456789012', '7')).toBe('123456789012');
  });
});
