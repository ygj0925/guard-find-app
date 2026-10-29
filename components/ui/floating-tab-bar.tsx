/**
 * 响应式 TabBar:
 *   手机(< 1024)   = 悬浮椭圆胶囊贴底,选中项药丸高亮(图标+文字)
 *   宽屏(>= 1024)  = 左侧竖排侧边栏(全高),标签常显 —— iPad 横屏/PC/折叠屏展开的主流形态
 *
 * 约束同 (tabs)/_layout.tsx:只用 RN 核心组件,不引新原生依赖;
 * 不用 expo-blur(鸿蒙无适配),容器用高不透明度 card 色 + 描边 + 投影。
 */
import React from 'react';
import { Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { token } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const key = scheme === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  const vertical = isDesktop;

  const card = token('card', key);
  const border = token('border', key);
  const primary = token('primary', key);
  const primaryForeground = token('primary-foreground', key);
  const inactive = token('muted-foreground', key);
  const urgent = token('urgent', key);
  const urgentForeground = token('urgent-foreground', key);

  return (
    <View
      style={
        vertical
          ? {
              width: 88,
              height: '100%',
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom,
              backgroundColor: card,
              borderRightWidth: 1,
              borderRightColor: border,
            }
          : {
              paddingBottom: insets.bottom + 10,
              paddingHorizontal: 18,
              backgroundColor: 'transparent',
            }
      }
    >
      <View
        style={[
          vertical ? styles.rail : styles.pill,
          {
            backgroundColor: vertical ? 'transparent' : card,
            borderColor: vertical ? 'transparent' : border,
            shadowColor: vertical ? 'transparent' : primary,
            elevation: vertical ? 0 : 10,
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
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.item,
                vertical && styles.itemVertical,
                focused && { backgroundColor: primary },
                pressed && !focused && { opacity: 0.7 },
              ]}
            >
              <View>
                {icon}
                {badgeText ? (
                  <View style={[styles.badge, { backgroundColor: urgent }]}>
                    <Text style={{ color: urgentForeground, fontSize: 9, fontWeight: '700' }}>{badgeText}</Text>
                  </View>
                ) : null}
              </View>
              {focused || vertical ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: focused ? primaryForeground : inactive,
                    fontSize: vertical ? 11 : 12,
                    fontWeight: '600',
                  }}
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
  rail: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
    paddingHorizontal: 8,
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
  itemVertical: {
    flexDirection: 'column',
    gap: 4,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
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
