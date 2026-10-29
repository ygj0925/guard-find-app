/**
 * 圆形扩散转场:点击处圆形扩散铺满全屏后跳转。
 * 实现:透明 Modal + Reanimated 圆形遮罩,动画中段执行路由跳转,结束后收起。
 * 纯 JS 动画(Reanimated 已通过 RNOH 验证),无新增原生依赖;鸿蒙可用。
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DURATION, timing } from '@/constants/Motion';

interface RevealState {
  x: number;
  y: number;
  color: string;
  href: string;
}

/** 覆盖全屏所需的最大半径(到四角最远距离 × 1.15 余量)。 */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  const corners = [
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y),
  ];
  return Math.ceil(Math.max(...corners) * 1.15);
}

export function useCircularReveal(router: { push: (href: never) => void }) {
  const { width, height } = useWindowDimensions();
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const radius = useSharedValue(0);

  const finish = useCallback(
    (href: string) => {
      router.push(href as never);
      // 跳转渲染完成后收起遮罩
      setTimeout(() => setReveal(null), 120);
    },
    [router],
  );

  /**
   * 在(x, y)触发圆形扩散转场到 href;onSettled 可选在跳转前做额外动作。
   */
  const revealPush = useCallback(
    (href: string, x: number, y: number, color: string) => {
      // 以下 SharedValue 赋值为 Reanimated 官方写法(immutability 规则误报,逐行豁免)
      // eslint-disable-next-line react-hooks/immutability
      radius.value = 0;
      setReveal({ x, y, color, href });
      radius.value = withTiming(revealRadius(x, y, width, height), timing(DURATION.reveal), (finished) => {
        if (finished) runOnJS(finish)(href);
      });
    },
    [finish, height, radius, width],
  );

  const overlayStyle = useAnimatedStyle(() => ({
    width: radius.value * 2,
    height: radius.value * 2,
    borderRadius: radius.value,
  }));

  const overlay = reveal ? (
    <Modal transparent visible onRequestClose={() => setReveal(null)} pointerEvents="none">
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            overlayStyle,
            {
              position: 'absolute',
              left: reveal.x,
              top: reveal.y,
              marginLeft: -reveal.x,
              marginTop: -reveal.y,
              backgroundColor: reveal.color,
            },
          ]}
        />
      </View>
      {/* 覆盖层兜底:转场期间吞掉点击,防连点 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => undefined} />
    </Modal>
  ) : null;

  return { revealPush, overlay };
}
