/**
 * 环境配置缺失时的启动兜底页。
 *
 * 契约与规格都要求"缺失基址时启动即报可读错误,不发出任何指向猜测地址的请求"。
 * 这里把它变成一屏能看懂的话,而不是一个红色异常框。
 */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EnvNotice({ message }: { message: string }) {
  return (
    <View className="flex-1 justify-center bg-background p-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-urgent">环境配置不完整,已停止启动</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollView>
            <Text className="text-sm leading-5">{message}</Text>
            <Text className="text-muted-foreground mt-4 text-xs leading-5">
              {'步骤:1) 复制 .env.example 为 .env;2) 填写 EXPO_PUBLIC_API_BASE_URL(dev 指向网关 8082);3) 重启 Metro。生产构建必须使用 HTTPS 与 WSS,应用会在启动时二次校验。'}
            </Text>
          </ScrollView>
        </CardContent>
      </Card>
    </View>
  );
}
