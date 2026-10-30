/**
 * 亲戚称呼计算器:逐步选择关系路径,实时显示称呼。
 * 三代内常用关系,纯本地。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/business/feedback';
import { availableSteps, kinshipTitle, KINSHIP_STEPS } from '@/lib/calc/kinship';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

export default function KinshipScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [path, setPath] = useState('');

  const title = useMemo(() => kinshipTitle(path), [path]);
  const pathLabels = useMemo(() => {
    return path.replace(/(ob|lb|os|ls)/g, ' $1 ').trim().split(/\s+/).map((code) => {
      const step = KINSHIP_STEPS.find((s) => s.code === code);
      return step?.label ?? code;
    });
  }, [path]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">亲戚称呼</Text>
          <Text className="text-muted-foreground mt-1 text-sm">逐步选择关系路径,称呼实时计算</Text>
        </View>

        <Card className="mb-3 items-center p-6">
          <Text className="text-muted-foreground text-xs">称呼</Text>
          <Text className="text-primary mt-1 text-4xl font-bold" accessibilityLabel="称呼结果">
            {title ?? '未收录'}
          </Text>
          {pathLabels.length > 0 ? (
            <Text className="text-muted-foreground mt-2 text-xs">{pathLabels.join(' 的 ')}</Text>
          ) : null}
        </Card>

        {path.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="退回一步"
            onPress={() => setPath((prev) => {
              // 退回一步:删除最后一个有效编码
              const codes = prev.match(/(ob|lb|os|ls|[fm sdhw])/g) ?? [];
              codes.pop();
              return codes.join('');
            })}
            className="mb-3 self-center rounded-full px-6 py-2"
            style={{ backgroundColor: token('muted', scheme) }}
          >
            <Text className="text-foreground text-sm">↩ 退回一步</Text>
          </Pressable>
        ) : null}

        <SectionCard title="选择关系步骤">
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {availableSteps().map((step) => (
              <Pressable
                key={step.code}
                accessibilityRole="button"
                accessibilityLabel={step.label}
                onPress={() => setPath((prev) => prev + step.code)}
                className="rounded-full border px-4 py-2"
                style={{ borderColor: token('border', scheme) }}
              >
                <Text className="text-foreground text-sm">{step.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-muted-foreground mt-3 text-xs">
            从「我」出发逐步选择,如「爸爸」 → 「哥哥」 = 伯父。支持三代内常用关系。
          </Text>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
