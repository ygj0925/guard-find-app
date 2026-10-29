/**
 * 宠物成长记录:宠物列表 + 成长时间线 + 添加日志。
 * 一页搞定:顶部宠物卡横滑选择,下方成长日志时间线。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Cat, Dog, PawPrint, Plus, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/fields';
import { EmptyState, ErrorState, RefreshingControl, SectionCard } from '@/components/business/feedback';
import {
  addPetLog,
  createPet,
  deletePet,
  deletePetLog,
  fetchPetLogs,
  fetchPets,
  type ToolPet,
  type ToolPetLog,
  type PetLogType,
} from '@/lib/api/endpoints/pet';
import { useRequest } from '@/hooks/useRequest';
import { useSession } from '@/store/session';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';
import { loginHref } from '@/lib/nav';

const SPECIES_LABEL: Record<string, string> = { cat: '猫', dog: '狗', other: '其他' };
const LOG_TYPE_LABEL: Record<string, string> = {
  weight: '体重', vaccine: '疫苗', medical: '就医', milestone: '里程碑', daily: '日常',
};
const LOG_TYPE_COLOR: Record<string, string> = {
  weight: '#3498db', vaccine: '#2ecc71', medical: '#e74c3c', milestone: '#f39c12', daily: '#95a5a6',
};

export default function PetScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const signedIn = useSession((state) => state.phase === 'authenticated');

  const petsQuery = useRequest(() => fetchPets(), [signedIn]);
  const pets = petsQuery.data ?? [];
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const selectedPet = pets.find((p) => p.id === selectedPetId) ?? pets[0] ?? null;

  const logsQuery = useRequest(
    () => fetchPetLogs(selectedPet?.id ?? ''),
    [selectedPet?.id, signedIn],
    { enabled: !!selectedPet },
  );
  const logs = logsQuery.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<'cat' | 'dog' | 'other'>('cat');
  const [breed, setBreed] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [logType, setLogType] = useState<PetLogType>('weight');
  const [logContent, setLogContent] = useState('');
  const [logValue, setLogValue] = useState('');
  const [logDate, setLogDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  const create = useCallback(async () => {
    if (!name.trim()) { setErrors({ name: '请填写宠物名' }); return; }
    if (busy) return;
    setBusy(true);
    try {
      await createPet({ name: name.trim(), species, breed: breed.trim() || undefined });
      toast('宠物档案已创建', 'success');
      setCreateOpen(false); setName(''); setBreed('');
      await petsQuery.reload();
    } catch { toast('创建失败,请稍后再试', 'error'); }
    finally { setBusy(false); }
  }, [busy, name, species, breed, petsQuery, toast]);

  const addLog = useCallback(async () => {
    if (!selectedPet || !logContent.trim() || busy) return;
    setBusy(true);
    try {
      await addPetLog(selectedPet.id, {
        logType, content: logContent.trim(),
        value: logValue.trim() ? Number(logValue) : undefined,
        logDate,
      });
      toast('已记录', 'success');
      setLogOpen(false); setLogContent(''); setLogValue('');
      await logsQuery.reload();
    } catch { toast('记录失败,请稍后再试', 'error'); }
    finally { setBusy(false); }
  }, [busy, selectedPet, logType, logContent, logValue, logDate, logsQuery, toast]);

  const confirmDeleteLog = useCallback((log: ToolPetLog) => {
    Alert.alert('删除这条记录?', log.content.slice(0, 30), [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        void (async () => {
          try {
            await deletePetLog(selectedPet!.id, log.id);
            toast('已删除');
            await logsQuery.reload();
          } catch { toast('删除失败,请稍后再试', 'error'); }
        })();
      }},
    ]);
  }, [logsQuery, selectedPet, toast]);

  if (!signedIn) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <EmptyState title="登录后记录宠物成长" description="体重曲线 · 疫苗记录 · 成长里程碑"
          actionLabel="去登录" onAction={() => router.push(loginHref({ href: '/tools/pet', from: 'pet' }))} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 104 }}>
        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">宠物成长</Text>
            <Text className="text-muted-foreground mt-1 text-sm">体重曲线 · 疫苗 · 里程碑</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="添加宠物"
            onPress={() => setCreateOpen(true)}
            className="bg-accent h-10 w-10 items-center justify-center rounded-full">
            <Icon as={Plus} size={20} className="text-primary" />
          </Pressable>
        </View>

        {petsQuery.isInitialLoading ? (
          <SectionCard title="加载中…">{null}</SectionCard>
        ) : petsQuery.error ? (
          <ErrorState error={petsQuery.error} onRetry={() => void petsQuery.reload()} />
        ) : pets.length === 0 ? (
          <EmptyState title="还没有宠物" description="点右上角 + 添加你的毛孩子" actionLabel="添加宠物" onAction={() => setCreateOpen(true)} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8 }}>
            {pets.map((pet) => {
              const selected = selectedPet?.id === pet.id || (!selectedPetId && pet.id === pets[0]?.id);
              return (
                <Pressable key={pet.id} accessibilityRole="button" accessibilityLabel={pet.name}
                  onPress={() => setSelectedPetId(pet.id)}
                  className={`items-center rounded-xl px-4 py-2 ${selected ? 'bg-accent' : 'bg-muted'}`}>
                  <Icon as={pet.species === 'dog' ? Dog : pet.species === 'cat' ? Cat : PawPrint} size={20}
                    className={selected ? 'text-primary' : 'text-muted-foreground'} />
                  <Text className={`mt-1 text-xs ${selected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{pet.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {selectedPet ? (
          <>
            <Card className="mb-3 p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold">{selectedPet.name}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    {SPECIES_LABEL[selectedPet.species] ?? selectedPet.species}
                    {selectedPet.breed ? ` · ${selectedPet.breed}` : ''}
                    {selectedPet.weightKg ? ` · ${selectedPet.weightKg}kg` : ''}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="删除宠物"
                  onPress={() => {
                    Alert.alert('删除宠物?', '成长日志会一起删除', [
                      { text: '取消', style: 'cancel' },
                      { text: '删除', style: 'destructive', onPress: () => {
                        void (async () => {
                          try { await deletePet(selectedPet.id); toast('已删除'); setSelectedPetId(null); await petsQuery.reload(); }
                          catch { toast('删除失败', 'error'); }
                        })();
                      }},
                    ]);
                  }} className="p-1">
                  <Icon as={Trash2} size={15} className="text-muted-foreground" />
                </Pressable>
              </View>
            </Card>

            <SectionCard title={`成长日志(${logs.length})`}>
              <Pressable accessibilityRole="button" accessibilityLabel="添加记录" onPress={() => setLogOpen(true)}
                className="bg-accent mb-3 flex-row items-center justify-center rounded-lg py-2.5" style={{ gap: 6 }}>
                <Icon as={Plus} size={16} className="text-accent-foreground" />
                <Text className="text-accent-foreground text-sm font-semibold">添加记录</Text>
              </Pressable>
              {logs.length === 0 ? (
                <Text className="text-muted-foreground py-2 text-center text-xs">还没有记录</Text>
              ) : (
                logs.map((log) => (
                  <View key={log.id} className="mb-2 flex-row items-start justify-between rounded-lg border border-border p-2.5">
                    <View className="flex-1">
                      <View className="flex-row items-center" style={{ gap: 6 }}>
                        <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: LOG_TYPE_COLOR[log.logType] + '18' }}>
                          <Text className="text-[10px] font-semibold" style={{ color: LOG_TYPE_COLOR[log.logType] }}>
                            {LOG_TYPE_LABEL[log.logType] ?? log.logType}
                          </Text>
                        </View>
                        <Text className="text-muted-foreground text-xs">{log.logDate}</Text>
                      </View>
                      <Text className="text-foreground mt-1 text-sm leading-4">{log.content}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="删除记录"
                      onPress={() => { void (async () => { try { await deletePetLog(selectedPet.id, log.id); toast('已删除'); await logsQuery.reload(); } catch { toast('删除失败', 'error'); } })(); }}
                      className="ml-2 p-1">
                      <Icon as={Trash2} size={13} className="text-muted-foreground" />
                    </Pressable>
                  </View>
                ))
              )}
            </SectionCard>
          </>
        ) : null}
      </ScrollView>

      {/* 添加日志弹层 */}
      <Modal visible={logOpen} transparent animationType="slide" onRequestClose={() => setLogOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-3 text-lg font-bold">添加成长记录</Text>
            <Field label="记录类型" required>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {(Object.keys(LOG_TYPE_LABEL) as PetLogType[]).map((type) => (
                  <Pressable key={type} accessibilityRole="button" accessibilityLabel={LOG_TYPE_LABEL[type]}
                    onPress={() => setLogType(type)}
                    className="rounded-full border px-3 py-1.5"
                    style={{ borderColor: logType === type ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: logType === type ? token('accent', scheme) : 'transparent' }}>
                    <Text className={`text-xs ${logType === type ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {LOG_TYPE_LABEL[type]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            {logType === 'weight' ? (
              <Field label="数值(kg)">
                <Input value={logValue} onChangeText={setLogValue} keyboardType="decimal-pad" placeholder="4.2" aria-label="体重数值" />
              </Field>
            ) : null}
            <Field label="记录内容" required>
              <Input value={logContent} onChangeText={setLogContent} placeholder="记录内容…" aria-label="记录内容" />
            </Field>
            <Field label="日期" hint="yyyy-MM-dd" required>
              <Input value={logDate} onChangeText={setLogDate} aria-label="记录日期" />
            </Field>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <Button variant="outline" className="flex-1" onPress={() => setLogOpen(false)}>
                <Text>取消</Text>
              </Button>
              <Button className="flex-1" onPress={() => void addLog()} disabled={busy}>
                <Text>{busy ? '保存中…' : '保存'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 新建宠物弹层 */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-2xl px-4 pb-8 pt-4">
            <Text className="mb-3 text-lg font-bold">添加宠物</Text>
            <Field label="宠物名" error={errors.name} required>
              <Input value={name} onChangeText={setName} placeholder="毛毛" aria-label="宠物名" />
            </Field>
            <Field label="物种" required>
              <View className="flex-row" style={{ gap: 6 }}>
                {(['cat', 'dog', 'other'] as const).map((key) => (
                  <Pressable key={key} accessibilityRole="button" accessibilityLabel={SPECIES_LABEL[key]}
                    onPress={() => setSpecies(key)} className="flex-1 items-center rounded-lg border py-2"
                    style={{ borderColor: species === key ? token('primary', scheme) : token('border', scheme),
                      backgroundColor: species === key ? token('accent', scheme) : 'transparent' }}>
                    <Text className={`text-xs ${species === key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {SPECIES_LABEL[key]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="品种">
              <Input value={breed} onChangeText={setBreed} placeholder="英短蓝猫" aria-label="品种" />
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
    </SafeAreaView>
  );
}
