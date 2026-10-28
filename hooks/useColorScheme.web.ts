import { useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useAppearance } from '@/store/appearance';

/**
 * Web 侧配色:与原生 hook 同逻辑,尊重外观偏好(NativeWind colorScheme 驱动样式)。
 * 静态渲染阶段 Store 未加载时按 system 处理。
 */
export function useColorScheme() {
  const mode = useAppearance((state) => state.mode);
  const load = useAppearance((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const colorScheme = useRNColorScheme();
  return mode === 'system' ? colorScheme : mode;
}
