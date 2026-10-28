/**
 * 时钟工具集:时钟(数字+模拟表盘)/秒表(计次)/计时器(前台倒计时)。
 * 纯本地零依赖;倒计时完成用前台 Alert 提示——真闹钟需要系统通知,
 * 鸿蒙侧 expo-notifications 未验证(规划 8.1 P2),验证后再做真闹钟。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { buildLaps, clockHands, formatCountdown, formatStopwatch } from '@/lib/clock/format';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

type Mode = 'clock' | 'stopwatch' | 'timer';

export default function ClockScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [mode, setMode] = useState<Mode>('clock');
  const primary = token('primary', scheme);
  const muted = token('muted', scheme);
  const danger = token('urgent', scheme);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">时钟</Text>
          <Text className="text-muted-foreground mt-1 text-sm">时钟 · 秒表 · 计时器 · 离线可用</Text>
        </View>

        <View className="mb-3 flex-row rounded-full bg-muted p-1">
          {(['clock', 'stopwatch', 'timer'] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={{ clock: '时钟', stopwatch: '秒表', timer: '计时器' }[key]}
              onPress={() => setMode(key)}
              className={`flex-1 items-center rounded-full py-2 ${mode === key ? 'bg-primary' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${mode === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {{ clock: '时钟', stopwatch: '秒表', timer: '计时器' }[key]}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'clock' ? <ClockPanel scheme={scheme} primary={primary} muted={muted} /> : null}
        {mode === 'stopwatch' ? <StopwatchPanel scheme={scheme} primary={primary} muted={muted} danger={danger} /> : null}
        {mode === 'timer' ? <TimerPanel scheme={scheme} primary={primary} muted={muted} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 时钟:数字 + 模拟表盘(View 拼图)。 */
function ClockPanel({
  scheme,
  primary,
  muted,
}: {
  scheme: 'light' | 'dark';
  primary: string;
  muted: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const hands = clockHands(now);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Card className="items-center p-6">
      <View
        className="h-52 w-52 items-center justify-center rounded-full"
        style={{ backgroundColor: muted, borderWidth: 6, borderColor: primary }}
      >
        {/* 刻度:12 个点 */}
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index * 30 * Math.PI) / 180;
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                transform: [
                  { translateX: Math.sin(angle) * 86 },
                  { translateY: -Math.cos(angle) * 86 },
                ],
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: primary,
              }}
            />
          );
        })}
        {/* 时针/分针/秒针:容器绕表盘中心旋转,指针底部对齐中心 */}
        {(
          [
            { angle: hands.hour, length: 52, width: 5, color: token('foreground', scheme) },
            { angle: hands.minute, length: 74, width: 3.5, color: token('foreground', scheme) },
            { angle: hands.second, length: 82, width: 2, color: token('urgent', scheme) },
          ] as const
        ).map((hand, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              width: 208,
              height: 208,
              alignItems: 'center',
              transform: [{ rotate: `${hand.angle}deg` }],
            }}
          >
            <View
              style={{
                width: hand.width,
                height: hand.length,
                marginTop: 104 - hand.length,
                borderRadius: hand.width / 2,
                backgroundColor: hand.color,
              }}
            />
          </View>
        ))}
        <View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: primary }} />
      </View>
      <Text className="text-foreground mt-4 text-4xl font-bold">
        {pad(now.getHours())}:{pad(now.getMinutes())}
      </Text>
      <Text className="text-muted-foreground mt-1 text-sm">
        {now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日 周
        {'日一二三四五六'[now.getDay()]}
      </Text>
    </Card>
  );
}

/** 秒表:开始/暂停/重置 + 计次。 */
function StopwatchPanel({
  scheme,
  primary,
  muted,
  danger,
}: {
  scheme: 'light' | 'dark';
  primary: string;
  muted: string;
  danger: string;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now() - elapsed;
    const timer = setInterval(() => setElapsed(Date.now() - started), 33);
    return () => clearInterval(timer);
    // elapsed 仅在启动时取基准;运行中不由 elapsed 变化重置定时器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const toggle = useCallback(() => setRunning((prev) => !prev), []);
  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  }, []);
  const lap = useCallback(() => {
    if (!running) return;
    setLaps((prev) => [elapsed, ...prev]);
  }, [elapsed, running]);

  const lapEntries = useMemo(() => buildLaps(laps), [laps]);

  const buttonStyle = (filled: boolean) => ({
    backgroundColor: filled ? primary : muted,
  });

  return (
    <Card className="items-center p-6">
      <Text className="text-foreground text-5xl font-bold" accessibilityLabel="秒表读数">
        {formatStopwatch(elapsed)}
      </Text>
      <View className="mt-4 flex-row" style={{ gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? '暂停' : '开始'}
          onPress={toggle}
          className="h-16 w-16 items-center justify-center rounded-full"
          style={buttonStyle(running ? false : true)}
        >
          <Text className={`text-sm font-semibold ${running ? '' : 'text-primary-foreground'}`}>
            {running ? '暂停' : '开始'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? '计次' : '重置'}
          onPress={running ? lap : reset}
          className="h-16 w-16 items-center justify-center rounded-full"
          style={buttonStyle(false)}
        >
          <Text className="text-sm font-semibold" style={{ color: running ? danger : token('muted-foreground', scheme) }}>
            {running ? '计次' : '重置'}
          </Text>
        </Pressable>
      </View>
      {lapEntries.length > 0 ? (
        <View className="mt-4 w-full">
          <Text className="text-muted-foreground mb-1 text-xs font-semibold">计次(分段时间 / 累计)</Text>
          {lapEntries.map((entry) => (
            <View key={entry.index} className="flex-row justify-between py-1">
              <Text className="text-muted-foreground text-sm">#{entry.index}</Text>
              <Text className="text-foreground text-sm">
                {formatStopwatch(entry.lapTime)} / {formatStopwatch(entry.totalTime)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** 计时器:预设分钟数,前台倒计时,结束 Alert 提示。 */
function TimerPanel({
  scheme,
  primary,
  muted,
}: {
  scheme: 'light' | 'dark';
  primary: string;
  muted: string;
}) {
  const [presetMinutes, setPresetMinutes] = useState(5);
  const [customMinutes, setCustomMinutes] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining === null) return;
    const current = remaining;
    const timer = setTimeout(() => {
      const next = current - 1;
      setRemaining(next);
      if (next <= 0) {
        setRunning(false);
        Alert.alert('时间到', '倒计时结束');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [running, remaining]);

  const start = useCallback(() => {
    const minutes = customMinutes.trim() ? Number(customMinutes) : presetMinutes;
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) {
      Alert.alert('请输入 1-1440 分钟之间的数字');
      return;
    }
    setRemaining(Math.round(minutes * 60));
    setRunning(true);
  }, [customMinutes, presetMinutes]);

  const cancel = useCallback(() => {
    setRunning(false);
    setRemaining(null);
  }, []);

  const chipStyle = (selected: boolean) => ({
    borderColor: selected ? primary : muted,
    backgroundColor: selected ? primary : 'transparent',
  });

  return (
    <Card className="items-center p-6">
      <Text className="text-foreground text-5xl font-bold" accessibilityLabel="倒计时读数">
        {formatCountdown(remaining ?? Math.round((customMinutes.trim() ? Number(customMinutes) || 0 : presetMinutes) * 60))}
      </Text>
      {!running ? (
        <View className="mt-4 flex-row flex-wrap justify-center" style={{ gap: 6 }}>
          {[1, 3, 5, 10, 25].map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              accessibilityLabel={`${minutes} 分钟`}
              onPress={() => {
                setPresetMinutes(minutes);
                setCustomMinutes('');
              }}
              className="rounded-full border px-4 py-1.5"
              style={chipStyle(!customMinutes.trim() && presetMinutes === minutes)}
            >
              <Text
                className={`text-xs font-semibold ${!customMinutes.trim() && presetMinutes === minutes ? 'text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {minutes} 分钟
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!running ? (
        <TextInput
          className="border-border mt-3 rounded-lg border px-3 py-2 text-center text-sm"
          style={{ color: token('foreground', scheme), width: 160 }}
          value={customMinutes}
          onChangeText={setCustomMinutes}
          placeholder="或自定义分钟数"
          keyboardType="number-pad"
          accessibilityLabel="自定义分钟数"
        />
      ) : null}
      <View className="mt-4 flex-row" style={{ gap: 12 }}>
        {running ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="取消倒计时"
            onPress={cancel}
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: muted }}
          >
            <Text className="text-xs font-semibold">取消</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="开始倒计时"
            onPress={start}
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: primary }}
          >
            <Text className="text-primary-foreground text-xs font-semibold">开始</Text>
          </Pressable>
        )}
      </View>
      <Text className="text-muted-foreground mt-3 text-center text-xs">
        提示:倒计时在应用打开时有效;后台提醒需系统通知能力(规划中)
      </Text>
    </Card>
  );
}
