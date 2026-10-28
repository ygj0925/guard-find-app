/**
 * 计算器:即时执行型(类 iOS 基础),纯函数引擎(lib/calc/calculator),除零给错误态。
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/business/feedback';
import { appendDigit, applyOperation, formatDisplay, type Operator } from '@/lib/calc/calculator';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

type Phase =
  | { kind: 'typing'; text: string }
  | { kind: 'result'; value: number }
  | { kind: 'error'; message: string };

export default function CalculatorScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [phase, setPhase] = useState<Phase>({ kind: 'typing', text: '' });
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Operator | null>(null);

  const error = phase.kind === 'error';

  const inputDigit = useCallback(
    (digit: string) => {
      if (error) return;
      if (phase.kind !== 'typing') {
        // 结果态输入新数字:开新输入
        setPhase({ kind: 'typing', text: digit === '.' ? '0.' : digit });
        return;
      }
      setPhase({ kind: 'typing', text: appendDigit(phase.text, digit) });
    },
    [error, phase],
  );

  const currentValue = useCallback((): number => {
    if (phase.kind === 'typing') return Number(phase.text || '0');
    if (phase.kind === 'result') return phase.value;
    return 0;
  }, [phase]);

  const inputOperator = useCallback(
    (next: Operator) => {
      if (error) return;
      const current = currentValue();
      if (acc !== null && op !== null && phase.kind === 'typing') {
        // 链式:先结算上一段
        const settled = applyOperation(acc, current, op);
        if (settled === null) {
          setPhase({ kind: 'error', message: '除数不能为 0' });
          return;
        }
        setAcc(settled);
        setOp(next);
        setPhase({ kind: 'result', value: settled });
        return;
      }
      setAcc(phase.kind === 'result' && acc !== null && op === null ? current : current);
      setAcc(current);
      setOp(next);
      setPhase({ kind: 'typing', text: '' });
    },
    [acc, currentValue, error, op, phase],
  );

  const equals = useCallback(() => {
    if (error || acc === null || op === null) return;
    const settled = applyOperation(acc, currentValue(), op);
    if (settled === null) {
      setPhase({ kind: 'error', message: '除数不能为 0' });
      return;
    }
    setPhase({ kind: 'result', value: settled });
    setAcc(null);
    setOp(null);
  }, [acc, currentValue, error, op]);

  const clear = useCallback(() => {
    setPhase({ kind: 'typing', text: '' });
    setAcc(null);
    setOp(null);
  }, []);

  const negate = useCallback(() => {
    if (phase.kind === 'typing') {
      if (phase.text === '' || phase.text === '0') return;
      setPhase({ kind: 'typing', text: phase.text.startsWith('-') ? phase.text.slice(1) : `-${phase.text}` });
    } else if (phase.kind === 'result') {
      setPhase({ kind: 'result', value: -phase.value });
    }
  }, [phase]);

  const percent = useCallback(() => {
    if (phase.kind === 'typing') {
      const value = Number(phase.text || '0') / 100;
      setPhase({ kind: 'typing', text: String(value) });
    } else if (phase.kind === 'result') {
      setPhase({ kind: 'result', value: phase.value / 100 });
    }
  }, [phase]);

  const display =
    phase.kind === 'typing'
      ? phase.text === ''
        ? '0'
        : phase.text
      : phase.kind === 'result'
        ? formatDisplay(phase.value)
        : phase.message;

  const buttonText = (value: string) => {
    if (error) {
      // 错误态任意按键先清错
      clear();
    }
    if (/[0-9.]/.test(value)) inputDigit(value);
    else if (value === 'AC') clear();
    else if (value === '±') negate();
    else if (value === '%') percent();
    else if (value === '=') equals();
    else inputOperator(value as Operator);
  };

  const keys = [
    ['AC', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  const keyStyle = (key: string) => {
    const isOperator = ['÷', '×', '-', '+', '='].includes(key);
    const isAccent = key === '=';
    return {
      backgroundColor: isAccent
        ? token('primary', scheme)
        : isOperator
          ? token('accent', scheme)
          : token('muted', scheme),
    };
  };
  const keyTextClass = (key: string) =>
    key === '=' ? 'text-primary-foreground' : ['÷', '×', '-', '+'].includes(key) ? 'text-accent-foreground' : 'text-foreground';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 104, paddingHorizontal: 16 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">计算器</Text>
          <Text className="text-muted-foreground mt-1 text-sm">基础四则 · 离线可用</Text>
        </View>

        <Card className="mb-3 p-4">
          <Text
            className="text-foreground text-right text-5xl font-bold"
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel="计算器显示"
          >
            {display}
          </Text>
          {acc !== null && op ? (
            <Text className="text-muted-foreground mt-1 text-right text-xs">
              {formatDisplay(acc)} {op}
            </Text>
          ) : null}
        </Card>

        <SectionCard title="键盘">
          <View style={{ gap: 8 }}>
            {keys.map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row" style={{ gap: 8 }}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key === 'AC' ? '清空' : key}
                    onPress={() => buttonText(key)}
                    className={`items-center justify-center rounded-2xl ${key === '0' ? 'flex-[2]' : 'flex-1'}`}
                    style={{ height: 64, ...keyStyle(key) }}
                  >
                    <Text className={`text-xl font-semibold ${keyTextClass(key)}`}>{key}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
