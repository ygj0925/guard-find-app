/**
 * 筛选面板:选项全部来自 `GET /app/plaza/filters`,页面 MUST NOT 硬编码枚举。
 * 字典拉不到时面板给出错误态与重试,而不是显示一份内置候选值。
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Field, NumberField, OptionSheetField } from '@/components/form/fields';
import { useFilters } from '@/providers/FiltersProvider';
import type { PlazaFilterSelection } from '@/lib/api/endpoints/plaza';


export function FilterSheet({
  visible,
  onClose,
  value,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  value: PlazaFilterSelection;
  onApply: (next: PlazaFilterSelection) => void;
}) {
  const { filters, loading, error, reload } = useFilters();
  const [draft, setDraft] = useState<PlazaFilterSelection>(value);

  const patch = (next: Partial<PlazaFilterSelection>) =>
    setDraft((current) => ({ ...current, ...next }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-overlay/40" onPress={onClose}>
        <View className="absolute inset-x-0 bottom-0 max-h-[80%] rounded-t-2xl bg-background p-4">
          <Text className="mb-1 text-base font-semibold">筛选条件</Text>
          <Text className="text-muted-foreground mb-3 text-xs">
            选项由服务端字典提供;筛选生效后列表改走搜索接口。
          </Text>
          <ScrollView>
            {loading && !filters ? (
              <Text className="text-muted-foreground py-6 text-center text-sm">选项加载中</Text>
            ) : error && !filters ? (
              <View className="py-6">
                <Text className="text-muted-foreground text-center text-sm">{error}</Text>
                <Button variant="outline" size="sm" className="mt-3 self-center" onPress={() => void reload()}>
                  <Text>重试</Text>
                </Button>
              </View>
            ) : (
              <View className="pb-2">
                <OptionSheetField
                  label="性别"
                  testID="filter-gender"
                  options={filters?.genders ?? []}
                  value={draft.gender}
                  onChange={(gender) => patch({ gender })}
                />
                <OptionSheetField
                  label="年龄段"
                  testID="filter-age"
                  options={filters?.ageGroups ?? []}
                  value={draft.ageGroup}
                  onChange={(ageGroup) => patch({ ageGroup })}
                />
                <OptionSheetField
                  label="失踪情形"
                  testID="filter-case-type"
                  options={filters?.caseTypes ?? []}
                  value={draft.caseType}
                  onChange={(caseType) => patch({ caseType })}
                />
                <OptionSheetField
                  label="血样采集"
                  testID="filter-blood"
                  options={filters?.bloodSampleStatuses ?? []}
                  value={draft.bloodSampleStatus}
                  onChange={(bloodSampleStatus) => patch({ bloodSampleStatus })}
                />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <NumberField
                      label="失踪年份从"
                      testID="filter-year-from"
                      value={draft.yearFrom ?? null}
                      onChange={(yearFrom) => patch({ yearFrom: yearFrom ?? undefined })}
                      placeholder="2015"
                    />
                  </View>
                  <View className="flex-1">
                    <NumberField
                      label="到"
                      testID="filter-year-to"
                      value={draft.yearTo ?? null}
                      onChange={(yearTo) => patch({ yearTo: yearTo ?? undefined })}
                      placeholder="2026"
                    />
                  </View>
                </View>
                {draft.yearFrom && draft.yearTo && draft.yearFrom > draft.yearTo ? (
                  <Field label="" error="起始年份不能晚于结束年份">
                    <View />
                  </Field>
                ) : null}
              </View>
            )}
          </ScrollView>
          <View className="mt-3 flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => {
                setDraft({});
                onApply({});
              }}
            >
              <Text>清空</Text>
            </Button>
            <Button className="flex-1" onPress={() => onApply(draft)}>
              <Text>应用</Text>
            </Button>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

