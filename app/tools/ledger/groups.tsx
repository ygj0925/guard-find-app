/**
 * 账本管理:个人账本 + 家庭组列表,点选即切换当前作用域;
 * 新建组 / 凭邀请码加入;点组名右侧箭头进成员管理。
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Settings, Users } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/fields';
import { EmptyState, ErrorState, SectionCard } from '@/components/business/feedback';
import {
  createLedgerGroup,
  fetchLedgerGroups,
  joinLedgerGroup,
  type LedgerGroup,
} from '@/lib/api/endpoints/ledger';
import { useRequest } from '@/hooks/useRequest';
import { useLedgerScope } from '@/store/ledger-scope';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

export default function LedgerGroupsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const scopeGroupId = useLedgerScope((state) => state.groupId);
  const setScope = useLedgerScope((state) => state.setScope);

  const query = useRequest(() => fetchLedgerGroups(), [signedIn]);
  const groups = query.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const selectScope = useCallback(
    async (group: LedgerGroup | null) => {
      await setScope(group ? group.id : null, group ? group.name : null);
      toast(group ? `已切换到「${group.name}」` : '已切换到个人账本', 'success');
      router.back();
    },
    [router, setScope, toast],
  );

  const create = useCallback(async () => {
    const name = groupName.trim();
    if (!name) {
      setErrors({ name: '请填写组名' });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const group = await createLedgerGroup(name);
      toast('家庭组已创建,把邀请码分享给家人吧', 'success');
      setCreateOpen(false);
      setGroupName('');
      await setScope(group.id, group.name);
      router.replace('/tools/ledger/groups');
      await query.reload();
    } catch {
      toast('创建失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, groupName, query, router, setScope, toast]);

  const join = useCallback(async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setErrors({ inviteCode: '邀请码为 6 位大写字母数字' });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const group = await joinLedgerGroup(code);
      toast(`已加入「${group.name}」`, 'success');
      setJoinOpen(false);
      setInviteCode('');
      await query.reload();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '加入失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, inviteCode, query, toast]);

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState
          title="登录后使用家庭记账"
          description="和家人共享一个账本,总花销一目了然"
          actionLabel="去登录"
          onAction={() => router.push(loginHref({ href: '/tools/ledger/groups', from: 'groups' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">账本管理</Text>
            <Text className="text-muted-foreground mt-1 text-sm">点选切换,新账单记入选中的账本</Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="个人账本" onPress={() => void selectScope(null)} className="mb-2">
          <Card className="flex-row items-center p-3">
            <View className="bg-accent h-9 w-9 items-center justify-center rounded-full">
              <Icon as={Users} size={16} className="text-accent-foreground" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium">个人账本</Text>
              <Text className="text-muted-foreground mt-0.5 text-xs">只有自己的账单</Text>
            </View>
            {scopeGroupId === null ? <Text className="text-primary text-xs font-semibold">当前 ✓</Text> : null}
          </Card>
        </Pressable>

        {query.isInitialLoading ? (
          <SectionCard title="加载中…">{null}</SectionCard>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : (
          groups.map((group) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityLabel={`切换到 ${group.name}`}
              onPress={() => void selectScope(group)}
              className="mb-2"
            >
              <Card className="flex-row items-center p-3">
                <View className="bg-accent h-9 w-9 items-center justify-center rounded-full">
                  <Icon as={Users} size={16} className="text-accent-foreground" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-medium">{group.name}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    {group.memberCount} 名成员 · {group.myRole === 1 ? '我是组长' : '成员'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`管理 ${group.name}`}
                  onPress={() => router.push(`/tools/ledger/group-detail?id=${group.id}`)}
                  className="p-2"
                >
                  <Icon as={Settings} size={16} className="text-muted-foreground" />
                </Pressable>
                {scopeGroupId === group.id ? (
                  <Text className="text-primary ml-1 text-xs font-semibold">当前 ✓</Text>
                ) : (
                  <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
                )}
              </Card>
            </Pressable>
          ))
        )}

        <View className="mt-3 flex-row" style={{ gap: 12 }}>
          <Button variant="outline" className="flex-1" onPress={() => setJoinOpen(true)}>
            <Text>凭邀请码加入</Text>
          </Button>
          <Button className="flex-1" onPress={() => setCreateOpen(true)}>
            <Icon as={Plus} size={14} className="text-primary-foreground" />
            <Text>新建家庭组</Text>
          </Button>
        </View>
      </ScrollView>

      {/* 新建组 */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-3 text-lg font-bold">新建家庭组</Text>
            <Field label="组名" error={errors.name} required>
              <Input value={groupName} onChangeText={setGroupName} placeholder="比如:我们的家" aria-label="组名" />
            </Field>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setCreateOpen(false)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void create()} disabled={busy}>
                <Text>{busy ? '创建中…' : '创建'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 凭码加入 */}
      <Modal visible={joinOpen} transparent animationType="slide" onRequestClose={() => setJoinOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-1 text-lg font-bold">加入家庭组</Text>
            <Text className="text-muted-foreground mb-3 text-xs">向组长要 6 位邀请码</Text>
            <Field label="邀请码" error={errors.inviteCode} required>
              <TextInput
                className="border-border text-foreground rounded-lg border px-3 py-2 text-center text-xl font-bold tracking-[0.3em]"
                value={inviteCode}
                onChangeText={(value) => setInviteCode(value.toUpperCase())}
                placeholder="A1B2C3"
                autoCapitalize="characters"
                maxLength={6}
                accessibilityLabel="邀请码"
              />
            </Field>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setJoinOpen(false)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void join()} disabled={busy}>
                <Text>{busy ? '加入中…' : '加入'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
