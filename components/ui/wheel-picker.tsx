/**
 * 惯性滚轮选择器:垂直滚动 + 吸附刻度 + 惯性减速。
 * 用 ScrollView 的 snapToInterval + decelerationRate="fast" 实现,
 * 纯核心组件,鸿蒙可用;onChange 在惯性停止后回调选中值。
 */
import React, { useEffect, useRef } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, Pressable, ScrollView, Text, View } from 'react-native';

export interface WheelPickerProps {
  /** 选项(值 + 文案)。 */
  items: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  /** 单项高度(px)。 */
  itemHeight?: number;
  /** 可视区高度(建议 = itemHeight × 奇数)。 */
  height?: number;
  width?: number | `${number}%`;
}

export function WheelPicker({ items, value, onChange, itemHeight = 40, height = 160, width = '100%' }: WheelPickerProps) {
  const padding = (height - itemHeight) / 2;
  const scrollingRef = useRef(false);

  // 外部 value 变化(如切换预设)时滚到对应项
  useEffect(() => {
    if (scrollingRef.current) return;
    const index = items.findIndex((item) => item.value === value);
    if (index >= 0) {
      ref.current?.scrollTo({ y: index * itemHeight, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const ref = useRef<ScrollView>(null);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollingRef.current = true;
    const index = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
    const item = items[Math.min(items.length - 1, Math.max(0, index))];
    if (item && item.value !== value) onChange(item.value);
  };

  return (
    <View style={{ height, width, overflow: 'hidden' }}>
      {/* 中心高亮带 */}
      <View
        style={{
          position: 'absolute',
          top: padding,
          height: itemHeight,
          left: 8,
          right: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: 'rgba(128,128,128,0.25)',
        }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        nestedScrollEnabled
        onScrollBeginDrag={() => {
          scrollingRef.current = true;
        }}
        onScroll={onScroll}
        onMomentumScrollBegin={() => {
          scrollingRef.current = true;
        }}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollingRef.current = false;
          const index = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
          const item = items[Math.min(items.length - 1, Math.max(0, index))];
          if (item && item.value !== value) onChange(item.value);
        }}
        contentContainerStyle={{ paddingVertical: padding }}
      >
        {items.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => {
              const index = items.findIndex((option) => option.value === item.value);
              ref.current?.scrollTo({ y: index * itemHeight, animated: true });
              onChange(item.value);
            }}
            style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontSize: item.value === value ? 18 : 15, fontWeight: item.value === value ? '700' : '400' }}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
