import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/business/feedback';
import {
  accountingApi,
  type AccountingDraft,
  type Receipt,
} from '@/lib/api/endpoints/accounting';
import { imagePicker } from '@/lib/capabilities';
import { parseAccountingDraft } from '@/lib/ledger/recognition';
import { categoryLabel } from '@/lib/ledger/categories';
import { formatAmount, toDayKey } from '@/lib/ledger/stats';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

export default function ReceiptScreen() {
  const sessionToken = useSession((state) => state.token);
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const router = useRouter();
  if (!signedIn || !sessionToken)
    return (
      <EmptyState
        illustration="signin"
        title="登录后管理个人票据"
        actionLabel="去登录"
        onAction={() =>
          router.push(
            loginHref({ href: '/tools/ledger/receipts', from: 'accounting' }),
          )
        }
      />
    );
  return <ReceiptManager key={sessionToken} sessionToken={sessionToken} />;
}

function ReceiptManager({ sessionToken }: { sessionToken: string }) {
  const router = useRouter();
  const { groupId = '' } = useLocalSearchParams<{ groupId?: string }>();
  const { toast } = useToast();
  const query = useRequest(accountingApi.receipts, [sessionToken]);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<AccountingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const current = () =>
    active.current && useSession.getState().token === sessionToken;

  const run = async (task: () => Promise<void>) => {
    if (running.current || !current()) return;
    running.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      if (current())
        toast(
          error instanceof Error ? error.message : '操作失败，请重试',
          'error',
        );
    } finally {
      running.current = false;
      if (current()) setBusy(false);
    }
  };
  const recognize = async (receiptId?: string) => {
    if (!receiptId && !text.trim()) {
      toast('请先输入消费描述', 'warn');
      return;
    }
    await run(async () => {
      setDraft(null);
      const result = await accountingApi.recognize({
        receiptId,
        text: receiptId ? undefined : text.trim(),
        date: toDayKey(new Date()),
      });
      if (!current()) return;
      const validated = parseAccountingDraft(JSON.stringify(result));
      if (!validated) throw new Error('识别结果不完整，请手动记账');
      setDraft(validated);
    });
  };
  const upload = () =>
    run(async () => {
      const result = await imagePicker.pickImages(1);
      if (!current()) return;
      if (!result.ok) {
        if (result.reason !== 'cancelled') toast(result.message, 'warn');
        return;
      }
      const file = result.value[0];
      if (!file) return;
      await accountingApi.uploadReceipt({
        uri: file.uri,
        name: file.fileName || 'receipt.jpg',
        type: file.mimeType || 'image/jpeg',
        size: file.size,
        file: file.file,
      });
      if (!current()) return;
      toast('票据已上传，仅本人可见', 'success');
      await query.reload();
    });
  const remove = (receipt: Receipt) =>
    Alert.alert(
      '删除票据?',
      `${receipt.name}将被删除，已经保存的流水不受影响。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void run(async () => {
              await accountingApi.deleteReceipt(receipt.id);
              if (current()) {
                setDraft(null);
                await query.reload();
              }
            });
          },
        },
      ],
    );

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <Text className="my-3 text-xl font-bold">票据与识别记账</Text>
        <Text className="mb-3 text-sm text-muted-foreground">
          票据仅本人可见。识别生成待核对草稿，确认保存后才会记入
          {groupId ? '家庭组账本' : '个人账本'}。
        </Text>
        <Card className="mb-3 p-4">
          <Input
            accessibilityLabel="消费描述"
            placeholder="例如：今天午餐花了35元"
            value={text}
            onChangeText={setText}
            maxLength={4000}
            editable={!busy}
            multiline
          />
          <Button
            className="mt-3"
            disabled={busy || !text.trim()}
            onPress={() => void recognize()}
          >
            <Text>{busy ? '处理中…' : '识别文字，生成草稿'}</Text>
          </Button>
          <Text className="mt-2 text-xs text-muted-foreground">
            识别服务未启用时会显示服务端提示，可直接返回手动记账。
          </Text>
        </Card>
        {draft ? (
          <Card className="mb-3 p-4">
            <Text className="text-base font-semibold">
              待核对：{draft.type === 1 ? '支出' : '收入'} ¥
              {formatAmount(draft.amount)}
            </Text>
            <Text className="my-2 text-sm">
              {categoryLabel(draft.type, draft.category)} · {draft.recordDate}
            </Text>
            <Text className="mb-2 text-sm">{draft.remark}</Text>
            <Button
              disabled={busy}
              onPress={() =>
                router.push({
                  pathname: '/tools/ledger/add',
                  params: { draft: JSON.stringify(draft), groupId },
                })
              }
            >
              <Text>填入记一笔，核对并保存</Text>
            </Button>
          </Card>
        ) : null}
        <Button
          variant="outline"
          disabled={busy || !imagePicker.isAvailable()}
          onPress={() => void upload()}
        >
          <Text>上传票据图片（最大5MB）</Text>
        </Button>
        {!imagePicker.isAvailable() ? (
          <Text className="mt-2 text-xs text-muted-foreground">
            当前设备尚不支持选图，仍可使用文字识别。
          </Text>
        ) : null}
        <Text className="my-3 text-sm text-muted-foreground">
          最近100张票据 · 总空间100MB
        </Text>
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.reload()} />
        ) : null}
        {query.isInitialLoading ? <Text>正在加载票据…</Text> : null}
        {query.data?.map((receipt) => (
          <Card key={receipt.id} className="mb-2 p-3">
            <Text className="text-sm font-semibold">{receipt.name}</Text>
            <Text className="my-1 text-xs text-muted-foreground">
              {receipt.mime} · {Math.ceil(receipt.size / 1024)} KB
            </Text>
            <View className="flex-row" style={{ gap: 12 }}>
              <Button
                variant="outline"
                disabled={busy}
                onPress={() => void recognize(receipt.id)}
              >
                <Text>识别为草稿</Text>
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onPress={() => remove(receipt)}
              >
                <Text>删除票据</Text>
              </Button>
            </View>
          </Card>
        ))}
        {query.data?.length === 0 ? (
          <Text className="my-3 text-sm text-muted-foreground">
            暂无票据，上传图片不会自动生成账单。
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
