/**
 * 健康计算器:BMI(中国分级)+ BMR 基础代谢 + 每日饮水建议,纯本地。
 * 常驻免责声明:仅参考,不构成医疗建议。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/business/feedback';
import { bmiLevel, calcBmi, calcBmr, dailyWaterMl } from '@/lib/calc/health';
import { heartRateZones } from '@/lib/calc/fitness';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

type Gender = 'male' | 'female';

export default function HealthScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');

  const result = useMemo(() => {
    const h = Number(height);
    const w = Number(weight);
    const a = Number(age);
    if (!h || !w || !a) return null;
    const bmi = calcBmi(w, h);
    return {
      bmi,
      level: bmi === null ? null : bmiLevel(bmi),
      bmr: calcBmr(w, h, a, gender),
      water: dailyWaterMl(w),
    };
  }, [gender, height, weight, age]);

  const inputStyle = { color: token('foreground', scheme), borderColor: token('border', scheme) } as const;
  const levelColor = (level: string | null) =>
    level === '正常' ? 'text-found' : level === null || level === '偏瘦' ? 'text-muted-foreground' : 'text-urgent';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">健康计算器</Text>
          <Text className="text-muted-foreground mt-1 text-sm">BMI · 基础代谢 · 饮水建议 · 离线可用</Text>
        </View>

        <Card className="mb-3 p-4">
          <View className="mb-3 flex-row rounded-full bg-muted p-1">
            {(['male', 'female'] as const).map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === 'male' ? '男' : '女'}
                onPress={() => setGender(key)}
                className={`flex-1 items-center rounded-full py-2 ${gender === key ? 'bg-primary' : ''}`}
              >
                <Text
                  className={`text-sm font-semibold ${gender === key ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {key === 'male' ? '男' : '女'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Text className="text-muted-foreground mb-1 text-xs">年龄(岁)</Text>
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                accessibilityLabel="年龄"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground mb-1 text-xs">身高(cm)</Text>
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={height}
                onChangeText={setHeight}
                keyboardType="number-pad"
                accessibilityLabel="身高"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground mb-1 text-xs">体重(kg)</Text>
              <TextInput
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                accessibilityLabel="体重"
              />
            </View>
          </View>
        </Card>

        {result?.bmi != null ? (
          <>
            <SectionCard title="BMI 体重指数">
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground text-3xl font-bold">{result.bmi}</Text>
                <Text className={`text-base font-semibold ${levelColor(result.level)}`}>{result.level}</Text>
              </View>
              <Text className="text-muted-foreground mt-2 text-xs">
                中国成人标准:偏瘦 &lt;18.5 · 正常 18.5-24 · 超重 24-28 · 肥胖 ≥28
              </Text>
            </SectionCard>

            {result.bmr != null ? (
              <SectionCard title="基础代谢(BMR)" description="维持静息状态每日所需热量">
                <Text className="text-foreground text-2xl font-bold">{result.bmr} kcal/天</Text>
              </SectionCard>
            ) : null}

            {result.water != null ? (
              <SectionCard title="每日饮水建议">
                <Text className="text-foreground text-2xl font-bold">{result.water} ml</Text>
              </SectionCard>
            ) : null}
          </>
        ) : (
          <SectionCard title="请填写有效的年龄、身高与体重">{null}</SectionCard>
        )}

        {result?.bmr != null ? (
          <SectionCard title='心率训练区间' description='最大心率 = 220 - 年龄'>
            {(heartRateZones(Number(age)) ?? []).map((zone) => (
              <View key={zone.zone} className='mb-1.5 flex-row items-center justify-between rounded-lg border border-border px-3 py-2'>
                <View className='flex-1'>
                  <Text className='text-foreground text-sm font-medium'>{zone.label}</Text>
                  <Text className='text-muted-foreground text-xs'>{zone.purpose}</Text>
                </View>
                <Text className='text-primary text-sm font-bold'>{zone.min}-{zone.max} bpm</Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <Text className='text-muted-foreground mt-3 text-center text-xs leading-4'>
          计算结果仅作参考,不构成医疗建议;健康状况请咨询专业医生。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
