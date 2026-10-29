/**
 * 动效常量层:全站 spring/timing 参数的事实源,组件不允许再各写一套。
 * 每个配置都带 reduceMotion: ReduceMotion.System —— 用户在系统层开启"减弱动态效果"时
 * 直接落终值,不做位移/缩放/扩散(无障碍硬要求,也是四端一致性的一部分)。
 */
import { Easing, ReduceMotion } from 'react-native-reanimated';

export const REDUCE = ReduceMotion.System;

/** 标准减速曲线(Reanimated 的 Easing 没有 cubicBezier,用 out(cubic) 等价形态)。 */
export const EASING_OUT = Easing.out(Easing.cubic);

/** 弹性参数。tap 是按下收缩,release 是松手回弹,snap 是拖动吸附,bounce 是勾选/旋钮弹跳。 */
export const SPRING = {
  tap: { damping: 20, stiffness: 300, mass: 0.6, reduceMotion: REDUCE },
  release: { damping: 16, stiffness: 260, mass: 0.6, reduceMotion: REDUCE },
  snap: { damping: 20, stiffness: 180, mass: 0.8, reduceMotion: REDUCE },
  bounce: { damping: 12, stiffness: 320, mass: 0.7, reduceMotion: REDUCE },
} as const;

/** 时长(ms)。 */
export const DURATION = {
  instant: 120,
  fast: 200,
  normal: 260,
  reveal: 380,
  spin: 2200,
} as const;

/** withTiming 的统一配置:同一条曲线 + 系统减弱动态效果时直接落终值。 */
export function timing(ms: number) {
  return { duration: ms, easing: EASING_OUT, reduceMotion: REDUCE };
}
