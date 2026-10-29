/**
 * 受控表单原语。一期不引 react-hook-form:发布表单的字段状态由
 * `store/publish-form.ts` 持有(要逐键落本地草稿),线索表单字段少,直接用受控 state。
 * 校验统一走 zod(`lib/publish/schema.ts`),错误按 `字段名 -> 文案` 回传给字段。
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Option } from '@/lib/api/endpoints/common';

export interface FieldProps {
  label: string;
  /** 字段级错误文案(来自 zod)。 */
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  testID?: string;
}

export function Field({ label, error, hint, required, children, testID }: FieldProps) {
  return (
    <View className="mb-3" testID={testID}>
      <Label nativeID={`${testID ?? label}-label`} className="mb-1.5 text-sm">
        {label}
        {required ? <Text className="text-urgent"> *</Text> : null}
      </Label>
      {children}
      {error ? (
        <Text accessibilityRole="alert" className="text-urgent mt-1 text-xs">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-muted-foreground mt-1 text-xs">{hint}</Text>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  required,
  placeholder,
  keyboardType,
  maxLength,
  multiline,
  secureTextEntry,
  testID,
  editable = true,
  autoFocusable,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'decimal-pad';
  maxLength?: number;
  multiline?: boolean;
  secureTextEntry?: boolean;
  testID?: string;
  editable?: boolean;
  autoFocusable?: boolean;
}) {
  void autoFocusable;
  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      testID={testID}
    >
      {multiline ? (
        <Textarea
          testID={`${testID ?? label}-input`}
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(error && 'border-urgent')}
        />
      ) : (
        <Input
          testID={`${testID ?? label}-input`}
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          className={cn('h-10', error && 'border-urgent')}
        />
      )}
    </Field>
  );
}

/** 数字字段:空串映射为 null,避免 NaN 进 zod。 */
export function NumberField(props: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  max?: number;
  testID?: string;
}) {
  const { label, value, onChange, error, hint, required, placeholder, max, testID } = props;
  return (
    <TextField
      label={label}
      testID={testID}
      required={required}
      error={error}
      hint={hint}
      placeholder={placeholder}
      keyboardType="number-pad"
      maxLength={max ? String(max).length + 1 : 6}
      value={value === null ? '' : String(value)}
      onChangeText={(next) => {
        const digits = next.replace(/[^\d.]/g, '');
        if (!digits) {
          onChange(null);
          return;
        }
        const parsed = Number(digits);
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
    />
  );
}

/** 芯片式单选:选项必须来自 /app/plaza/filters,不允许在这里硬编码。 */
export function OptionChips({
  options,
  value,
  onChange,
  emptyHint = '选项加载中',
}: {
  options: Option[];
  value: string | null | undefined;
  onChange: (next: string) => void;
  emptyHint?: string;
}) {
  if (!options.length) {
    return (
      <Text className="text-muted-foreground text-xs">{emptyHint}</Text>
    );
  }
  const sorted = [...options].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <View className="flex-row flex-wrap gap-2">
      {sorted.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-3 py-1.5',
              active ? 'border-primary bg-primary' : 'border-border bg-background',
            )}
          >
            <Text className={cn('text-xs', active ? 'text-primary-foreground' : 'text-foreground')}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 弹层单选:长列表(关系、情形)用芯片会溢出,统一走底部面板。 */
export function OptionSheetField(props: {
  label: string;
  options: Option[];
  value: string | null | undefined;
  onChange: (next: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  testID?: string;
}) {
  const { label, options, value, onChange, error, hint, required, placeholder, testID } = props;
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Field label={label} error={error} hint={hint} required={required} testID={testID}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className={cn(
          'h-10 justify-center rounded-md border border-input bg-background px-3',
          error && 'border-urgent',
        )}
      >
        <Text className={selected ? 'text-sm' : 'text-muted-foreground text-sm'} numberOfLines={1}>
          {selected?.label ?? placeholder ?? '请选择'}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-overlay/40" onPress={() => setOpen(false)}>
          <View className="absolute inset-x-0 bottom-0 max-h-[70%] rounded-t-2xl bg-background p-4">
            <Text className="mb-3 text-base font-semibold">{label}</Text>
            <ScrollView>
              {options.length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-sm">
                  选项暂不可用,请下拉刷新或检查网络
                </Text>
              ) : (
                [...options]
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      onPress={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className="border-b border-border py-3"
                    >
                      <Text className={option.value === value ? 'text-primary text-sm font-semibold' : 'text-sm'}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))
              )}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} className="mt-3 items-center py-2">
              <Text className="text-muted-foreground text-sm">取消</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Field>
  );
}

export function SwitchField({
  label,
  value,
  onValueChange,
  disabled,
  hint,
  testID,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  hint?: string;
  testID?: string;
}) {
  return (
    <View
      style={styles.switchRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      testID={testID}
    >
      <View className="flex-1">
        <Text className={disabled ? 'text-muted-foreground text-sm' : 'text-sm'}>{label}</Text>
        {hint ? <Text className="text-muted-foreground mt-0.5 text-xs">{hint}</Text> : null}
      </View>
      <Switch checked={value} disabled={disabled} onCheckedChange={onValueChange} />
    </View>
  );
}

export function CheckboxField({
  label,
  description,
  checked,
  onCheckedChange,
  error,
  testID,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  error?: string;
  testID?: string;
}) {
  return (
    <View className="mb-3" testID={testID}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onCheckedChange(!checked)}
        className="flex-row items-start gap-2"
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          accessibilityLabel={label}
        />
        <View className="flex-1">
          <Text className="text-sm leading-5">{label}</Text>
          {description ? (
            <Text className="text-muted-foreground mt-0.5 text-xs">{description}</Text>
          ) : null}
        </View>
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" className="text-urgent mt-1 text-xs">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
});
