/**
 * 时钟工具集:时钟(含世界时钟)/秒表/计时器/闹钟(前台)/番茄钟。
 * 纯本地零依赖;闹钟为前台触发(应用打开时 Alert),真闹钟需系统通知(鸿蒙未验证)。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { WheelPicker } from '@/components/ui/wheel-picker';
import { buildLaps, clockHands, formatCountdown, formatStopwatch } from '@/lib/clock/format';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

type Mode = 'clock' | 'stopwatch' | 'timer' | 'alarm' | 'pomodoro';

const MODE_LABELS: Record<Mode, string> = {
  clock: '时钟', stopwatch: '秒表', timer: '计时器', alarm: '闹钟', pomodoro: '番茄钟',
};

const MODE_KEYS: Mode[] = ['clock', 'stopwatch', 'timer', 'alarm', 'pomodoro'];

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
          <Text className="text-muted-foreground mt-1 text-sm">时钟 · 秒表 · 计时器 · 闹钟 · 番茄钟 · 离线可用</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row rounded-full bg-muted p-1">
            {MODE_KEYS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={MODE_LABELS[key]}
                onPress={() => setMode(key)}
                className={`items-center rounded-full px-4 py-2 ${mode === key ? 'bg-primary' : ''}`}
              >
                <Text
                  className={`text-sm font-semibold ${mode === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {MODE_LABELS[key]}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {mode === 'clock' ? <ClockPanel scheme={scheme} primary={primary} muted={muted} /> : null}
        {mode === 'stopwatch' ? <StopwatchPanel scheme={scheme} primary={primary} muted={muted} danger={danger} /> : null}
        {mode === 'timer' ? <TimerPanel scheme={scheme} primary={primary} muted={muted} /> : null}
        {mode === 'alarm' ? <AlarmPanel scheme={scheme} primary={primary} muted={muted} danger={danger} /> : null}
        {mode === 'pomodoro' ? <PomodoroPanel scheme={scheme} primary={primary} muted={muted} danger={danger} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== 时钟(含世界时钟) ====================

const WORLD_CITIES: { city: string; timeZone: string }[] = [
  { city: '北京', timeZone: 'Asia/Shanghai' },
  { city: '东京', timeZone: 'Asia/Tokyo' },
  { city: '伦敦', timeZone: 'Europe/London' },
  { city: '纽约', timeZone: 'America/New_York' },
  { city: '悉尼', timeZone: 'Australia/Sydney' },
];

function ClockPanel({ scheme, primary, muted }: { scheme: 'light' | 'dark'; primary: string; muted: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const hands = clockHands(now);
  const pad = (n: number) => String(n).padStart(2, '0');

  const worldTimes = useMemo(
    () =>
      WORLD_CITIES.map(({ city, timeZone }) => ({
        city,
        time: new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
      })),
    [now],
  );

  return (
    <>
      <Card className="items-center p-6">
        <View
          className="h-52 w-52 items-center justify-center rounded-full"
          style={{ backgroundColor: muted, borderWidth: 6, borderColor: primary }}
        >
          {Array.from({ length: 12 }, (_, index) => {
            const angle = (index * 30 * Math.PI) / 180;
            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  transform: [{ translateX: Math.sin(angle) * 86 }, { translateY: -Math.cos(angle) * 86 }],
                  width: 4, height: 4, borderRadius: 2, backgroundColor: primary,
                }}
              />
            );
          })}
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
                position: 'absolute', width: 208, height: 208, alignItems: 'center',
                transform: [{ rotate: `${hand.angle}deg` }],
              }}
            >
              <View
                style={{
                  width: hand.width, height: hand.length, marginTop: 104 - hand.length,
                  borderRadius: hand.width / 2, backgroundColor: hand.color,
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
          {now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日 周{'日一二三四五六'[now.getDay()]}
        </Text>
      </Card>

      {/* 世界时钟 */}
      <Card className="mb-3 p-4">
        <Text className="text-muted-foreground mb-2 text-xs font-semibold">世界时钟</Text>
        {worldTimes.map((item) => (
          <View key={item.city} className="flex-row items-center justify-between py-1">
            <Text className="text-foreground text-sm">{item.city}</Text>
            <Text className="text-muted-foreground text-sm font-mono">{item.time}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

// ==================== 秒表 ====================

function StopwatchPanel({ scheme, primary, muted, danger }: { scheme: 'light' | 'dark'; primary: string; muted: string; danger: string }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now() - elapsed;
    const timer = setInterval(() => setElapsed(Date.now() - started), 33);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const toggle = useCallback(() => setRunning((prev) => !prev), []);
  const reset = useCallback(() => { setRunning(false); setElapsed(0); setLaps([]); }, []);
  const lap = useCallback(() => { if (running) setLaps((prev) => [elapsed, ...prev]); }, [elapsed, running]);

  const lapEntries = useMemo(() => buildLaps(laps), [laps]);

  const buttonStyle = (filled: boolean) => ({ backgroundColor: filled ? primary : muted });

  return (
    <Card className="items-center p-6">
      <Text className="text-foreground text-5xl font-bold" accessibilityLabel="秒表读数">
        {formatStopwatch(elapsed)}
      </Text>
      <View className="mt-4 flex-row" style={{ gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={running ? '暂停' : '开始'}
          onPress={toggle} className="h-16 w-16 items-center justify-center rounded-full" style={buttonStyle(!running)}>
          <Text className={`text-sm font-semibold ${running ? '' : 'text-primary-foreground'}`}>
            {running ? '暂停' : '开始'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={running ? '计次' : '重置'}
          onPress={running ? lap : reset} className="h-16 w-16 items-center justify-center rounded-full" style={buttonStyle(false)}>
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

// ==================== 计时器 ====================

function TimerPanel({ scheme, primary, muted }: { scheme: 'light' | 'dark'; primary: string; muted: string }) {
  const [selectedMinutes, setSelectedMinutes] = useState(5);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining === null) return;
    const current = remaining;
    const timer = setTimeout(() => {
      const next = current - 1;
      setRemaining(next);
      if (next <= 0) { setRunning(false); Alert.alert('时间到', '倒计时结束'); }
    }, 1000);
    return () => clearTimeout(timer);
  }, [running, remaining]);

  const start = useCallback(() => {
    if (selectedMinutes < 1) return;
    setRemaining(selectedMinutes * 60);
    setRunning(true);
  }, [selectedMinutes]);

  const cancel = useCallback(() => { setRunning(false); setRemaining(null); }, []);

  const chipStyle = (selected: boolean) => ({
    borderColor: selected ? primary : muted, backgroundColor: selected ? primary : 'transparent',
  });

  return (
    <Card className="items-center p-6">
      <Text className="text-foreground text-5xl font-bold" accessibilityLabel="倒计时读数">
        {formatCountdown(remaining ?? selectedMinutes * 60)}
      </Text>
      {!running ? (
        <View className="mt-4 flex-row flex-wrap justify-center" style={{ gap: 6 }}>
          {[1, 3, 5, 10, 25].map((minutes) => (
            <Pressable key={minutes} accessibilityRole="button" accessibilityLabel={`${minutes} 分钟`}
              onPress={() => setSelectedMinutes(minutes)} className="rounded-full border px-4 py-1.5" style={chipStyle(selectedMinutes === minutes)}>
              <Text className={`text-xs font-semibold ${selectedMinutes === minutes ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {minutes} 分钟
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!running ? (
        <WheelPicker
          items={Array.from({ length: 120 }, (_, i) => ({ value: i + 1, label: `${i + 1} 分钟` }))}
          value={selectedMinutes} onChange={setSelectedMinutes} width={200}
        />
      ) : null}
      <View className="mt-4 flex-row" style={{ gap: 12 }}>
        {running ? (
          <Pressable accessibilityRole="button" accessibilityLabel="取消倒计时" onPress={cancel}
            className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: muted }}>
            <Text className="text-xs font-semibold">取消</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="开始倒计时" onPress={start}
            className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: primary }}>
            <Text className="text-primary-foreground text-xs font-semibold">开始</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

// ==================== 闹钟(前台) ====================

const pad = (n: number) => String(n).padStart(2, '0');

function AlarmPanel({ scheme, primary, muted, danger }: { scheme: 'light' | 'dark'; primary: string; muted: string; danger: string }) {
  const [alarms, setAlarms] = useState<{ id: string; time: string; label: string; enabled: boolean }[]>([]);
  const [time, setTime] = useState('07:00');
  const [label, setLabel] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    for (const alarm of alarms) {
      if (alarm.enabled && alarm.time === timeStr && !firedRef.current.has(alarm.id)) {
        firedRef.current.add(alarm.id);
        Alert.alert('⏰ 闹钟', alarm.label || '闹钟响了!');
      }
    }
  }, [now, alarms]);

  const add = useCallback(() => {
    if (!/^\d{2}:\d{2}$/.test(time)) { Alert.alert('请输入有效时间'); return; }
    setAlarms((prev) => [...prev, { id: String(Date.now()), time, label: label.trim(), enabled: true }]);
    setLabel('');
  }, [time, label]);

  const toggle = useCallback((id: string) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, []);

  const remove = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);


  return (
    <Card className="p-4">
      <Text className="text-muted-foreground mb-2 text-xs">前台闹钟:应用打开时生效,最小化后不触发</Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <TextInput className="border-border flex-1 rounded-lg border px-3 py-2 text-center text-lg font-bold"
          style={{ color: token('foreground', scheme) }} value={time} onChangeText={setTime}
          placeholder="07:00" maxLength={5} accessibilityLabel="闹钟时间" />
        <TextInput className="border-border flex-1 rounded-lg border px-3 py-2 text-sm"
          style={{ color: token('foreground', scheme) }} value={label} onChangeText={setLabel}
          placeholder="备注(选填)" accessibilityLabel="闹钟备注" />
        <Pressable accessibilityRole="button" accessibilityLabel="添加闹钟" onPress={add}
          className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: primary }}>
          <Text className="text-primary-foreground text-lg font-bold">+</Text>
        </Pressable>
      </View>
      <View className="mt-3" style={{ gap: 6 }}>
        {alarms.length === 0 ? (
          <Text className="text-muted-foreground py-4 text-center text-sm">还没有闹钟</Text>
        ) : (
          alarms.map((alarm) => (
            <View key={alarm.id} className="border-border flex-row items-center justify-between rounded-lg border p-3">
              <View className="flex-1">
                <Text className="text-foreground text-lg font-bold">{alarm.time}</Text>
                {alarm.label ? <Text className="text-muted-foreground text-xs">{alarm.label}</Text> : null}
              </View>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: alarm.enabled }}
                accessibilityLabel={`${alarm.enabled ? '关闭' : '开启'}闹钟`}
                onPress={() => toggle(alarm.id)} className="mr-2 p-1">
                <Text className={`text-sm font-semibold ${alarm.enabled ? 'text-found' : 'text-muted-foreground'}`}>
                  {alarm.enabled ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`删除 ${alarm.time} 的闹钟`} onPress={() => remove(alarm.id)}>
                <Text className="text-urgent text-xs">删除</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </Card>
  );
}

// ==================== 番茄钟 ====================

function PomodoroPanel({ scheme, primary, muted, danger }: { scheme: 'light' | 'dark'; primary: string; muted: string; danger: string }) {
  const FOCUS_MIN = 25;
  const BREAK_MIN = 5;
  const [phase, setPhase] = useState<'idle' | 'focus' | 'break'>('idle');
  const [remaining, setRemaining] = useState(FOCUS_MIN * 60);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (phase === 'idle') return;
    if (remaining <= 0) {
      // 延后一拍:effect 体内禁同步 setState
      const id = setTimeout(() => {
        const next = phase === 'focus' ? 'break' : 'idle';
        setPhase(next);
        setRemaining(next === 'break' ? BREAK_MIN * 60 : FOCUS_MIN * 60);
        if (phase === 'focus') setCycle((c) => c + 1);
        Alert.alert(next === 'break' ? '专注完成!' : '休息结束', next === 'break' ? '休息 5 分钟' : '开始新的专注');
      }, 0);
      return () => clearTimeout(id);
    }
    const timer = setTimeout(() => setRemaining((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, remaining]);

  const start = useCallback((mode: 'focus' | 'break') => {
    setPhase(mode);
    setRemaining(mode === 'focus' ? FOCUS_MIN * 60 : BREAK_MIN * 60);
  }, []);

  const stop = useCallback(() => { setPhase('idle'); setRemaining(FOCUS_MIN * 60); setCycle(0); }, []);

  const totalSeconds = phase === 'break' ? BREAK_MIN * 60 : FOCUS_MIN * 60;
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;
  const isFocus = phase === 'focus' || phase === 'idle';

  return (
    <Card className="items-center p-6">
      <Text className="text-muted-foreground text-xs">
        已完成 {cycle} 个番茄钟 · {isFocus ? '专注 25 分钟' : '休息 5 分钟'}
      </Text>
      <Text
        className="my-4 text-6xl font-bold"
        style={{ color: isFocus ? primary : token('found', scheme) }}
        accessibilityLabel="番茄钟读数"
      >
        {formatCountdown(remaining)}
      </Text>
      {/* 进度条 */}
      <View className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: muted }}>
        <View
          className="h-2 rounded-full"
          style={{
            width: `${Math.max(1, Math.round(progress * 100))}%`,
            backgroundColor: isFocus ? primary : token('found', scheme),
          }}
        />
      </View>
      <View className="mt-4 flex-row" style={{ gap: 12 }}>
        {phase === 'idle' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="开始专注"
            onPress={() => start('focus')} className="rounded-full px-8 py-3" style={{ backgroundColor: primary }}>
            <Text className="text-primary-foreground text-sm font-semibold">开始专注</Text>
          </Pressable>
        ) : (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="停止"
              onPress={stop} className="rounded-full px-6 py-3" style={{ backgroundColor: muted }}>
              <Text className="text-sm font-semibold" style={{ color: danger }}>停止</Text>
            </Pressable>
            {phase === 'focus' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="跳到休息"
                onPress={() => { setPhase('break'); setRemaining(BREAK_MIN * 60); }}
                className="rounded-full px-6 py-3" style={{ backgroundColor: token('found', scheme) }}>
                <Text className="text-xs font-semibold" style={{ color: token('found-foreground', scheme) }}>跳到休息</Text>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="开始下一轮专注"
                onPress={() => { setPhase('focus'); setRemaining(FOCUS_MIN * 60); }}
                className="rounded-full px-6 py-3" style={{ backgroundColor: primary }}>
                <Text className="text-primary-foreground text-xs font-semibold">开始专注</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </Card>
  );
}
