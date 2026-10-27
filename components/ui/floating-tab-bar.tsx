/**
 * 悬浮椭圆 TabBar:圆角 999 的胶囊容器悬浮在底部,选中项呈药丸高亮(图标 + 文字),
 * 未选中项只显示图标。替代系统式贴底 TabBar。
 *
 * 约束同 (tabs)/_layout.tsx:只用 RN 核心组件,不引新原生依赖;
 * 不用 expo-blur(鸿蒙无适配),容器用高不透明度 card 色 + 描边 + 投影。
 * 外层 View 的 paddingBottom(安全区 + 悬浮间距)会被 useBottomTabBarHeight
 * 计入,列表页的 paddingBottom 无需为悬浮形态额外调整。
 */
import React from 'react';
import { Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { token } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const key = scheme === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();

  const card = token('card', key);
  const border = token('border', key);
  const primary = token('primary', key);
  const primaryForeground = token('primary-foreground', key);
  const inactive = token('muted-foreground', key);
  const urgent = token('urgent', key);
  const urgentForeground = token('urgent-foreground', key);

  return (
    <View
      style={{
        paddingBottom: insets.bottom + 10,
        paddingHorizontal: 18,
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: card,
            borderColor: border,
            shadowColor: primary,
            elevation: 10,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const icon = options.tabBarIcon?.({ focused, color: focused ? primaryForeground : inactive, size: 21 });

          const badge = options.tabBarBadge;
          const badgeText = typeof badge === 'number' || typeof badge === 'string' ? String(badge) : null;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.item,
                focused && { backgroundColor: primary },
                pressed && !focused && { opacity: 0.7 },
              ]}
            >
              <View>
                {icon}
                {badgeText ? (
                  <View style={[styles.badge, { backgroundColor: urgent }]}>
                    <Text style={{ color: urgentForeground, fontSize: 9, fontWeight: '700' }}>
                      {badgeText}
                    </Text>
                  </View>
                ) : null}
              </View>
              {focused ? (
                <Text
                  numberOfLines={1}
                  style={{ color: primaryForeground, fontSize: 12, fontWeight: '600' }}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
    // 鸿蒙/Android 侧没有 shadow*,用 elevation;iOS 侧用 shadow* 做青蓝辉光。
    ...(Platform.OS === 'ios'
      ? { shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }
      : {}),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 6,
    minWidth: 44,
    minHeight: 44,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 16,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
