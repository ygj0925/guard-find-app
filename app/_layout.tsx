/**
 * 应用根布局。修掉模板遗留的空 useEffect,补齐四件事:
 *   1. GestureHandlerRootView + SafeAreaProvider(RN 0.77 缺了直接白屏);
 *   2. 全局 ErrorBoundary —— 鸿蒙侧 Metro 红框被 shim 关闭,没有它就是无声白屏;
 *   3. 会话恢复(SessionProvider):恢复完成前不渲染业务页,避免闪回登录页;
 *   4. 环境基址缺失时渲染可读配置错误,而不是向猜测地址发请求。
 */
import '../global.css';

import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';

import { ErrorBoundary } from '@/providers/ErrorBoundary';
import { SessionProvider } from '@/providers/SessionProvider';
import { FiltersProvider } from '@/providers/FiltersProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { EnvNotice } from '@/components/business/env-notice';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { readEnvError } from '@/lib/env';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const envError = useMemo(() => readEnvError(), []);
  const isDark = colorScheme === 'dark';
  const palette = Colors[isDark ? 'dark' : 'light'];

  // 导航原生界面(header/背景)与业务页共用品牌 token,避免配色漂移。
  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme : DefaultTheme).colors,
        primary: palette.tint,
        background: palette.background,
        card: palette.background,
        text: palette.text,
        border: palette.border,
        notification: palette.urgent,
      },
    }),
    [isDark, palette],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <ErrorBoundary label="应用根布局">
            {envError ? (
              <EnvNotice message={envError} />
            ) : (
              <SessionProvider>
                <FiltersProvider>
                  <ToastProvider>
                    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="auth/login"
                        options={{ title: '登录', presentation: 'modal' }}
                      />
                      <Stack.Screen
                        name="auth/profile-setup"
                        options={{ title: '完善资料', presentation: 'modal' }}
                      />
                      <Stack.Screen name="case/[id]/index" options={{ title: '寻人档案' }} />
                      <Stack.Screen name="case/[id]/lead" options={{ title: '提交线索' }} />
                      <Stack.Screen name="case/[id]/leads" options={{ title: '线索处理' }} />
                      <Stack.Screen name="publish/case" options={{ title: '发布寻人' }} />
                      <Stack.Screen name="publish/drafts" options={{ title: '草稿箱' }} />
                      <Stack.Screen name="search" options={{ title: '搜索' }} />
                      <Stack.Screen name="tools/ledger" options={{ title: '记账' }} />
                      <Stack.Screen
                        name="tools/ledger/add"
                        options={{ title: '记一笔', presentation: 'modal' }}
                      />
                      <Stack.Screen name="tools/ledger/report" options={{ title: '收支报表' }} />
                      <Stack.Screen name="tools/ledger/groups" options={{ title: '账本管理' }} />
                      <Stack.Screen name="tools/ledger/group-detail" options={{ title: '家庭组' }} />
                      <Stack.Screen name="ai/conversations" options={{ title: 'AI 对话' }} />
                      <Stack.Screen name="ai/chat" options={{ title: '对话', headerBackButtonDisplayMode: 'default' }} />
                      <Stack.Screen name="tools/countdown" options={{ title: '倒数日' }} />
                      <Stack.Screen name="tools/todo" options={{ title: '待办清单' }} />
                      <Stack.Screen name="tools/unit-convert" options={{ title: '单位换算' }} />
                      <Stack.Screen name="tools/habits" options={{ title: '习惯打卡' }} />
                      <Stack.Screen name="tools/habit-detail" options={{ title: '打卡日历' }} />
                      <Stack.Screen name="tools/split" options={{ title: 'AA 分账' }} />
                      <Stack.Screen name="tools/mortgage" options={{ title: '房贷计算' }} />
                      <Stack.Screen name="tools/text-toolkit" options={{ title: '文本工具箱' }} />
                      <Stack.Screen name="tools/random" options={{ title: '随机决定器' }} />
                      <Stack.Screen name="tools/weekly-report" options={{ title: 'AI 周报' }} />
                      <Stack.Screen name="tools/tasks" options={{ title: '任务分派' }} />
                      <Stack.Screen name="tools/goals" options={{ title: '目标 OKR' }} />
                      <Stack.Screen name="tools/clock" options={{ title: '时钟' }} />
                      <Stack.Screen name="tools/calculator" options={{ title: '计算器' }} />
                      <Stack.Screen name="tools/music" options={{ title: '音乐播放' }} />
                      <Stack.Screen name="tools/checkin" options={{ title: '在线签到' }} />
                      <Stack.Screen name="tools/checkin-detail" options={{ title: '签到详情' }} />
                      <Stack.Screen name="tools/health" options={{ title: '健康计算' }} />
                      <Stack.Screen name="tools/date-calc" options={{ title: '日期计算' }} />
                      <Stack.Screen name="tools/report" options={{ title: '工作汇报' }} />
                      <Stack.Screen name="tools/report-detail" options={{ title: '汇报详情' }} />
                      <Stack.Screen name="tools/report-entry" options={{ title: '月报' }} />
                      <Stack.Screen name="tools/password" options={{ title: '密码生成' }} />
                      <Stack.Screen name="tools/discount" options={{ title: '折扣比较' }} />
                      <Stack.Screen name="community/publish" options={{ title: '发布动态', presentation: 'modal' }} />
                      <Stack.Screen name="community/detail" options={{ title: '动态详情' }} />
                      <Stack.Screen name="community/user" options={{ title: '个人主页' }} />
                      <Stack.Screen name="me/profile-edit" options={{ title: '编辑资料' }} />
                      <Stack.Screen name="me/security" options={{ title: '账号安全' }} />
                      <Stack.Screen name="me/cases" options={{ title: '我发布的档案' }} />
                      <Stack.Screen name="me/leads" options={{ title: '我的线索' }} />
                      <Stack.Screen name="me/favorites" options={{ title: '我的收藏' }} />
                      <Stack.Screen
                        name="me/notification-pref"
                        options={{ title: '通知偏好' }}
                      />
                      <Stack.Screen name="+not-found" options={{ title: '页面不存在' }} />
                    </Stack>
                    <StatusBar style="auto" />
                  </ToastProvider>
                </FiltersProvider>
              </SessionProvider>
            )}
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
