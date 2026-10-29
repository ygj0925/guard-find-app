/**
 * 按压缩放反馈(触感反馈):按下 spring 缩到 0.97,松手回弹。
 * 全应用卡片的统一触感;Reanimated 驱动(鸿蒙已验证),不引新依赖。
 */
import React, { useCallback } from 'react';
import { Pressable, PressableProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { cssInterop } from 'nativewind';

import { SPRING } from '@/constants/Motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// NativeWind 只给核心组件注册了 className→style,createAnimatedComponent 产出的是新组件对象,
// 不注册则 className 会被当成未知 prop 丢掉(缩放节点上的 mb-2 / w-[47%] 全部失效)。
cssInterop(AnimatedPressable, { className: 'style' });

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  /** 按下缩放幅度(默认 0.97,skill 触感反馈规范值)。 */
  scaleTo?: number;
  className?: string;
  style?: ViewStyle;
}

export function PressableScale({ children, scaleTo = 0.97, className, style, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue 官方写法
    scale.value = withSpring(scaleTo, SPRING.tap);
  }, [scale, scaleTo]);

  const onPressOut = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue 官方写法
    scale.value = withSpring(1, SPRING.release);
  }, [scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      className={className}
      style={[style, animated]}
      onPressIn={(event) => {
        onPressIn();
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        onPressOut();
        rest.onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
