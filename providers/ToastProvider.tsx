/**
 * 轻量 Toast:用于"草稿已保存""线索已送达"这类即时反馈。
 * 一期不引第三方提示包(原生依赖需走 expo-harmony-cli),纯 JS + 定时消失。
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const DURATION_MS = 2600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  // useState 惰性初始化(react-hooks/refs 禁止渲染期访问 ref.current)
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setState({ id: Date.now(), message, tone });
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setState(null);
          },
        );
      }, DURATION_MS);
    },
    [opacity],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {state ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.wrapper, { opacity }]}
        >
          <View style={styles.bubble}>
            <View style={[styles.dot, TONE_DOT[state.tone]]} />
            <Text style={styles.text}>{state.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const TONE_DOT = StyleSheet.create({
  info: { backgroundColor: '#7dd3fc' },
  success: { backgroundColor: '#4ade80' },
  warn: { backgroundColor: '#fbbf24' },
  error: { backgroundColor: '#f87171' },
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(17,24,39,0.94)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  text: { color: '#fff', fontSize: 13, lineHeight: 18 },
});
