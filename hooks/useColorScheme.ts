/**
 * 配色方案:外观偏好(store/appearance)覆盖系统值。
 * mode='system' 时跟随系统;样式层的 dark: 变体由 NativeWind colorScheme.set 驱动
 * (store 里已同步),本 hook 供 JS 侧取色(导航主题/行内 token)使用。
 */
import { useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useAppearance } from '@/store/appearance';

export function useColorScheme(): 'light' | 'dark' | null | undefined {
  const mode = useAppearance((state) => state.mode);
  const loaded = useAppearance((state) => state.loaded);
  const load = useAppearance((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const system = useRNColorScheme();
  if (!loaded) return system;
  return mode === 'system' ? system : mode;
}
