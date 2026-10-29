/**
 * 选择器:省市区三级 + 日期时间。
 *
 * 一期不引 `@react-native-community/datetimepicker`(需 expo-harmony-cli 安装并实机验证),
 * 日期时间用"年/月/日 + 时/分"滚动选择,并硬性禁止未来值(spec 第二步要求)。
 * 区划树来自 `GET /app/plaza/filters` 的 `regions`,不在前端造数据。
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useFilters } from '@/providers/FiltersProvider';
import { pad2, toServerDate, toServerTime } from '@/lib/format';
import type { RegionNode } from '@/lib/api/endpoints/common';

export interface RegionSelection {
  provinceCode: string | null;
  cityCode: string | null;
  districtCode: string | null;
  label: string;
}

function childrenOf(node: RegionNode | undefined): RegionNode[] {
  return node?.children ?? [];
}

export function RegionPicker({
  visible,
  onClose,
  value,
  onChange,
  level = 3,
}: {
  visible: boolean;
  onClose: () => void;
  value: RegionSelection | null;
  onChange: (next: RegionSelection) => void;
  /** 3 = 到区县,2 = 到市(广场城市选择用)。 */
  level?: 2 | 3;
}) {
  const { filters, loading, error, reload } = useFilters();
  const [province, setProvince] = useState<string | null>(value?.provinceCode ?? null);
  const [city, setCity] = useState<string | null>(value?.cityCode ?? null);
  const [district, setDistrict] = useState<string | null>(value?.districtCode ?? null);

  const provinces = filters?.regions ?? [];
  const cities = useMemo(
    () => childrenOf(provinces.find((node) => node.code === province)),
    [provinces, province],
  );
  const districts = useMemo(
    () => childrenOf(cities.find((node) => node.code === city)),
    [cities, city],
  );

  const commit = () => {
    const labels = [
      province ? provinces.find((node) => node.code === province)?.name : null,
      city ? cities.find((node) => node.code === city)?.name : null,
      level === 3 && district ? districts.find((node) => node.code === district)?.name : null,
    ].filter(Boolean) as string[];
    onChange({
      provinceCode: province,
      cityCode: level >= 2 ? city : null,
      districtCode: level === 3 ? district : null,
      label: labels.join(' '),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-overlay/40" onPress={onClose}>
        <View className="absolute inset-x-0 bottom-0 h-[72%] rounded-t-2xl bg-background p-4">
          <Text className="mb-2 text-base font-semibold">
            {level === 3 ? '选择失踪地点' : '选择城市'}
          </Text>
          {loading && !provinces.length ? (
            <Text className="text-muted-foreground py-6 text-center text-sm">区划数据加载中</Text>
          ) : error && !provinces.length ? (
            <View className="py-6">
              <Text className="text-muted-foreground text-center text-sm">{error}</Text>
              <Button variant="outline" size="sm" className="mt-3 self-center" onPress={() => void reload()}>
                <Text>重试</Text>
              </Button>
            </View>
          ) : (
            <View className="flex-1 flex-row">
              <Column items={provinces} active={province} onSelect={(code) => {
                setProvince(code);
                setCity(null);
                setDistrict(null);
              }} />
              {level >= 2 ? (
                <Column items={cities} active={city} onSelect={(code) => {
                  setCity(code);
                  setDistrict(null);
                }} />
              ) : null}
              {level === 3 ? <Column items={districts} active={district} onSelect={setDistrict} /> : null}
            </View>
          )}
          <View className="mt-3 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text>取消</Text>
            </Button>
            <Button className="flex-1" disabled={!province || (level >= 2 && !city)} onPress={commit}>
              <Text>确定</Text>
            </Button>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function Column({
  items,
  active,
  onSelect,
}: {
  items: RegionNode[];
  active: string | null;
  onSelect: (code: string, node: RegionNode) => void;
}) {
  if (!items.length) return null;
  return (
    <ScrollView className="flex-1 border-r border-border">
      {items.map((node) => (
        <Pressable
          key={node.code}
          accessibilityRole="button"
          onPress={() => onSelect(node.code, node)}
          className={node.code === active ? 'bg-accent px-3 py-3' : 'px-3 py-3'}
        >
          <Text className={node.code === active ? 'text-primary text-sm font-semibold' : 'text-sm'}>
            {node.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export interface DateTimeSelection {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function nowSelection(): DateTimeSelection {
  const date = new Date();
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function toSelection(value: string | null | undefined): DateTimeSelection | null {
  if (!value) return null;
  const matched = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!matched) return null;
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
    hour: Number(matched[4]),
    minute: Number(matched[5]),
  };
}

/** 只到日期。 */
export function DateValue(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function DateTimePicker({
  visible,
  onClose,
  value,
  onChange,
  title = '选择时间',
  mode = 'datetime',
  max = nowSelection(),
}: {
  visible: boolean;
  onClose: () => void;
  /** `yyyy-MM-dd HH:mm:ss` 或 `yyyy-MM-dd`。 */
  value: string | null | undefined;
  onChange: (next: string) => void;
  title?: string;
  mode?: 'datetime' | 'date';
  /** 上限,默认"现在";第二步禁止未来时间。 */
  max?: DateTimeSelection;
}) {
  const [selection, setSelection] = useState<DateTimeSelection>(
    toSelection(value) ?? nowSelection(),
  );

  const exceedsMax = (candidate: DateTimeSelection): boolean => {
    const keys: Array<keyof DateTimeSelection> = ['year', 'month', 'day', 'hour', 'minute'];
    for (const key of keys) {
      if (candidate[key] > max[key]) return true;
      if (candidate[key] < max[key]) return false;
    }
    return false;
  };

  const invalid = exceedsMax(selection);

  const commit = () => {
    if (invalid) return;
    const date = new Date(
      selection.year,
      selection.month - 1,
      selection.day,
      mode === 'date' ? 12 : selection.hour,
      selection.minute,
    );
    onChange(mode === 'date' ? toServerDate(date) : toServerTime(date));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-overlay/40" onPress={onClose}>
        <View className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-background p-4">
          <Text className="mb-1 text-base font-semibold">{title}</Text>
          <Text className="text-muted-foreground mb-3 text-xs">
            不可选择未来时间(时区 Asia/Shanghai)
          </Text>
          <View className="flex-row">
            <NumberColumn
              label="年"
              from={1950}
              to={max.year}
              value={selection.year}
              onChange={(year) => setSelection((current) => ({ ...current, year }))}
            />
            <NumberColumn
              label="月"
              from={1}
              to={12}
              value={selection.month}
              onChange={(month) => setSelection((current) => ({ ...current, month }))}
            />
            <NumberColumn
              label="日"
              from={1}
              to={31}
              value={selection.day}
              onChange={(day) => setSelection((current) => ({ ...current, day }))}
            />
            {mode === 'datetime' ? (
              <>
                <NumberColumn
                  label="时"
                  from={0}
                  to={23}
                  value={selection.hour}
                  onChange={(hour) => setSelection((current) => ({ ...current, hour }))}
                />
                <NumberColumn
                  label="分"
                  from={0}
                  to={59}
                  value={selection.minute}
                  onChange={(minute) => setSelection((current) => ({ ...current, minute }))}
                />
              </>
            ) : null}
          </View>
          {invalid ? (
            <Text className="text-urgent mt-2 text-xs">所选时间晚于当前时间,请重新选择</Text>
          ) : null}
          <View className="mt-3 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text>取消</Text>
            </Button>
            <Button className="flex-1" disabled={invalid} onPress={commit}>
              <Text>确定</Text>
            </Button>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function NumberColumn({
  label,
  from,
  to,
  value,
  onChange,
}: {
  label: string;
  from: number;
  to: number;
  value: number;
  onChange: (next: number) => void;
}) {
  const items: number[] = [];
  for (let current = from; current <= to; current += 1) items.push(current);
  return (
    <View className="flex-1 items-center">
      <Text className="text-muted-foreground mb-1 text-xs">{label}</Text>
      <ScrollView
        className="h-44 flex-1"
        contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}
      >
        {items.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            onPress={() => onChange(item)}
            className={item === value ? 'bg-primary rounded px-3 py-1.5' : 'px-3 py-1.5'}
          >
            <Text className={item === value ? 'text-primary-foreground text-sm' : 'text-sm'}>
              {pad2(item)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
