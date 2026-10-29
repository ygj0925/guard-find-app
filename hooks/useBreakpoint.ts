/**
 * 响应式断点(行业标准口径):
 *   phone   < 640        手机(含折叠屏外屏)
 *   tablet  640-1023     平板竖屏 / 折叠屏内屏 / 大手机横屏
 *   desktop >= 1024      平板横屏 / PC 网页
 *
 * CSS 层直接用 NativeWind 的 sm:/md:/lg: 变体(v4 全平台支持,走窗口宽度);
 * 本 hook 供 JS 层做结构性决策(导航形态/列数/限宽),与 CSS 断点同口径。
 */
import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export const BREAKPOINTS = { tablet: 640, desktop: 1024 } as const;

export interface Responsive {
  width: number;
  breakpoint: Breakpoint;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useBreakpoint(): Responsive {
  const { width } = useWindowDimensions();
  const breakpoint: Breakpoint = width >= BREAKPOINTS.desktop ? 'desktop' : width >= BREAKPOINTS.tablet ? 'tablet' : 'phone';
  return {
    width,
    breakpoint,
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  };
}

/**
 * 内容流限宽:宽屏居中并限制阅读宽度(手机端原样铺满)。
 * 用在 ScrollView 的 contentContainerStyle / 普通容器 style 上。
 */
export function contentWidthStyle(responsive: Responsive, wide = 960, narrow = 720): { maxWidth: number; alignSelf: 'center'; width: '100%' } | undefined {
  if (responsive.breakpoint === 'phone') return undefined;
  return { maxWidth: responsive.isDesktop ? wide : narrow, alignSelf: 'center', width: '100%' };
}
