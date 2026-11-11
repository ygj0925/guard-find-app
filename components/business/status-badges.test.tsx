import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { useElapsedHours } from './status-badges';
import { formatMissingHours } from '@/lib/format';

jest.mock('@/components/ui/badge', () => ({ Badge: () => null }));
jest.mock('@/components/ui/text', () => ({ Text: () => null }));

function Probe({ hours }: { hours: number | null | undefined }) {
  const elapsed = useElapsedHours(hours);
  return (
    <View
      accessibilityValue={{ text: String(elapsed) }}
      accessibilityLabel={formatMissingHours(elapsed)}
    />
  );
}

describe('失踪时长可空契约', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  it.each([null, undefined])('未知时长 %s 不变成一小时且不创建定时器', (hours) => {
    act(() => { renderer = TestRenderer.create(<Probe hours={hours} />); });
    expect(renderer.root.findByType(View).props.accessibilityValue.text).toBe('null');
    expect(renderer.root.findByType(View).props.accessibilityLabel).toBe('时长未知');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('已知时长继续推进,变为未知时停止计时并显示未知', () => {
    act(() => { renderer = TestRenderer.create(<Probe hours={1.999} />); });
    expect(renderer.root.findByType(View).props.accessibilityValue.text).toBe('1');
    act(() => jest.advanceTimersByTime(30000));
    expect(renderer.root.findByType(View).props.accessibilityValue.text).toBe('2');
    act(() => renderer.update(<Probe hours={null} />));
    expect(renderer.root.findByType(View).props.accessibilityValue.text).toBe('null');
    expect(renderer.root.findByType(View).props.accessibilityLabel).toBe('时长未知');
    expect(jest.getTimerCount()).toBe(0);
  });
});
