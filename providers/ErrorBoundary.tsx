/**
 * 全局错误边界(spec: 鸿蒙无红框下的可诊断性)。
 *
 * `shims/expo-metro-runtime.ts` 在鸿蒙侧关掉了 Metro 的 JS 红框,所以子树崩了如果
 * 没有这层兜底就是白屏。要求:
 *   - 展示可读摘要 + "复制"入口(走 clipboard 能力,不支持时给可长按选中的原文);
 *   - 提供"重试"与"回到首页",Tab 栏与导航仍可用;
 *   - 开发环境额外展示最近错误列表(来自 lib/monitor)。
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ApiError } from '@/lib/api/error';
import { clipboard } from '@/lib/capabilities';
import { copyableSummary, captureError, recentErrors, setMonitorRoute } from '@/lib/monitor';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** 局部兜底时用来区分是哪块面板崩了。 */
  label?: string;
  /** 重置信号:变化即清空错误(路由切换时用)。 */
  resetKey?: string | number;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

export function buildErrorSummary(
  error: Error | null,
  info: ErrorInfo | null,
  label?: string,
): string {
  const head = label ? `【${label}】` : '';
  if (error instanceof ApiError) {
    return `${head}接口错误 ${error.code}:${error.msg}`;
  }
  const message = error?.message ?? '未知错误';
  const name = error?.name ?? 'Error';
  const component = info?.componentStack
    ? `\n组件栈:${info.componentStack.trim().split('\n').slice(0, 6).join(' <- ')}`
    : '';
  return `${head}${name}: ${message}${component}\n${error?.stack ?? ''}`.trim();
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    captureError(error, this.props.label ? `子树[${this.props.label}]渲染异常` : '渲染异常');
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.reset();
  }

  reset = (): void => {
    this.setState({ error: null, info: null });
  };

  private handleCopy = (): void => {
    const summary = buildErrorSummary(this.state.error, this.state.info, this.props.label);
    void clipboard.copy(`${summary}\n\n最近错误:\n${copyableSummary()}`);
  };

  private handleGoHome = (): void => {
    this.reset();
    setMonitorRoute('/(tabs)/plaza');
    try {
      router.replace('/(tabs)/plaza');
    } catch {
      // 路由不可用(如根布局自身崩了)时至少要能重试。
    }
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const summary = buildErrorSummary(this.state.error, this.state.info, this.props.label);
    const errors = __DEV__ ? recentErrors(5) : [];

    return (
      <View style={styles.container}>
        <Text style={styles.title}>页面出错了</Text>
        <Text style={styles.subtitle}>
          已为该区块兜底,底部导航与其余页面仍可正常使用。
        </Text>
        <ScrollView style={styles.summaryBox}>
          <Text selectable style={styles.summary}>
            {summary}
          </Text>
          {errors.length > 0 ? (
            <Text style={styles.recent}>
              {`最近错误 ${errors.length} 条:\n`}
              {errors.map((entry) => `${new Date(entry.at).toLocaleTimeString()} ${entry.message}`).join('\n')}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={this.reset} style={styles.primaryButton}>
            <Text style={styles.primaryText}>重试</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={this.handleCopy} style={styles.button}>
            <Text style={styles.text}>复制错误摘要</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={this.handleGoHome} style={styles.button}>
            <Text style={styles.text}>回到广场</Text>
          </Pressable>
        </View>
        {clipboard.isAvailable() ? null : (
          <Text style={styles.hint}>当前设备不支持一键复制,可长按上方文字选中。</Text>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 19, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 6, fontSize: 13, color: '#6b7280' },
  summaryBox: {
    marginTop: 14,
    maxHeight: 260,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 10,
  },
  summary: { fontSize: 12, lineHeight: 18, color: '#374151', fontFamily: 'monospace' },
  recent: { marginTop: 10, fontSize: 11, lineHeight: 16, color: '#6b7280' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  primaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#155e75',
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  text: { color: '#111827', fontSize: 14 },
  hint: { marginTop: 10, fontSize: 12, color: '#9ca3af' },
});
