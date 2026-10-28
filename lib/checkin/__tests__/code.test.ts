/**
 * 签到动态码与服务端 CheckinCodeGenerator 的互验测试:
 * 测试向量必须与 Java 侧 CheckinCodeGeneratorTest 完全一致,两端算法漂移即 CI 失败。
 */
import { checkinCode, currentCheckinCode, secondsToNextWindow } from '../code';

// 与 Java 侧共享的测试向量(abc123 @ 窗 59000000 = 368779)
const VECTOR_SECRET = 'abc123';
const VECTOR_WINDOW = 59_000_000;
const VECTOR_EXPECTED = '368779';

describe('checkinCode(与服务端互验)', () => {
  it('测试向量:与服务端约定值一致', () => {
    expect(checkinCode(VECTOR_SECRET, VECTOR_WINDOW)).toBe(VECTOR_EXPECTED);
  });

  it('码为 6 位数字,不同窗轮换', () => {
    expect(checkinCode('abc123', 2_000_000)).toMatch(/^\d{6}$/);
    expect(checkinCode('abc123', 2_000_000)).not.toBe(checkinCode('abc123', 2_000_001));
  });

  it('currentCheckinCode 按当前时间取窗', () => {
    const fixed = new Date(1_800_000_000_000); // 窗 60000000
    expect(currentCheckinCode('s1', fixed)).toBe('091503');
  });

  it('secondsToNextWindow:30 秒一格', () => {
    expect(secondsToNextWindow(new Date(60_000_000_000))).toBe(30);
    expect(secondsToNextWindow(new Date(60_000_015_000))).toBe(15);
  });
});
