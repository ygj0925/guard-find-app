/**
 * 文本工具箱:字数统计 / 时间戳互转 / 进制转换 / JSON 格式化,纯本地。
 * 四个子功能共用一页,分段切换;输入输出都是纯文本框。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/business/feedback';
import { convertRadix, countChars, dateToTimestamp, formatJson, timestampToDate } from '@/lib/textkit/kit';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

type SubTool = 'count' | 'timestamp' | 'radix' | 'json';

const SUB_TOOLS: { key: SubTool; label: string }[] = [
  { key: 'count', label: '字数统计' },
  { key: 'timestamp', label: '时间戳' },
  { key: 'radix', label: '进制' },
  { key: 'json', label: 'JSON' },
];

const RADIXES = [2, 8, 10, 16] as const;

export default function TextToolkitScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [tool, setTool] = useState<SubTool>('count');
  const [input, setInput] = useState('');
  const [fromRadix, setFromRadix] = useState<2 | 8 | 10 | 16>(10);
  const [toRadix, setToRadix] = useState<2 | 8 | 10 | 16>(16);

  const output = useMemo(() => {
    switch (tool) {
      case 'count': {
        const stats = countChars(input);
        return `字符 ${stats.chars} · 不含空白 ${stats.charsNoWhitespace} · 汉字 ${stats.cjk} · 英文单词 ${stats.words} · 行数 ${stats.lines}`;
      }
      case 'timestamp': {
        if (input.trim() === '') return '';
        if (/^\d+$/.test(input.trim())) {
          return timestampToDate(input.trim()) ?? '无法识别的时间戳(需 10 位秒或 13 位毫秒)';
        }
        const ts = dateToTimestamp(input);
        return ts === null ? '日期格式应为 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss' : `秒级时间戳:${ts}`;
      }
      case 'radix': {
        const converted = convertRadix(input, fromRadix, toRadix);
        return converted ?? '无法转换(请检查数值与进制)';
      }
      case 'json': {
        if (input.trim() === '') return '';
        const formatted = formatJson(input);
        return formatted.ok ? formatted.text : `解析失败:${formatted.error}`;
      }
    }
  }, [tool, input, fromRadix, toRadix]);

  const inputStyle = { color: token('foreground', scheme), borderColor: token('border', scheme) } as const;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2">
          <Text className="text-2xl font-bold">文本工具箱</Text>
          <Text className="text-muted-foreground mt-1 text-sm">字数 · 时间戳 · 进制 · JSON · 离线可用</Text>
        </View>

        <View className="mb-3 flex-row flex-wrap" style={{ gap: 8 }}>
          {SUB_TOOLS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => setTool(item.key)}
              className="rounded-full border px-4 py-1.5"
              style={{
                borderColor: tool === item.key ? token('primary', scheme) : token('border', scheme),
                backgroundColor: tool === item.key ? token('accent', scheme) : 'transparent',
              }}
            >
              <Text className={`text-sm ${tool === item.key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card className="mb-3 p-4">
          <Text className="text-muted-foreground mb-1 text-xs">输入</Text>
          <TextInput
            className="min-h-24 rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
            value={input}
            onChangeText={setInput}
            multiline
            placeholder={
              tool === 'count'
                ? '粘贴任意文本'
                : tool === 'timestamp'
                  ? '10/13 位时间戳 或 yyyy-MM-dd HH:mm:ss'
                  : tool === 'radix'
                    ? '要转换的数值'
                    : '粘贴 JSON'
            }
            placeholderTextColor={token('muted-foreground', scheme)}
            accessibilityLabel="输入内容"
          />

          {tool === 'radix' ? (
            <View className="mt-3" style={{ gap: 6 }}>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-muted-foreground w-14 text-xs">从进制</Text>
                {RADIXES.map((radix) => (
                  <Pressable
                    key={`f:${radix}`}
                    onPress={() => setFromRadix(radix)}
                    className="rounded-lg border px-3 py-1"
                    style={{
                      borderColor: fromRadix === radix ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: fromRadix === radix ? token('primary', scheme) : 'transparent',
                    }}
                  >
                    <Text
                      className={`text-xs ${fromRadix === radix ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}
                    >
                      {radix} 进制
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-muted-foreground w-14 text-xs">到进制</Text>
                {RADIXES.map((radix) => (
                  <Pressable
                    key={`t:${radix}`}
                    onPress={() => setToRadix(radix)}
                    className="rounded-lg border px-3 py-1"
                    style={{
                      borderColor: toRadix === radix ? token('found', scheme) : token('border', scheme),
                      backgroundColor: toRadix === radix ? token('accent', scheme) : 'transparent',
                    }}
                  >
                    <Text
                      className={`text-xs ${toRadix === radix ? 'text-found font-semibold' : 'text-muted-foreground'}`}
                    >
                      {radix} 进制
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        <SectionCard title="结果">
          <Text
            className={`text-sm leading-5 ${output.startsWith('无法') || output.startsWith('解析失败') ? 'text-urgent' : 'text-foreground'}`}
            selectable
          >
            {output || '等待输入…'}
          </Text>
          {tool === 'radix' && output ? (
            <TextInput
              className="border-border mt-2 rounded-lg border px-3 py-2 text-xs"
              style={inputStyle}
              value={output}
              editable={false}
              accessibilityLabel="转换结果"
            />
          ) : null}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
