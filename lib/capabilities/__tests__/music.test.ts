/**
 * lib/capabilities/music 纯函数单测(不测 Web Audio 本体,只测列表/格式化逻辑)。
 */
import {
  formatTrackTime,
  nextIndex,
  prevIndex,
  ratioToSeconds,
  trackDisplayName,
} from '../music';

describe('playlist 索引(循环)', () => {
  it('next:末尾回 0', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('prev:开头回末尾', () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(1, 3)).toBe(0);
  });

  it('空列表返回 -1', () => {
    expect(nextIndex(0, 0)).toBe(-1);
    expect(prevIndex(0, 0)).toBe(-1);
  });
});

describe('formatTrackTime', () => {
  it('秒 -> m:ss', () => {
    expect(formatTrackTime(0)).toBe('0:00');
    expect(formatTrackTime(65)).toBe('1:05');
    expect(formatTrackTime(-3)).toBe('0:00');
  });
});

describe('ratioToSeconds', () => {
  it('比例换算并封顶', () => {
    expect(ratioToSeconds(0.5, 100)).toBe(50);
    expect(ratioToSeconds(1.5, 100)).toBe(100);
    expect(ratioToSeconds(0.5, 0)).toBe(0);
    expect(ratioToSeconds(Number.NaN, 100)).toBe(0);
  });
});

describe('trackDisplayName', () => {
  it('去路径与扩展名', () => {
    expect(trackDisplayName('/storage/music/晴天.mp3')).toBe('晴天');
    expect(trackDisplayName('C:\\Music\\song.flac')).toBe('song');
    expect(trackDisplayName('no-ext')).toBe('no-ext');
  });
});
