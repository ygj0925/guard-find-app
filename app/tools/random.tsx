/**
 * 随机决定器:转盘(选项轮盘)+ 掷骰子 + 抛硬币,纯本地 Animated 实现。
 * 转盘用旋转角度动画落到随机扇区,不做真绘扇形(纯 View 拼图,鸿蒙无 svg 依赖负担)。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Coins, Dices, Disc3 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/business/feedback';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

type Mode = 'wheel' | 'dice' | 'coin';

export default function RandomScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [mode, setMode] = useState<Mode>('wheel');
  const [options, setOptions] = useState('火锅\n烧烤\n面条\n汉堡');
  const [dice, setDice] = useState<number | null>(null);
  const [coin, setCoin] = useState<'正面' | '反面' | null>(null);
  // useState 惰性初始化持有 Animated.Value(规则禁止渲染期访问 ref.current)
  const [spin] = useState(() => new Animated.Value(0));
  const [spinning, setSpinning] = useState(false);

  const optionList = useMemo(
    () =>
      options
        .split(/[\n,，、]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12),
    [options],
  );

  const showResult = useCallback((result: string) => {
    Alert.alert('决定就是', result);
  }, []);

  const spinWheel = useCallback(() => {
    if (optionList.length < 2 || spinning) return;
    setSpinning(true);
    const rounds = 4 + Math.floor(Math.random() * 3);
    const target = Math.random() * 360;
    Animated.timing(spin, {
      toValue: rounds * 360 + target,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // 指针固定在正上方:命中 = ((360 - 落点) % 360) / 360 * 选项数
      const index = Math.floor((((360 - (target % 360)) % 360) / 360) * optionList.length);
      setSpinning(false);
      const picked = optionList[index % optionList.length];
      globalThis.setTimeout(() => {
        spin.setValue(0);
        showResult(picked);
      }, 120);
    });
  }, [optionList, spin, spinning, showResult]);

  const rollDice = useCallback(() => {
    const value = 1 + Math.floor(Math.random() * 6);
    setDice(null);
    setTimeout(() => setDice(value), 350);
  }, []);

  const flipCoin = useCallback(() => {
    setCoin(null);
    setTimeout(() => setCoin(Math.random() < 0.5 ? '正面' : '反面'), 350);
  }, []);

  const inputStyle = { color: token('foreground', scheme), borderColor: token('border', scheme) } as const;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-2xl font-bold">随机决定器</Text>
          <Text className="text-muted-foreground mt-1 text-sm">选择困难症专用 · 离线可用</Text>
        </View>

        <View className="mb-3 flex-row rounded-full bg-muted p-1">
          {(
            [
              { key: 'wheel', label: '转盘', icon: Disc3 },
              { key: 'dice', label: '骰子', icon: Dices },
              { key: 'coin', label: '硬币', icon: Coins },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => setMode(item.key)}
              className={`flex-1 flex-row items-center justify-center rounded-full py-2 ${mode === item.key ? 'bg-primary' : ''}`}
              style={{ gap: 4 }}
            >
              <Icon
                as={item.icon}
                size={14}
                className={mode === item.key ? 'text-primary-foreground' : 'text-muted-foreground'}
              />
              <Text
                className={`text-sm font-semibold ${mode === item.key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'wheel' ? (
          <>
            <Card className="items-center p-6">
              <Animated.View
                className="h-44 w-44 items-center justify-center rounded-full"
                style={{
                  transform: [{ rotate: spin }],
                  backgroundColor: token('accent', scheme),
                  borderWidth: 6,
                  borderColor: token('primary', scheme),
                }}
              >
                <View className="items-center">
                  {optionList.slice(0, 8).map((option, index) => (
                    <Text
                      key={`${option}:${index}`}
                      className="text-accent-foreground text-xs"
                      style={{ opacity: 1 - index * 0.1 }}
                    >
                      {option}
                    </Text>
                  ))}
                </View>
              </Animated.View>
              <View
                className="absolute top-2 self-center"
                style={{ width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: token('primary', scheme) }}
              />
              <Text className="text-muted-foreground mt-3 text-xs">▲ 指针指向的选项</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="开始转盘"
                onPress={spinWheel}
                disabled={optionList.length < 2 || spinning}
                className="bg-primary mt-3 rounded-full px-8 py-2.5"
              >
                <Text className="text-primary-foreground text-sm font-semibold">
                  {spinning ? '转动中…' : '开始!'}
                </Text>
              </Pressable>
            </Card>

            <SectionCard title="选项(每行一个,最多 12 个)">
              <TextInput
                className="min-h-24 rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={options}
                onChangeText={setOptions}
                multiline
                accessibilityLabel="转盘选项"
              />
            </SectionCard>
          </>
        ) : null}

        {mode === 'dice' ? (
          <Card className="items-center p-8">
            <Text className="text-muted-foreground text-sm">{dice === null ? '点击按钮掷骰子' : '点数是'}</Text>
            <Text className="text-primary my-4 text-7xl font-bold" accessibilityLabel="骰子点数">
              {dice ?? '🎲'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="掷骰子"
              onPress={rollDice}
              className="bg-primary rounded-full px-8 py-2.5"
            >
              <Text className="text-primary-foreground text-sm font-semibold">掷骰子</Text>
            </Pressable>
          </Card>
        ) : null}

        {mode === 'coin' ? (
          <Card className="items-center p-8">
            <Text className="text-muted-foreground text-sm">{coin === null ? '点击按钮抛硬币' : '结果是'}</Text>
            <Text className="text-primary my-4 text-5xl font-bold" accessibilityLabel="硬币结果">
              {coin ?? '🪙'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="抛硬币"
              onPress={flipCoin}
              className="bg-primary rounded-full px-8 py-2.5"
            >
              <Text className="text-primary-foreground text-sm font-semibold">抛硬币</Text>
            </Pressable>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
