/**
 * 登录(spec: 验证码登录为主入口 / 会话恢复与路由守卫)。
 *
 * 要点:
 *   - 手机号 + 6 位验证码是默认路径,账号密码折叠在下方;
 *   - 60 秒重发冷却由 `useCountdown` 持有,期间重复点击不发请求;
 *   - 同一手机号连续 3 次验证码错误后要求图形验证码(契约 1.2 的 captchaId/captchaValue);
 *   - 明示"未注册手机号验证通过即自动创建账号";
 *   - 回跳目标:URL 的 `redirect` 优先,其次登录前 guard 记下的 pending action。
 *
 * 导航交给 SessionProvider 统一做(它消费 pending action 并 dismissTo 目标页),
 * 本页只负责把目标写回去,避免两处各推一次栈。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, TextField } from '@/components/form/fields';
import { NoticeBar } from '@/components/business/feedback';
import { useCountdown, resendCooldownSeconds } from '@/hooks/useCountdown';
import { authApi, type LoginResp, type SmsScene } from '@/lib/api/endpoints/auth';
import { ApiCode, ApiError, parseRetrySeconds, toUserMessage } from '@/lib/api/error';
import { formatCountdown, formatDuration } from '@/lib/format';
import { peekPendingAction, requireLogin, redirectFromParams } from '@/lib/nav';
import { notifyAuthenticated } from '@/lib/api/client';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const CODE_PATTERN = /^\d{6}$/;
const CAPTCHA_AFTER_FAILURES = 3;
const DEFAULT_RESEND_SECONDS = 60;

type Mode = 'PHONE' | 'ACCOUNT';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const applyLogin = useSession((state) => state.applyLogin);
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>('PHONE');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const cooldown = useCountdown();
  const requireCaptcha = failures >= CAPTCHA_AFTER_FAILURES;

  const redirect = useMemo(() => redirectFromParams(params), [params]);

  const validatePhone = useCallback((value: string): boolean => {
    if (!PHONE_PATTERN.test(value)) {
      setErrors((current) => ({ ...current, phone: '请输入 11 位大陆手机号' }));
      return false;
    }
    return true;
  }, []);

  /** 发送验证码:冷却中直接返回,不发起请求(spec 场景「重复点击不发起请求」)。 */
  const sendCode = useCallback(
    async (scene: SmsScene) => {
      if (cooldown.running || sending) return;
      setErrors({});
      setFormError(null);
      if (!validatePhone(phone)) return;
      setSending(true);
      try {
        const resp = await authApi.sendSmsCode({ phone, scene });
        cooldown.start(resendCooldownSeconds(resp?.expireSeconds, DEFAULT_RESEND_SECONDS));
        toast('验证码已发送,请注意查收', 'success');
      } catch (error) {
        setFormError(describeAuthError(error));
        // 限流有明确的重试秒数时直接进入冷却,避免用户连点。
        if (error instanceof ApiError && error.retryAfterSeconds) {
          cooldown.start(error.retryAfterSeconds);
        }
      } finally {
        setSending(false);
      }
    },
    [cooldown, phone, sending, toast, validatePhone],
  );

  const handleSubmit = useCallback(async () => {
    setErrors({});
    setFormError(null);
    if (!agreed) {
      setFormError('请先阅读并同意《用户协议》与《隐私政策》要点');
      return;
    }
    if (mode === 'PHONE') {
      if (!validatePhone(phone)) return;
      if (!CODE_PATTERN.test(code)) {
        setErrors((current) => ({ ...current, code: '请输入 6 位数字验证码' }));
        return;
      }
      if (requireCaptcha && captchaValue.trim().length < 4) {
        setErrors((current) => ({ ...current, captcha: '连续错误后需完成图形验证码' }));
        return;
      }
    } else if (!account.trim() || !password) {
      setErrors({ account: account.trim() ? '' : '请输入账号', password: password ? '' : '请输入密码' });
      return;
    }

    setSubmitting(true);
    try {
      const req =
        mode === 'PHONE'
          ? {
              authType: 'PHONE' as const,
              phone,
              code,
              // 契约 1.2:图形验证码只在连续 3 次错误后必填。
              captchaId: requireCaptcha ? captchaValue.trim() : null,
              captchaValue: requireCaptcha ? captchaValue.trim() : null,
            }
          : { authType: 'ACCOUNT' as const, account: account.trim(), password };

      // 先把回跳目标交还给 nav,由 SessionProvider 在登录成功后统一导航。
      const pending = await peekPendingAction();
      const target = redirect ?? pending?.href ?? '/(tabs)/plaza';
      await requireLogin({
        href: target,
        run: pending?.run,
        from: pending?.from ?? 'login',
      });

      const resp: LoginResp = await authApi.login(req);
      notifyAuthenticated();
      setFailures(0);
      await applyLogin(resp);
      if (resp.isNewUser) {
        toast('已为该手机号自动创建账号,可前往"我的"完善资料', 'success');
      }
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (apiError && apiError.code === ApiCode.ACCOUNT_LOCKED) {
        setFormError(describeAuthError(error));
      } else if (apiError && apiError.code === ApiCode.VALIDATE_FAILED) {
        setFailures((current) => current + 1);
        setFormError(describeAuthError(error));
        if (apiError.fieldErrors) {
          setErrors((current) => ({ ...current, ...apiError.fieldErrors }));
        }
      } else {
        setFormError(describeAuthError(error));
        // 验证码错误同样走这条分支:只要不是网络问题就累计一次。
        if (apiError && !apiError.isNetwork && !apiError.isTimeout) {
          setFailures((current) => current + 1);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    account,
    agreed,
    applyLogin,
    captchaValue,
    code,
    mode,
    password,
    phone,
    redirect,
    requireCaptcha,
    toast,
    validatePhone,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior="height">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-2xl font-bold">登录 / 注册</Text>
          <Text className="text-muted-foreground mt-1 text-sm leading-5">
            未注册手机号验证通过后即自动创建账号,无需单独注册。
          </Text>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-base">手机号验证码登录</CardTitle>
            </CardHeader>
            <CardContent>
              <TextField
                label="手机号"
                required
                testID="login-phone"
                value={phone}
                keyboardType="phone-pad"
                maxLength={11}
                placeholder="11 位大陆手机号"
                error={errors.phone}
                onChangeText={(next) => {
                  setPhone(next.replace(/\D/g, '').slice(0, 11));
                  setErrors((current) => ({ ...current, phone: '' }));
                }}
              />
              <Field
                label="验证码"
                required
                testID="login-code"
                error={errors.code}
                hint={cooldown.running ? `${formatCountdown(cooldown.secondsLeft)} 后可重新获取` : '6 位数字,5 分钟内有效'}
              >
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <TextField
                      label=""
                      value={code}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="6 位验证码"
                      testID="login-code-input"
                      onChangeText={(next) => {
                        setCode(next.replace(/\D/g, '').slice(0, 6));
                        setErrors((current) => ({ ...current, code: '' }));
                      }}
                    />
                  </View>
                  <Button
                    testID="login-send-code"
                    variant="outline"
                    disabled={cooldown.running || sending}
                    onPress={() => void sendCode('LOGIN')}
                    className="h-10 px-3"
                  >
                    <Text>
                      {cooldown.running
                        ? `${cooldown.secondsLeft}s`
                        : sending
                          ? '发送中'
                          : '获取验证码'}
                    </Text>
                  </Button>
                </View>
              </Field>

              {requireCaptcha ? (
                <NoticeBar
                  tone="warn"
                  title={`已连续 ${failures} 次验证失败,请填写图形验证码`}
                  lines={[
                    '契约 v1 未提供图形验证码取图接口,请把短信/页面下发的验证码串填在这里。',
                    '若确实拿不到验证码,可改用账号密码登录或稍后重试。',
                  ]}
                />
              ) : null}
              {requireCaptcha ? (
                <TextField
                  label="图形验证码"
                  required
                  testID="login-captcha"
                  value={captchaValue}
                  error={errors.captcha}
                  placeholder="请输入验证串"
                  onChangeText={setCaptchaValue}
                />
              ) : null}

              <View className="mt-1 flex-row items-start gap-2">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={setAgreed}
                  accessibilityLabel="同意用户协议与隐私政策"
                />
                <Pressable
                  className="flex-1"
                  accessibilityRole="button"
                  onPress={() => setAgreed((current) => !current)}
                >
                  <Text className="text-muted-foreground text-xs leading-4">
                    我已阅读并同意《用户协议》与《隐私政策》,确认提交内容不含虚假信息与他人隐私。
                  </Text>
                </Pressable>
              </View>

              {formError ? (
                <Text accessibilityRole="alert" className="text-urgent mt-3 text-sm">
                  {formError}
                </Text>
              ) : null}

              <Button
                testID="login-submit"
                className="mt-4 h-11"
                disabled={submitting}
                onPress={() => void handleSubmit()}
              >
                <Text>{submitting ? '登录中' : '登录 / 自动注册'}</Text>
              </Button>

              <Pressable
                accessibilityRole="button"
                onPress={() => setResetOpen((open) => !open)}
                className="mt-3 flex-row items-center"
              >
                {resetOpen ? (
                  <ChevronDown size={14} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={14} className="text-muted-foreground" />
                )}
                <Text className="text-muted-foreground ml-1 text-xs">忘记密码 / 重置密码</Text>
              </Pressable>
              {resetOpen ? (
                <ResetPasswordPanel
                  phone={phone}
                  onSent={(seconds) => cooldown.start(seconds)}
                  cooldownRunning={cooldown.running}
                />
              ) : null}
            </CardContent>
          </Card>

          <PasswordMode
            account={account}
            password={password}
            expanded={mode === 'ACCOUNT'}
            errors={errors}
            submitting={submitting}
            onToggle={() => setMode((current) => (current === 'ACCOUNT' ? 'PHONE' : 'ACCOUNT'))}
            onAccount={setAccount}
            onPassword={setPassword}
            onSubmit={() => void handleSubmit()}
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)/plaza')}
            className="mt-5 items-center py-2"
          >
            <Text className="text-muted-foreground text-sm">先逛逛寻人广场(无需登录)</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordMode({
  account,
  password,
  expanded,
  errors,
  submitting,
  onToggle,
  onAccount,
  onPassword,
  onSubmit,
}: {
  account: string;
  password: string;
  expanded: boolean;
  errors: Record<string, string>;
  submitting: boolean;
  onToggle: () => void;
  onAccount: (next: string) => void;
  onPassword: (next: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="mt-4">
      <Pressable accessibilityRole="button" onPress={onToggle} className="w-full px-4 py-3">
        <Text className="text-base font-semibold">
          {expanded ? '收起账号密码登录' : '使用账号密码登录'}
        </Text>
        <Text className="text-muted-foreground mt-1 text-xs">
          已设置过密码的账号可用账号 + 密码方式登录。
        </Text>
      </Pressable>
      {expanded ? (
        <CardContent>
          <TextField
            label="账号"
            testID="login-account"
            value={account}
            error={errors.account}
            placeholder="运营方分配的账号名"
            onChangeText={onAccount}
          />
          <TextField
            label="密码"
            testID="login-password"
            value={password}
            error={errors.password}
            secureTextEntry
            placeholder="至少 8 位"
            onChangeText={onPassword}
          />
          <Button className="mt-2 h-11" disabled={submitting} onPress={onSubmit}>
            <Text>{submitting ? '登录中' : '密码登录'}</Text>
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

/** 契约 1.3 的 `POST /app/auth/reset-password`(公开)。 */
function ResetPasswordPanel({
  phone,
  onSent,
  cooldownRunning,
}: {
  phone: string;
  onSent: (seconds: number) => void;
  cooldownRunning: boolean;
}) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown();

  return (
    <View className="border-border mt-3 rounded-lg border p-3">
      <Text className="text-sm font-semibold">重置密码</Text>
      <TextField
        label="手机号"
        value={phone}
        keyboardType="phone-pad"
        maxLength={11}
        testID="reset-phone"
        hint="留空则使用上方已填手机号"
        onChangeText={() => undefined}
        editable={false}
      />
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TextField
            label="验证码"
            value={code}
            keyboardType="number-pad"
            maxLength={6}
            testID="reset-code"
            onChangeText={(next) => setCode(next.replace(/\D/g, ''))}
          />
        </View>
        <Button
          variant="outline"
          className="h-10 self-end px-3"
          disabled={countdown.running || busy}
          onPress={() => {
            setError(null);
            if (!PHONE_PATTERN.test(phone)) {
              setError('请先在上方填写正确手机号');
              return;
            }
            void authApi
              .sendSmsCode({ phone, scene: 'RESET' })
              .then((resp) => {
                const seconds = resendCooldownSeconds(resp?.expireSeconds, DEFAULT_RESEND_SECONDS);
                countdown.start(seconds);
                onSent(seconds);
              })
              .catch((caught: unknown) => setError(describeAuthError(caught)));
          }}
        >
          <Text>{countdown.running ? `${countdown.secondsLeft}s` : '获取验证码'}</Text>
        </Button>
      </View>
      <TextField
        label="新密码"
        value={password}
        secureTextEntry
        maxLength={32}
        testID="reset-password"
        hint="至少 8 位,建议含字母与数字"
        onChangeText={setPassword}
      />
      {error ? <Text className="text-urgent text-sm">{error}</Text> : null}
      {done ? <Text className="text-found text-sm">密码已重置,请用新密码登录。</Text> : null}
      <Button
        variant="secondary"
        className="mt-1"
        disabled={busy || cooldownRunning}
        onPress={() => {
          setError(null);
          if (!CODE_PATTERN.test(code)) {
            setError('验证码为 6 位数字');
            return;
          }
          if (password.length < 8) {
            setError('新密码至少 8 位');
            return;
          }
          setBusy(true);
          void authApi
            .resetPassword({ phone, code, newPassword: password })
            .then(() => setDone(true))
            .catch((caught: unknown) => setError(describeAuthError(caught)))
            .finally(() => setBusy(false));
        }}
      >
        <Text>{busy ? '提交中' : '提交重置'}</Text>
      </Button>
    </View>
  );
}

/**
 * 登录类错误的用户文案。
 * 4006 锁定要给出剩余时间(契约错误码表),4290 要给出重试等待秒数。
 */
export function describeAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === ApiCode.ACCOUNT_LOCKED) {
      const seconds = parseRetrySeconds(error.msg) ?? firstNumberInData(error.data);
      return seconds
        ? `账号已锁定,请在 ${formatDuration(seconds)} 后重试`
        : error.msg || '账号已锁定,请稍后重试';
    }
    if (error.code === ApiCode.RATE_LIMITED) {
      const seconds = error.retryAfterSeconds ?? parseRetrySeconds(error.msg);
      return seconds ? `操作过于频繁,请 ${seconds} 秒后再试` : error.msg;
    }
    return toUserMessage(error);
  }
  return toUserMessage(error);
}

/** 契约未规定 4006 的 data 结构,不猜字段名:只在"单个数字"时用它当剩余秒数。 */
function firstNumberInData(data: unknown): number | undefined {
  if (typeof data === 'number' && Number.isFinite(data) && data > 0) return data;
  return undefined;
}
