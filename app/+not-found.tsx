/**
 * 路由兜底页。模板版依赖 ThemedText/ThemedView(已随任务 1.7 清理),
 * 这里改用 UI 原语,并给出可点的回首页入口 —— 不能让未匹配路由停在空白页。
 */
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center bg-background p-5">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>页面不存在</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-muted-foreground text-sm leading-5">
            链接可能已失效,或该功能尚未在本版本开放。广场与档案详情仍可正常访问。
          </Text>
          <Button className="mt-4" onPress={() => router.replace('/(tabs)/plaza')}>
            <Text>回到广场</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
