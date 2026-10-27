/**
 * 记账 · 记一笔(新增/编辑复用):类型分段 + 分类宫格 + 金额/日期/备注。
 * 一期不引 react-hook-form:字段少,受控 state + zod 式手写校验即可。
 * 编辑模式通过路由参数 record(JSON 字符串)进入,保存后返回账单页刷新。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/fields';
import {
  createLedgerRecord,
  updateLedgerRecord,
  type LedgerRecord,
  type LedgerType,
} from '@/lib/api/endpoints/ledger';
import { categoriesOf } from '@/lib/ledger/categories';
import { toDayKey } from '@/lib/ledger/stats';
import { useToast } from '@/providers/ToastProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseParamsRecord(raw: string | undefined): LedgerRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LedgerRecord>;
    if (typeof parsed.id === 'string' && typeof parsed.amount === 'number') {
      return parsed as LedgerRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export default function LedgerAddScreen() {
  const params = useLocalSearchParams<{ record?: string }>();
  const editing = useMemo(() => parseParamsRecord(params.record), [params.record]);

  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';

  const [type, setType] = useState<LedgerType>(editing?.type ?? 1);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category ?? 'food');
  const [recordDate, setRecordDate] = useState(
    editing?.recordDate ?? toDayKey(new Date()),
  );
  const [remark, setRemark] = useState(editing?.remark ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const categories = categoriesOf(type);

  const switchType = (next: LedgerType) => {
    setType(next);
    // 类型切换后原分类可能不属于新类型,回落到该类型的第一个分类
    const codes = categoriesOf(next).map((item) => item.code);
    if (!codes.includes(category)) setCategory(codes[0]);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const trimmed = amount.trim();
    const value = Number(trimmed);
    // 两位小数校验用字符串正则:数值乘 100 取整在 19.99 这类数上有浮点误差,会误伤合法输入
    if (!trimmed || Number.isNaN(value) || value <= 0) next.amount = '请输入大于 0 的金额';
    else if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) next.amount = '最多两位小数';
    else if (value >= 1e10) next.amount = '金额超出范围';
    if (!DAY_RE.test(recordDate) || Number.isNaN(new Date(recordDate).getTime())) {
      next.recordDate = '日期格式应为 yyyy-MM-dd';
    }
    if (remark.length > 200) next.remark = '备注不能超过 200 字';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const payload = {
        type,
        amount: Number(Number(amount).toFixed(2)),
        category,
        recordDate,
        remark: remark.trim() || undefined,
      };
      if (editing) {
        await updateLedgerRecord(editing.id, payload);
        toast('已更新');
      } else {
        await createLedgerRecord(payload);
        toast('记好啦');
      }
      router.back();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '保存失败,请稍后再试', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <Text className="text-xl font-bold">{editing ? '编辑记录' : '记一笔'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => router.back()}>
            <Text className="text-muted-foreground text-sm">取消</Text>
          </Pressable>
        </View>

        <Card className="mb-3 p-4">
          <View className="flex-row rounded-full bg-muted p-1">
            {([1, 2] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value === 1 ? '支出' : '收入'}
                onPress={() => switchType(value)}
                className={`flex-1 items-center rounded-full py-2 ${type === value ? 'bg-primary' : ''}`}
              >
                <Text
                  className={`text-sm font-semibold ${type === value ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {value === 1 ? '支出' : '收入'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="mt-4">
            <Field label="金额" error={errors.amount} required>
              <View
                className="flex-row items-baseline rounded-lg border px-3 py-2"
                style={{ borderColor: token('border', scheme) }}
              >
                <Text className="mr-2 text-lg font-semibold">¥</Text>
                <Input
                  className="flex-1 border-0 text-2xl font-bold"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  aria-label="金额"
                />
              </View>
            </Field>

            <Field label="分类" required>
              <View className="flex-row flex-wrap">
                {categories.map((item) => {
                  const selected = item.code === category;
                  return (
                    <Pressable
                      key={item.code}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={selected ? { selected: true } : {}}
                      onPress={() => setCategory(item.code)}
                      className="mb-2 mr-2 w-[30%] items-center rounded-xl border py-2.5"
                      style={{
                        borderColor: selected ? token('primary', scheme) : token('border', scheme),
                        backgroundColor: selected ? token('accent', scheme) : 'transparent',
                      }}
                    >
                      <Icon
                        as={item.icon}
                        size={18}
                        className={selected ? 'text-primary' : 'text-muted-foreground'}
                      />
                      <Text
                        className={`mt-1 text-xs ${selected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="日期" error={errors.recordDate} required>
              <Input value={recordDate} onChangeText={setRecordDate} placeholder="yyyy-MM-dd" aria-label="记账日期" />
            </Field>

            <Field label="备注" error={errors.remark} hint="选填,最多 200 字">
              <Input value={remark} onChangeText={setRemark} placeholder="这笔花在哪了?" aria-label="备注" />
            </Field>

            <Button className="mt-2" onPress={() => void save()} disabled={saving}>
              <Text>{saving ? '保存中…' : editing ? '保存修改' : '记一笔'}</Text>
            </Button>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
