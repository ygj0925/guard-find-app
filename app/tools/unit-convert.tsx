/**
 * 单位换算:长度/重量/温度/数据/面积,纯本地零接口。
 * 品类切换后单位回落到该品类前两个;温度走独立换算路径(lib/units/convert)。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/business/feedback';
import { UNIT_CATEGORIES, convert, formatConverted } from '@/lib/units/convert';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

export default function UnitConvertScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [categoryKey, setCategoryKey] = useState('length');
  const [fromCode, setFromCode] = useState('m');
  const [toCode, setToCode] = useState('km');
  const [input, setInput] = useState('1');

  const category = UNIT_CATEGORIES.find((item) => item.key === categoryKey) ?? UNIT_CATEGORIES[0];

  const switchCategory = (key: string) => {
    setCategoryKey(key);
    const next = UNIT_CATEGORIES.find((item) => item.key === key);
    if (next) {
      setFromCode(next.units[0].code);
      setToCode(next.units[1]?.code ?? next.units[0].code);
    }
  };

  const result = useMemo(() => {
    const value = Number(input);
    return convert(categoryKey, value, fromCode, toCode);
  }, [categoryKey, input, fromCode, toCode]);

  const fromLabel = category.units.find((unit) => unit.code === fromCode)?.label ?? '';
  const toLabel = category.units.find((unit) => unit.code === toCode)?.label ?? '';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-2xl font-bold">单位换算</Text>
          <Text className="text-muted-foreground mt-1 text-sm">离线可用 · 五类常用单位</Text>
        </View>

        {/* 品类选择 */}
        <View className="mb-3 flex-row flex-wrap" style={{ gap: 8 }}>
          {UNIT_CATEGORIES.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={item.key === categoryKey ? { selected: true } : {}}
              onPress={() => switchCategory(item.key)}
              className="rounded-full border px-4 py-1.5"
              style={{
                borderColor: item.key === categoryKey ? token('primary', scheme) : token('border', scheme),
                backgroundColor: item.key === categoryKey ? token('accent', scheme) : 'transparent',
              }}
            >
              <Text
                className={`text-sm ${item.key === categoryKey ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card className="mb-3 p-4">
          {/* 输入区 */}
          <Text className="text-muted-foreground text-xs">输入({fromLabel})</Text>
          <TextInput
            className="text-foreground mt-1 text-3xl font-bold"
            style={{ color: token('foreground', scheme) }}
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel="换算输入值"
          />

          {/* 交换按钮 */}
          <View className="my-2 flex-row items-center" style={{ gap: 8 }}>
            <View className="bg-muted h-px flex-1" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="交换单位"
              onPress={() => {
                setFromCode(toCode);
                setToCode(fromCode);
              }}
              className="bg-accent rounded-full px-4 py-1"
            >
              <Text className="text-accent-foreground text-xs font-semibold">⇅ 交换</Text>
            </Pressable>
            <View className="bg-muted h-px flex-1" />
          </View>

          {/* 结果区 */}
          <Text className="text-muted-foreground text-xs">结果({toLabel})</Text>
          <Text
            className="mt-1 text-3xl font-bold"
            style={{ color: token('primary', scheme) }}
            accessibilityLabel="换算结果"
          >
            {formatConverted(result)}
          </Text>
        </Card>

        {/* 单位选择 */}
        <SectionCard title="选择单位">
          <View className="mb-2 flex-row flex-wrap" style={{ gap: 6 }}>
            {category.units.map((unit) => (
              <Pressable
                key={`from:${unit.code}`}
                accessibilityRole="button"
                accessibilityLabel={`从 ${unit.label}`}
                accessibilityState={unit.code === fromCode ? { selected: true } : {}}
                onPress={() => setFromCode(unit.code)}
                className="rounded-lg border px-3 py-1.5"
                style={{
                  borderColor: unit.code === fromCode ? token('primary', scheme) : token('border', scheme),
                  backgroundColor: unit.code === fromCode ? token('primary', scheme) : 'transparent',
                }}
              >
                <Text
                  className={`text-xs ${unit.code === fromCode ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}
                >
                  {unit.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-muted-foreground mb-1 text-xs">换算到</Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {category.units.map((unit) => (
              <Pressable
                key={`to:${unit.code}`}
                accessibilityRole="button"
                accessibilityLabel={`到 ${unit.label}`}
                accessibilityState={unit.code === toCode ? { selected: true } : {}}
                onPress={() => setToCode(unit.code)}
                className="rounded-lg border px-3 py-1.5"
                style={{
                  borderColor: unit.code === toCode ? token('found', scheme) : token('border', scheme),
                  backgroundColor: unit.code === toCode ? token('accent', scheme) : 'transparent',
                }}
              >
                <Text
                  className={`text-xs ${unit.code === toCode ? 'text-found font-semibold' : 'text-muted-foreground'}`}
                >
                  {unit.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
