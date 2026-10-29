/**
 * 折扣比较器:多商品单价比价 + 折扣实付,纯本地。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { SectionCard } from '@/components/business/feedback';
import { compareUnitPrices, type ShoppingItem } from '@/lib/calc/shopping';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

const inputStyle = (scheme: 'light' | 'dark') => ({
  color: token('foreground', scheme) as string,
  borderColor: token('border', scheme) as string,
});

export default function DiscountScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [items, setItems] = useState<ShoppingItem[]>([
    { name: '小包装', price: 10, quantity: 500, unit: 'ml' },
    { name: '大包装', price: 15, quantity: 1000, unit: 'ml' },
  ]);

  const results = useMemo(() => compareUnitPrices(items), [items]);

  const update = (index: number, field: keyof ShoppingItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'price' || field === 'quantity') return { ...item, [field]: Number(value) || 0 };
        return { ...item, [field]: value };
      }),
    );
  };

  const addItem = () => setItems((prev) => [...prev, { name: '', price: 0, quantity: 1, unit: '个' }]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">折扣比较</Text>
          <Text className="text-muted-foreground mt-1 text-sm">比单价 · 算折扣 · 离线可用</Text>
        </View>

        <SectionCard title="商品列表">
          {items.map((item, index) => {
            const result = results[index];
            const isBest = result?.isBest ?? false;
            return (
              <View key={index} className="mb-3 rounded-xl border border-border p-3">
                <View className="flex-row items-center justify-between">
                  <TextInput
                    className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
                    style={inputStyle(scheme)}
                    value={item.name}
                    onChangeText={(v) => update(index, 'name', v)}
                    placeholder="商品名"
                    accessibilityLabel={`商品${index + 1}名称`}
                  />
                  {items.length > 1 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="删除" onPress={() => removeItem(index)} className="ml-2 p-1">
                      <Text className="text-urgent text-sm">✕</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View className="mt-2 flex-row" style={{ gap: 6 }}>
                  <View className="flex-1">
                    <Text className="text-muted-foreground text-[10px]">价格(元)</Text>
                    <TextInput
                      className="rounded-lg border px-2 py-1.5 text-sm"
                      style={inputStyle(scheme)}
                      value={String(item.price) || ''}
                      onChangeText={(v) => update(index, 'price', v)}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`商品${index + 1}价格`}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-muted-foreground text-[10px]">数量</Text>
                    <TextInput
                      className="rounded-lg border px-2 py-1.5 text-sm"
                      style={inputStyle(scheme)}
                      value={String(item.quantity) || ''}
                      onChangeText={(v) => update(index, 'quantity', v)}
                      keyboardType="number-pad"
                      accessibilityLabel={`商品${index + 1}数量`}
                    />
                  </View>
                  <View className="w-16">
                    <Text className="text-muted-foreground text-[10px]">单位</Text>
                    <TextInput
                      className="rounded-lg border px-2 py-1.5 text-sm"
                      style={inputStyle(scheme)}
                      value={item.unit}
                      onChangeText={(v) => update(index, 'unit', v)}
                      accessibilityLabel={`商品${index + 1}单位`}
                    />
                  </View>
                </View>
                {result ? (
                  <View className="mt-1.5 flex-row items-center" style={{ gap: 4 }}>
                    <Text className={`text-xs font-semibold ${isBest ? 'text-found' : 'text-muted-foreground'}`}>
                      单价 {result.unitPrice.toFixed(2)} 元/{item.unit}
                      {isBest ? ' ✓ 最优' : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="添加商品"
            onPress={addItem}
            className="border-dashed mt-1 items-center rounded-lg border py-2"
            style={{ borderColor: token('border', scheme) }}
          >
            <Text className="text-muted-foreground text-sm">+ 添加商品</Text>
          </Pressable>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
