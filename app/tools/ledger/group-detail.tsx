/**
 * 家庭组详情:成员列表 + 邀请码(组长可见,可复制/重置)+ 移除成员/退出/解散。
 * 权限口径与服务端一致:管理操作仅组长;组长不能退出。
 */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Copy, Crown, RefreshCw, UserMinus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState, SectionCard } from '@/components/business/feedback';
import {
  dissolveLedgerGroup,
  fetchLedgerGroupMembers,
  fetchLedgerGroups,
  quitLedgerGroup,
  regenerateInviteCode,
  removeGroupMember,
  type LedgerGroupMember,
} from '@/lib/api/endpoints/ledger';
import { clipboard } from '@/lib/capabilities';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useLedgerScope } from '@/store/ledger-scope';
import { useToast } from '@/providers/ToastProvider';

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const myUserId = useSession((state) => state.user?.id ?? null);
  const setScope = useLedgerScope((state) => state.setScope);

  const membersQuery = useRequest(() => fetchLedgerGroupMembers(groupId), [groupId, signedIn]);
  const groupsQuery = useRequest(() => fetchLedgerGroups(), [groupId, signedIn]);
  const group = groupsQuery.data?.find((item) => item.id === groupId) ?? null;
  const members = membersQuery.data ?? [];
  const isOwner = group?.myRole === 1;

  const [busy, setBusy] = useState(false);

  const copyInviteCode = useCallback(async () => {
    if (!group?.inviteCode) return;
    const result = await clipboard.copy(group.inviteCode);
    toast(result.ok ? `邀请码 ${group.inviteCode} 已复制,发给家人吧` : '复制失败,请长按邀请码手动复制', result.ok ? 'success' : 'warn');
  }, [group, toast]);

  const resetInviteCode = useCallback(async () => {
    if (busy || !group) return;
    setBusy(true);
    try {
      await regenerateInviteCode(group.id);
      toast('邀请码已重置,旧码立即失效', 'success');
      await groupsQuery.reload();
    } catch {
      toast('重置失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, group, groupsQuery, toast]);

  const removeMember = useCallback(
    (member: LedgerGroupMember) => {
      Alert.alert('移除成员?', `${member.nickname ?? '该成员'} 将无法继续记账到本组`, [
        { text: '取消', style: 'cancel' },
        {
          text: '移除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await removeGroupMember(groupId, member.userId);
                toast('已移除');
                await membersQuery.reload();
              } catch {
                toast('移除失败,请稍后再试', 'error');
              }
            })();
          },
        },
      ]);
    },
    [groupId, membersQuery, toast],
  );

  const quit = useCallback(() => {
    Alert.alert('退出家庭组?', '退出后你在此组的账单仍保留,但不再共享', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await quitLedgerGroup(groupId);
              await setScope(null, null);
              toast('已退出', 'success');
              router.back();
            } catch {
              toast('退出失败,请稍后再试', 'error');
            }
          })();
        },
      },
    ]);
  }, [groupId, router, setScope, toast]);

  const dissolve = useCallback(() => {
    Alert.alert('解散家庭组?', '组内所有账单会自动回归各成员的个人账本,数据不丢', [
      { text: '取消', style: 'cancel' },
      {
        text: '解散',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await dissolveLedgerGroup(groupId);
              await setScope(null, null);
              toast('已解散,账单已回归个人账本', 'success');
              router.back();
            } catch {
              toast('解散失败,请稍后再试', 'error');
            }
          })();
        },
      },
    ]);
  }, [groupId, router, setScope, toast]);

  if (!signedIn || !groupId) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ErrorState error={{ message: '会话已失效' } as never} onRetry={() => undefined} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        ListHeaderComponent={
          <View className="mb-4 mt-2">
            <Text className="text-2xl font-bold">{group?.name ?? '家庭组'}</Text>
            <Text className="text-muted-foreground mt-1 text-sm">
              {members.length} 名成员 · {isOwner ? '我是组长' : '成员'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          membersQuery.isInitialLoading ? (
            <SectionCard title="加载成员中…">{null}</SectionCard>
          ) : membersQuery.error ? (
            <ErrorState error={membersQuery.error} onRetry={() => void membersQuery.reload()} />
          ) : null
        }
        renderItem={({ item }) => (
          <Card className="mb-2 flex-row items-center p-3">
            <Avatar alt={item.nickname ?? '成员'} className="size-10">
              {item.avatar ? <AvatarImage source={{ uri: item.avatar }} /> : null}
              <AvatarFallback>
                <Text>{(item.nickname ?? '成').slice(0, 1)}</Text>
              </AvatarFallback>
            </Avatar>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium">
                {item.nickname ?? '未设置昵称'}
                {item.userId === myUserId ? '（我）' : ''}
              </Text>
              <Text className="text-muted-foreground mt-0.5 text-xs">
                {item.role === 1 ? '组长' : `加入于 ${item.createTime?.slice(0, 10) ?? ''}`}
              </Text>
            </View>
            {item.role === 1 ? (
              <Badge variant="outline">
                <Icon as={Crown} size={10} className="text-pending" />
                <Text className="text-pending">组长</Text>
              </Badge>
            ) : isOwner ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`移除 ${item.nickname ?? '成员'}`}
                onPress={() => removeMember(item)}
                className="p-2"
              >
                <Icon as={UserMinus} size={16} className="text-urgent" />
              </Pressable>
            ) : null}
          </Card>
        )}
        ListFooterComponent={
          <View className="mt-2" style={{ gap: 12 }}>
            {isOwner && group?.inviteCode ? (
              <Card className="p-4">
                <Text className="text-muted-foreground text-xs">邀请码(仅组长可见)</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="复制邀请码"
                  onPress={() => void copyInviteCode()}
                  className="mt-1 flex-row items-center"
                  style={{ gap: 8 }}
                >
                  <Text className="text-primary text-2xl font-bold tracking-[0.3em]" selectable>
                    {group.inviteCode}
                  </Text>
                  <Icon as={Copy} size={16} className="text-muted-foreground" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="重置邀请码"
                  onPress={() => void resetInviteCode()}
                  disabled={busy}
                  className="mt-2 flex-row items-center self-start"
                  style={{ gap: 4 }}
                >
                  <Icon as={RefreshCw} size={12} className="text-muted-foreground" />
                  <Text className="text-muted-foreground text-xs">重置邀请码(旧码立即失效)</Text>
                </Pressable>
              </Card>
            ) : null}

            <Button variant="outline" onPress={quit} disabled={isOwner}>
              <Text>{isOwner ? '组长不能退出(可解散)' : '退出家庭组'}</Text>
            </Button>
            {isOwner ? (
              <Button variant="outline" onPress={dissolve}>
                <Text className="text-urgent">解散家庭组</Text>
              </Button>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}
