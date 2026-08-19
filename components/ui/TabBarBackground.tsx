import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

export default undefined;

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  return Platform.OS === 'ios' ? tabHeight : 0;
}
