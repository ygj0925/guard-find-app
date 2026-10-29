/**
 * 六 Tab:广场 / 发布 / 社区(占位) / 工具 / 消息 / 我的。
 *
 * 只用 RN 核心 + 已验证的 RNOH 伴生包(screens / gesture-handler / safe-area-context),
 * 不引 `@react-navigation/bottom-tabs` 之外的原生依赖;TabBar 不使用 blur(expo-blur 无鸿蒙适配)。
 * 未读角标绑 store/session.unreadCount,消息到达与已读都会即时同步(spec 7.3)。
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { BookOpen, Megaphone, MessageSquare, Newspaper, User, Wrench } from 'lucide-react-native';

import { FloatingTabBar } from '@/components/ui/floating-tab-bar';
import { Icon } from '@/components/ui/icon';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSession } from '@/store/session';

export const unstable_settings = { initialRouteName: 'plaza' };

function TabIcon({
  as: Glyph,
  color,
  label,
}: {
  as: React.ComponentProps<typeof Icon>['as'];
  color: string;
  label: string;
}) {
  return <Icon accessibilityLabel={label} as={Glyph} color={color} size={21} />;
}

export default function TabLayout() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const unread = useSession((state) => state.unreadCount);
  const signedIn = useSession((state) => state.phase === 'authenticated');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.icon,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen
        name="plaza"
        options={{
          title: '广场',
          tabBarIcon: ({ color }) => <TabIcon as={Newspaper} color={color} label="寻人广场" />,
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          title: '发布',
          tabBarIcon: ({ color }) => <TabIcon as={Megaphone} color={color} label="发布寻人" />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '社区',
          tabBarIcon: ({ color }) => <TabIcon as={BookOpen} color={color} label="社区(待开放)" />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: '工具',
          tabBarIcon: ({ color }) => <TabIcon as={Wrench} color={color} label="工具箱" />,
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          title: '消息',
          tabBarBadge: signedIn && unread > 0 ? unread : undefined,
          // 角标超过 3 位数会撑破布局,与系统一致截成 99+。
          tabBarBadgeStyle: { backgroundColor: palette.urgent, fontSize: 10 },
          tabBarIcon: ({ color }) => <TabIcon as={MessageSquare} color={color} label="消息中心" />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <TabIcon as={User} color={color} label="我的" />,
        }}
      />
    </Tabs>
  );
}

/** 角标文案统一在这里出,避免各页写死。 */
export function unreadLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}
