/**
 * 房贷计算器:等额本息/等额本金双模式,纯本地计算(lib/calc/mortgage)。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/business/feedback';
import { calcMortgage, EQUAL_INSTALLMENT, EQUAL_PRINCIPAL, type MortgageMethod } from '@/lib/calc/mortgage';
import { formatAmount } from '@/lib/ledger/stats';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

export default function MortgageScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [method, setMethod] = useState<MortgageMethod>(EQUAL_INSTALLMENT);
  const [amountWan, setAmountWan] = useState('100');
  const [rate, setRate] = useState('3.1');
  const [years, setYears] = useState('30');

  const result = useMemo(
    () =>
      calcMortgage(
        { principal: Number(amountWan) * 10_000, annualRatePercent: Number(rate), years: Number(years) },
        method,
      ),
    [amountWan, rate, years, method],
  );

  const inputStyle = {
    color: token('foreground', scheme),
    borderColor: token('border', scheme),
  } as const;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-2xl font-bold">房贷计算器</Text>
          <Text className="text-muted-foreground mt-1 text-sm">等额本息 · 等额本金 · 离线可用</Text>
        </View>

        <View className="mb-3 flex-row rounded-full bg-muted p-1">
          {([EQUAL_INSTALLMENT, EQUAL_PRINCIPAL] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === EQUAL_INSTALLMENT ? '等额本息' : '等额本金'}
              onPress={() => setMethod(key)}
              className={`flex-1 items-center rounded-full py-2 ${method === key ? 'bg-primary' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${method === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {key === EQUAL_INSTALLMENT ? '等额本息' : '等额本金'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card className="mb-3 p-4">
          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Text className="text-muted-foreground mb-1 text-xs">贷款金额(万)</Text>
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={amountWan}
                onChangeText={setAmountWan}
                keyboardType="decimal-pad"
                accessibilityLabel="贷款金额"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground mb-1 text-xs">年利率(%)</Text>
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={rate}
                onChangeText={setRate}
                keyboardType="decimal-pad"
                accessibilityLabel="年利率"
              />
            </View>
            <View className="w-20">
              <Text className="text-muted-foreground mb-1 text-xs">年限</Text>
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={years}
                onChangeText={setYears}
                keyboardType="number-pad"
                accessibilityLabel="贷款年限"
              />
            </View>
          </View>
        </Card>

        {result ? (
          <>
            <SectionCard title={method === EQUAL_INSTALLMENT ? '每月还款(固定)' : '首月最高,逐月递减'}>
              <View className="flex-row">
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">首月</Text>
                  <Text className="text-urgent mt-1 text-xl font-bold">{formatAmount(result.firstMonth)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">末月</Text>
                  <Text className="mt-1 text-xl font-bold">{formatAmount(result.lastMonth)}</Text>
                </View>
              </View>
            </SectionCard>

            <SectionCard title="总账">
              <View className="flex-row">
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">利息总额</Text>
                  <Text className="text-urgent mt-1 text-lg font-bold">{formatAmount(result.totalInterest)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">还款总额</Text>
                  <Text className="mt-1 text-lg font-bold">{formatAmount(result.totalPayment)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">总期数</Text>
                  <Text className="mt-1 text-lg font-bold">{result.monthly.length} 期</Text>
                </View>
              </View>
            </SectionCard>
          </>
        ) : (
          <SectionCard title="请输入有效的金额、利率与年限">{null}</SectionCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
