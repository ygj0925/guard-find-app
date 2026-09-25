/**
 * 账号安全(spec: 资料与账号安全 / 契约 1 节)。
 *
 * 四块内容:登录密码、手机号绑定状态、退出登录、申请注销。
 * 两处诚实说明:
 *   1. 契约 v1 没有"换绑手机"端点(只有 `POST /app/auth/sms-code` 的 `BIND` 场景与登录),
 *      所以这一页只报当前绑定状态与可行路径,不假装能在线换绑;
 *   2. 注销是"申请":服务端回 `{cooldownDays, deadline}`,冷静期内重新登录即可撤销,
 *      我们原样展示返回值,不写死 15 天。
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { KeyRound, LogOut, Smartphone } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
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
import { CheckboxField, TextField } from '@/components/form/fields';
import { NoticeBar, SectionCard } from '@/components/business/feedback';
import { AgreementLinks } from '@/components/business/compliance';
import { authApi, type EraseAccountResp } from '@/lib/api/endpoints/auth';
import { toUserMessage } from '@/lib/api/error';
import { REAL_NAME_STATUS_LABEL, formatDateTime } from '@/lib/format';
import { env } from '@/lib/env';
import { useSession } from '@/store/session';
import { useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';

const MIN_PASSWORD_LENGTH = 8;

export default function SecurityScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { guard, signedIn } = useSessionGuard();

  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const refreshUser = useSession((state) => state.refreshUser);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [eraseReason, setEraseReason] = useState('');
  const [eraseAck, setEraseAck] = useState(false);
  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);
  const [eraseResult, setEraseResult] = useState<EraseAccountResp | null>(null);

  const hasPassword = Boolean(user?.hasPassword);

  const submitPassword = useCallback(async () => {
    setPasswordError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`新密码至少 ${MIN_PASSWORD_LENGTH} 位`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    if (hasPassword && !oldPassword) {
      setPasswordError('请先输入当前密码');
      return;
    }
    setPasswordSaving(true);
    try {
      await authApi.changePassword({
        ...(hasPassword ? { oldPassword } : {}),
        newPassword,
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(hasPassword ? '密码已修改,请用新密码重新登录' : '登录密码已设置', 'success');
      void refreshUser();
    } catch (error) {
      // 4001 的字段级原因由服务端 msg 给出,原文展示,不替换成通用"修改失败"。
      setPasswordError(toUserMessage(error));
    } finally {
      setPasswordSaving(false);
    }
  }, [confirmPassword, hasPassword, newPassword, oldPassword, refreshUser, toast]);

  const doSignOut = useCallback(async () => {
    await signOut();
    toast('已退出登录', 'success');
    router.replace('/(tabs)/plaza');
  }, [router, signOut, toast]);

  const submitErase = useCallback(async () => {
    setEraseConfirmOpen(false);
    setEraseAck(false);
    try {
      const resp = await authApi.deleteAccount(eraseReason.trim());
      setEraseResult(resp ?? { cooldownDays: 0, deadline: '' });
      setEraseReason('');
      await signOut();
    } catch (error) {
      toast(toUserMessage(error), 'error');
    }
  }, [eraseReason, signOut, toast]);

  if (eraseResult) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
          <NoticeBar
            tone="warn"
            title="注销申请已提交"
            lines={[
              `冷静期 ${eraseResult.cooldownDays} 天,截止 ${formatDateTime(eraseResult.deadline)}。`,
              '冷静期内用原手机号重新登录即可撤销申请;期满后按公示规则清除数据。',
              '你的档案会清除姓名、照片、详细地址等识别信息,历史线索不再关联到你的账号。',
            ]}
          />
          <Button className="mt-3" onPress={() => router.replace('/(tabs)/plaza')}>
            <Text>返回广场</Text>
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!signedIn || !user) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-4">
          <NoticeBar
            tone="info"
            title="登录后管理账号安全"
            lines={['设置密码、查看绑定状态与申请注销都需要先确认身份。']}
          />
          <Button
            testID="security-login"
            onPress={() => guard({ href: '/me/security', label: 'security' })}
          >
            <Text>去登录</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <SectionCard
          title={hasPassword ? '修改登录密码' : '设置登录密码'}
          description={
            hasPassword
              ? '需要验证当前密码;修改后当前登录状态仍可用,下次登录用新密码。'
              : '设置后可在登录页用"账号密码"方式登录。'
          }
        >
          {hasPassword ? (
            <TextField
              label="当前密码"
              testID="security-old-password"
              value={oldPassword}
              secureTextEntry
              maxLength={32}
              onChangeText={setOldPassword}
            />
          ) : null}
          <TextField
            label="新密码"
            testID="security-new-password"
            value={newPassword}
            secureTextEntry
            maxLength={32}
            hint={`至少 ${MIN_PASSWORD_LENGTH} 位;服务端还会校验强度,不通过会给出具体原因`}
            onChangeText={setNewPassword}
          />
          <TextField
            label="确认新密码"
            testID="security-confirm-password"
            value={confirmPassword}
            secureTextEntry
            maxLength={32}
            onChangeText={setConfirmPassword}
          />
          {passwordError ? (
            <Text accessibilityRole="alert" className="text-urgent mb-2 text-sm">
              {passwordError}
            </Text>
          ) : null}
          <Button
            testID="security-password-submit"
            disabled={passwordSaving}
            onPress={() => void submitPassword()}
          >
            <Icon as={KeyRound} size={15} className="text-primary-foreground" />
            <Text>{passwordSaving ? '提交中' : hasPassword ? '确认修改' : '确认设置'}</Text>
          </Button>
        </SectionCard>

        <SectionCard title="手机号绑定" className="mt-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Smartphone} size={16} className="text-muted-foreground" />
            <Text className="flex-1 text-sm">{user.phone ?? '未绑定手机号'}</Text>
            <Badge variant={user.boundPhone ? 'outline' : 'destructive'} className="bg-urgent">
              <Text>{user.boundPhone ? '已绑定' : '未绑定'}</Text>
            </Badge>
          </View>
          <Text className="text-muted-foreground mt-2 text-xs leading-4">
            手机号是登录与找回账号的主要凭据;提交线索前必须完成验证。
            契约 v1 未提供在线换绑接口:如需更换号码,请用新号码在登录页验证登录(进入该号码对应的账号),
            或把两个号码与档案编号一起提供给运营方人工处理。
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Badge variant="outline">
              <Text>实名认证:{REAL_NAME_STATUS_LABEL[user.realNameStatus]}</Text>
            </Badge>
            <Badge variant="outline">
              <Text>{user.volunteerVerified ? '志愿者已认证' : '志愿者未认证'}</Text>
            </Badge>
          </View>
        </SectionCard>

        <SectionCard title="退出登录" className="mt-3" description="清除本机 token 与用户信息,收藏与本机草稿副本保留">
          <Button testID="security-sign-out" variant="outline" onPress={() => void doSignOut()}>
            <Icon as={LogOut} size={15} />
            <Text>退出登录</Text>
          </Button>
        </SectionCard>

        <SectionCard
          title="申请注销账号"
          className="mt-3"
          description="提交后进入冷静期,期满才按公示规则清除数据"
        >
          <NoticeBar
            tone="danger"
            title="注销前请读这三条"
            lines={[
              '1. 你发布的档案会清除识别信息(姓名、照片、详细地址、联系电话),线索记录不再关联到你。',
              '2. 冷静期内重新登录即可撤销申请;期满之后不可恢复。',
              '3. 若还有已发布的档案正在收线索,建议先转移给其他家属或联系运营方协助。',
            ]}
          />
          <TextField
            label="注销原因"
            testID="security-erase-reason"
            value={eraseReason}
            multiline
            maxLength={200}
            hint="必填,便于运营方统计;1–200 字"
            onChangeText={setEraseReason}
          />
          <Button
            testID="security-erase-start"
            variant="destructive"
            disabled={eraseReason.trim().length === 0}
            onPress={() => setEraseConfirmOpen(true)}
          >
            <Text>下一步:二次确认</Text>
          </Button>
          <Text className="text-muted-foreground mt-2 text-xs">
            原因未填写时按钮保持禁用;第一次点击只弹确认框,不会发出注销请求。
          </Text>
        </SectionCard>

        <View className="mt-3">
          <AgreementLinks version={env.AGREEMENT_VERSION} />
        </View>
      </ScrollView>

      {/* 二次确认:先勾"我已知悉",再点提交。 */}
      <AlertDialog open={eraseConfirmOpen} onOpenChange={setEraseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认提交注销申请?</AlertDialogTitle>
            <AlertDialogDescription>
              提交后账号进入冷静期(以服务端返回的冷静天数与截止日为准)。
              这是不可逆操作的最后一步。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CheckboxField
            testID="security-erase-ack"
            label="我已知悉注销后果并确认提交"
            description={`原因:${eraseReason.trim() || '未填写'}`}
            checked={eraseAck}
            onCheckedChange={setEraseAck}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>取消</Text>
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!eraseAck || eraseReason.trim().length === 0}
              onPress={() => void submitErase()}
            >
              <Text>提交注销申请</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}
