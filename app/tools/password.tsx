/**
 * 密码生成器:可配置长度/字符集/排除混淆,密码学安全随机,强度评分。
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/business/feedback';
import { generatePassword, passwordStrength, STRENGTH_LABELS } from '@/lib/calc/password';
import { clipboard } from '@/lib/capabilities';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';

interface Options {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const STRENGTH_COLOR = ['text-urgent', 'text-urgent', 'text-pending', 'text-found', 'text-found'];

export default function PasswordScreen() {
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const [options, setOptions] = useState<Options>({
    length: 16, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: true,
  });
  const [password, setPassword] = useState('');

  const generate = useCallback(() => {
    const result = generatePassword(options);
    if (result) setPassword(result);
  }, [options]);

  const copy = useCallback(async () => {
    const result = await clipboard.copy(password);
    toast(result.ok ? '已复制到剪贴板' : '复制失败,请长按密码手动复制', result.ok ? 'success' : 'warn');
  }, [password, toast]);

  const strength = passwordStrength(password);
  const strengthLabel = STRENGTH_LABELS[strength];

  const toggle = (key: keyof Omit<Options, 'length'>) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleRow = (label: string, key: keyof Omit<Options, 'length'>) => (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: options[key] }}
      accessibilityLabel={label}
      onPress={() => toggle(key)}
      className="flex-row items-center justify-between py-2"
    >
      <Text className="text-foreground text-sm">{label}</Text>
      <View
        className="h-6 w-11 items-center rounded-full"
        style={{ backgroundColor: options[key] ? token('primary', scheme) : token('muted', scheme) }}
      >
        <View
          className="h-5 w-5 rounded-full bg-white"
          style={{
            alignSelf: options[key] ? 'flex-end' : 'flex-start',
            marginRight: options[key] ? 2 : 0,
            marginLeft: options[key] ? 0 : 2,
          }}
        />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2">
          <Text className="text-2xl font-bold">密码生成器</Text>
          <Text className="text-muted-foreground mt-1 text-sm">密码学安全随机 · 离线可用</Text>
        </View>

        {password ? (
          <Card className="mb-3 p-4">
            <Text className="text-foreground text-center text-xl font-bold leading-6" selectable accessibilityLabel="生成的密码">
              {password}
            </Text>
            <Text className={`mt-3 text-center text-xs font-semibold ${STRENGTH_COLOR[strength]}`}>
              强度:{strengthLabel}
            </Text>
            <View className="mt-3 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={generate}>
                <Text>重新生成</Text>
              </Button>
              <Button className="flex-1" onPress={() => void copy()}>
                <Text>复制</Text>
              </Button>
            </View>
          </Card>
        ) : null}

        <SectionCard title="生成选项">
          <View className="mb-3">
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-foreground text-sm">长度</Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Pressable
                  accessibilityRole="button" accessibilityLabel="减少长度"
                  onPress={() => setOptions((prev) => ({ ...prev, length: Math.max(4, prev.length - 1) }))}
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: token('muted', scheme) }}
                >
                  <Text className="text-sm">-</Text>
                </Pressable>
                <Text className="text-foreground w-8 text-center text-lg font-bold">{options.length}</Text>
                <Pressable
                  accessibilityRole="button" accessibilityLabel="增加长度"
                  onPress={() => setOptions((prev) => ({ ...prev, length: Math.min(128, prev.length + 1) }))}
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: token('muted', scheme) }}
                >
                  <Text className="text-sm">+</Text>
                </Pressable>
              </View>
            </View>
            {toggleRow('大写字母 (A-Z)', 'uppercase')}
            {toggleRow('小写字母 (a-z)', 'lowercase')}
            {toggleRow('数字 (0-9)', 'digits')}
            {toggleRow('符号 (!@#$…)', 'symbols')}
            {toggleRow('排除易混淆 (0O1lI)', 'excludeAmbiguous')}
          </View>
          <Button onPress={generate}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon as={RefreshCw} size={14} className="text-primary-foreground" />
              <Text>{password ? '重新生成' : '生成密码'}</Text>
            </View>
          </Button>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
