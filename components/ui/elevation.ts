import { Platform, type ViewStyle } from 'react-native';

// class 里的 shadow-* 在原生端不渲染(css-interop 不解析),原生海拔只能走 style;web 继续用 class 阴影。
// 阴影色取 overlay 深墨蓝(222 45% 8%),不用纯黑。数值未经真机观感核对。
const INK = '#0b111e';

function level(opacity: number, radius: number, y: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    web: {},
    default: {
      shadowColor: INK,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: y },
      elevation,
    },
  });
}

export const ELEVATION = {
  card: level(0.06, 6, 2, 1),
  dialog: level(0.18, 24, 10, 12),
} as const;
