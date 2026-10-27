/**
 * 社区占位页(spec Non-Goals:社区/UGC 动态不在一期范围)。
 *
 * 这里不放任何示例帖、热度数字或"即将上线"的倒计时 —— 契约 v1 里没有任何
 * 社区相关端点,编不出真数据就只能放假数据。页面只说明当前状态,并把人送回能用起来的广场。
 */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, Newspaper } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { NoticeBar, SectionCard } from '@/components/business/feedback';

export default function CommunityTabScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="flex-row items-center gap-2 pb-3 pt-2">
          <Icon as={BookOpen} size={20} className="text-muted-foreground" />
          <Text className="text-xl font-bold">社区</Text>
        </View>

        <NoticeBar
          tone="info"
          title="社区将在后续版本开放"
          lines={[
            '一期没有开放任何社区功能:没有帖子、没有评论、也没有关注关系。',
            '这一页保持空白而不是放示例内容,是因为服务端还没有对应的社区接口,任何数字都会是假的。',
          ]}
        />

        <SectionCard title="现在能做什么" description="寻人闭环的四个环节都已上线">
          <BulletLine text="在广场按最新 / 紧急 / 就近 / 喜报四条流查看寻人档案。" />
          <BulletLine text={'在档案详情页长按卡片收藏,或点"提交线索"把你看到的情况转给家属。'} />
          <BulletLine text="在发布页填写五步表单发布新的寻人档案,提交后进入人工审核。" />
          <BulletLine text="在消息中心接收审核结果、线索动态与找回喜报。" />
          <Button
            testID="community-go-plaza"
            className="mt-4 h-11"
            onPress={() => router.replace('/(tabs)/plaza')}
          >
            <Icon as={Newspaper} size={16} className="text-primary-foreground" />
            <Text>去寻人广场</Text>
          </Button>
        </SectionCard>

        <Text className="text-muted-foreground mt-4 text-xs leading-4">
          社区开放后,这一页会承载志愿者招募、经验交流与线下协作帖;它与寻人档案的线索处置是分开的两条线,
          不会把未审核的内容混进广场。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function BulletLine({ text }: { text: string }) {
  return (
    <View className="flex-row gap-2 py-1">
      <Text className="text-muted-foreground">·</Text>
      <Text className="flex-1 text-sm leading-5">{text}</Text>
    </View>
  );
}
