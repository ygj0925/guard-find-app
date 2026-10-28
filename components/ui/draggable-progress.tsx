/**
 * 可拖拽进度条(吸附卡+画线):拖动时圆点与填充线跟随手指(画线),
 * 松手吸附到目标位置并回调(吸附)。纯 Reanimated + 手势,鸿蒙可用。
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface DraggableProgressProps {
  /** 进度 0-1(受控)。 */
  progress: number;
  /** 拖动中持续回调(0-1,用于实时画线/时间预览)。 */
  onDrag?: (ratio: number) => void;
  /** 松手吸附后回调(0-1)。 */
  onSeek: (ratio: number) => void;
  height?: number;
  /** 填充线/圆点颜色。 */
  activeColor: string;
  /** 轨道颜色。 */
  trackColor: string;
  disabled?: boolean;
}

export function DraggableProgress({
  progress,
  onDrag,
  onSeek,
  height = 8,
  activeColor,
  trackColor,
  disabled = false,
}: DraggableProgressProps) {
  const [width, setWidth] = useState(0);
  const dragRatio = useSharedValue(progress);
  const dragging = useSharedValue(false);

  // 外部进度变化(轮询)且未在拖动时,跟随
  useEffect(() => {
    if (!dragging.value) dragRatio.value = progress;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  // 回调经 SharedValue 转发进 worklet;兜底空函数避免 undefined。
  // 下面的 SharedValue 赋值为 Reanimated 官方写法(immutability 规则误报),整段豁免。
  /* eslint-disable react-hooks/immutability */
  const noop = () => undefined;
  const onDragRef = useSharedValue<(ratio: number) => void>(onDrag ?? noop);
  const onSeekRef = useSharedValue<(ratio: number) => void>(onSeek ?? noop);
  useEffect(() => {
    onDragRef.value = onDrag ?? noop;
    onSeekRef.value = onSeek ?? noop;
  });

  const gesture = Gesture.Pan()
    .enabled(!disabled && width > 0)
    .onBegin(() => {
      dragging.value = true;
    })
    .onUpdate((event) => {
      const ratio = Math.min(1, Math.max(0, event.x / width));
      dragRatio.value = ratio;
      runOnJS(onDragRef.value)?.(ratio);
    })
    .onEnd(() => {
      dragging.value = false;
      const ratio = Math.min(1, Math.max(0, dragRatio.value));
      dragRatio.value = withSpring(ratio, { damping: 20 });
      runOnJS(onSeekRef.value)?.(ratio);
    });
  /* eslint-enable react-hooks/immutability */

  // 画线:填充宽度跟随
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(dragRatio.value * 100)}%`,
    backgroundColor: activeColor,
  }));

  // 吸附卡:圆点弹簧吸附
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${Math.round(dragRatio.value * 100)}%`,
    transform: [{ translateX: -11 }, { scale: dragging.value ? 1.35 : withSpring(1) }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: 28, justifyContent: 'center' }}
      >
        <View style={{ height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%' }, fillStyle]} />
        </View>
        {!disabled ? (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 3,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#ffffff',
                borderWidth: 2,
                borderColor: activeColor,
              },
              thumbStyle,
            ]}
          />
        ) : null}
        {/* 点击命中兜底:直接吸附 seek */}
        <Pressable
          style={{ position: 'absolute', left: 0, right: 0, top: -10, bottom: -10 }}
          disabled={disabled}
          onPress={(event) => {
            if (width <= 0) return;
            const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
            // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue 官方写法
            dragRatio.value = ratio;
            onSeek(ratio);
          }}
        />
      </View>
    </GestureDetector>
  );
}
