/**
 * 我的(spec: 身份与角色差异 / 资料与账号安全)。
 *
 * 未登录也能进这一页:浏览与收藏不要求登录(spec 明确要求角色差异不得变成浏览限制),
 * 只有"消息、线索、档案、资料"这些真正需要账号的入口才把用户引导去登录。
 * "帮助"不做假路由:它展开的是本页已有的合规与操作说明。
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  FolderHeart,
  Info,
  Lock,
  LogOut,
  MessageSquare,
  Star,
  SunMoon,
  User,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AntiFraudNotice, AgreementLinks } from '@/components/business/compliance';
import { NoticeBar, SectionCard } from '@/components/business/feedback';
import { GENDER_LABEL, IDENTITY_LABEL } from '@/lib/format';
import { env } from '@/lib/env';
import { useSession } from '@/store/session';
import { useBreakpoint, contentWidthStyle } from '@/hooks/useBreakpoint';
import { useAppearance } from '@/store/appearance';
import { useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';

export default function MeTabScreen() {
  const responsive = useBreakpoint();
  const router = useRouter();
  const { toast } = useToast();
  const mode = useAppearance((state) => state.mode);
  const setMode = useAppearance((state) => state.setMode);
  const { guard, signedIn } = useSessionGuard();

  const user = useSession((state) => state.user);
  const unread = useSession((state) => state.unreadCount);
  const needsProfileSetup = useSession((state) => state.needsProfileSetup);
  const storageKind = useSession((state) => state.storageKind);
  const signOut = useSession((state) => state.signOut);

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const openProtected = useCallback(
    (href: string, label: string) => {
      if (guard({ href, label })) return;
      // href 为运行时拼接的字符串,typed-routes 下断言宽化
      router.push(href as never);
    },
    [guard, router],
  );

  const doSignOut = useCallback(async () => {
    await signOut();
    setConfirmSignOut(false);
    toast('已退出登录,广场仍可浏览', 'success');
    router.replace('/(tabs)/plaza');
  }, [router, signOut, toast]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={[{ paddingBottom: 104 }, contentWidthStyle(responsive)]}>
        <View className="bg-card border-border mb-3 flex-row items-center gap-3 rounded-xl border p-4">
          <Avatar alt="头像" className="size-14">
            {user?.avatar ? <AvatarImage source={{ uri: user.avatar }} /> : null}
            <AvatarFallback>
              <Text>{(user?.nickname ?? '未').slice(0, 1)}</Text>
            </AvatarFallback>
          </Avatar>
          <View className="flex-1">
            {signedIn && user ? (
              <>
                <Text className="text-base font-semibold" numberOfLines={1}>
                  {user.nickname || '未设置昵称'}
                </Text>
                <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
                  {user.phone ? `手机号 ${user.phone}` : '未绑定手机号'} ·{' '}
                  {GENDER_LABEL[user.gender]}
                </Text>
                <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
                  <Badge variant="outline">
                    <Text>{IDENTITY_LABEL[user.identityType] ?? user.identityType}</Text>
                  </Badge>
                  {user.volunteerVerified ? (
                    <Badge variant="outline" className="border-found">
                      <Text className="text-found">志愿者已认证</Text>
                    </Badge>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <Text className="text-base font-semibold">未登录</Text>
                <Text className="text-muted-foreground mt-0.5 text-xs">
                  广场与档案详情无需登录;收藏、线索与发布需要。
                </Text>
                <Button
                  testID="me-login"
                  size="sm"
                  className="mt-2 self-start"
                  onPress={() => openProtected('/(tabs)/me', 'me')}
                >
                  <Icon as={User} size={14} className="text-primary-foreground" />
                  <Text>去登录</Text>
                </Button>
              </>
            )}
          </View>
        </View>

        {signedIn && needsProfileSetup ? (
          <NoticeBar
            tone="info"
            title="资料还没填完"
            lines={['身份类型与常驻地只用于入口排序与"就近"默认城市,跳过不影响其他功能。']}
          />
        ) : null}
        {signedIn && needsProfileSetup ? (
          <Button
            variant="outline"
            size="sm"
            className="mb-3"
            onPress={() => router.push('/auth/profile-setup')}
          >
            <Text>继续完善资料</Text>
          </Button>
        ) : null}

        {signedIn && !user?.boundPhone ? (
          <NoticeBar
            tone="warn"
            title="未绑定手机号"
            lines={['浏览与收藏不受影响,但提交线索前需要完成手机号验证。']}
          />
        ) : null}

        <SectionCard title="我的内容">
          <EntryRow
            icon={FolderHeart}
            label="我的档案"
            description="草稿、待审核、已发布、已驳回;续期 / 撤回 / 标记找回 / 申请删除"
            onPress={() => openProtected('/me/cases', 'my-cases')}
          />
          <EntryRow
            icon={MessageSquare}
            label="我的线索"
            description="我提交过的线索与处理状态"
            onPress={() => openProtected('/me/leads', 'my-leads')}
          />
          <EntryRow
            icon={Star}
            label="我的收藏"
            description="长按广场卡片收藏的档案"
            onPress={() => router.push('/me/favorites')}
          />
          <EntryRow
            icon={Bell}
            label="消息中心"
            description={unread > 0 ? `${unread} 条未读` : '审核结果、线索动态与找回喜报'}
            badge={unread > 0 ? String(unread) : undefined}
            onPress={() => router.replace('/(tabs)/message')}
          />
        </SectionCard>

        <SectionCard title="账号与偏好" className="mt-3">
          <EntryRow
            icon={User}
            label="资料"
            description="昵称、头像、性别、身份类型与常驻城市"
            onPress={() => openProtected('/me/profile-edit', 'profile-edit')}
          />
          <EntryRow
            icon={Lock}
            label="账号安全"
            description={
              signedIn && user?.hasPassword ? '已设置登录密码' : '尚未设置登录密码'
            }
            onPress={() => openProtected('/me/security', 'security')}
          />
          <EntryRow
            icon={Bell}
            label="通知偏好"
            description="站内信与短信提醒;审核结果类不可关闭"
            onPress={() => openProtected('/me/notification-pref', 'notification-pref')}
          />
          <EntryRow
            icon={SunMoon}
            label="外观"
            description={
              mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'
            }
            onPress={() => {
              const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
              void setMode(next);
              toast(next === 'system' ? '外观:跟随系统' : next === 'light' ? '外观:浅色' : '外观:深色', 'success');
            }}
          />
        </SectionCard>

        <SectionCard title="帮助与合规" className="mt-3">
          <Pressable
            testID="me-help-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: helpOpen }}
            onPress={() => setHelpOpen((current) => !current)}
            className="border-border flex-row items-center gap-3 border-b py-3"
          >
            <Icon as={Info} size={18} className="text-muted-foreground" />
            <View className="flex-1">
              <Text className="text-sm font-medium">常见问题与申诉途径</Text>
              <Text className="text-muted-foreground mt-0.5 text-xs">
                审核要多久、被驳回怎么办、如何撤回与删除
              </Text>
            </View>
            <Icon as={helpOpen ? ChevronDown : ChevronRight} size={16} className="text-muted-foreground" />
          </Pressable>

          {helpOpen ? (
            <View className="pt-1">
              <HelpLine
                question="提交后多久出审核结果?"
                answer="审核由人工完成,结果会以站内信通知你;通过后才出现在广场。一期没有承诺时限,超过三天无消息请联系运营方。"
              />
              <HelpLine
                question="档案被驳回了怎么办?"
                answer="在「我的档案」点「查看驳回理由」读取审核意见,再用「修改后重新提交」预填原内容,改完重新进入待审核。"
              />
              <HelpLine
                question="找到人了怎么关闭档案?"
                answer="在「我的档案」点「标记找回」,必须选择确认依据(警方 / 家属确认 / DNA 比对),成功后档案转为喜报版式并通知全部线索提交人。"
              />
              <HelpLine
                question="想撤下或删掉信息"
                answer="撤回只是不再公开展示,内容仍保留;申请删除会永久清除姓名、照片、详细地址等识别信息且不可恢复。"
              />
              <HelpLine
                question="收不到提醒"
                answer="一期没有系统级推送,关闭 App 后可能收不到实时提醒,重要消息请以站内信为准;通知偏好里可逐类开关。"
              />
              <View className="mt-2">
                <AgreementLinks version={env.AGREEMENT_VERSION} />
              </View>
              <Text className="text-muted-foreground mt-3 text-xs">
                本机会话存储实现:{storageKind}。如对处理结果有异议,请把档案编号发给运营方核实。
              </Text>
            </View>
          ) : null}
        </SectionCard>

        <View className="mt-3">
          <AntiFraudNotice />
        </View>

        {signedIn ? (
          <Button
            testID="me-sign-out"
            variant="outline"
            className="mt-4 h-11"
            onPress={() => setConfirmSignOut(true)}
          >
            <Icon as={LogOut} size={16} />
            <Text>退出登录</Text>
          </Button>
        ) : null}
      </ScrollView>

      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出当前账号?</AlertDialogTitle>
            <AlertDialogDescription>
              退出后本机 token 与用户信息会被清除;本机收藏与未同步的草稿副本仍保留。
              广场与档案详情仍可继续浏览。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>取消</Text>
            </AlertDialogCancel>
            <Button variant="destructive" onPress={() => void doSignOut()}>
              <Text>退出</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}

function EntryRow({
  icon,
  label,
  description,
  onPress,
  badge,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  label: string;
  description: string;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="border-border flex-row items-center gap-3 border-b py-3 last:border-b-0"
    >
      <Icon as={icon} size={18} className="text-muted-foreground" />
      <View className="flex-1">
        <Text className="text-sm font-medium">{label}</Text>
        <Text className="text-muted-foreground mt-0.5 text-xs">{description}</Text>
      </View>
      {badge ? (
        <Badge variant="destructive" className="bg-urgent">
          <Text>{badge}</Text>
        </Badge>
      ) : null}
      <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}

function HelpLine({ question, answer }: { question: string; answer: string }) {
  return (
    <View className="py-2">
      <Text className="text-sm font-medium">{question}</Text>
      <Text className="text-muted-foreground mt-1 text-xs leading-4">{answer}</Text>
    </View>
  );
}
