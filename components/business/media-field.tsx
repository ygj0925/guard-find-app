/**
 * 图片选择 + 上传的共用字段组件(发布表单 ≤9 张、线索表单 ≤3 张)。
 *
 * 三条规格要求都落在这里:
 *   1. 超额/超大在**选择阶段**就提示,不等提交(`applyMediaLimits` + 即时 toast);
 *   2. 能力不可用时按钮置灰并给出降级说明,而不是点了才报错(鸿蒙侧图片选择器未接入);
 *   3. 单张上传失败可单独重试,已成功的图不受影响。
 */
import React, { useCallback, useState } from 'react';
import { Image, Pressable, Text as RNText, View } from 'react-native';
import { ImagePlus, RefreshCw, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Field } from '@/components/form/fields';
import { NoticeBar } from './feedback';
import { useToast } from '@/providers/ToastProvider';
import {
  applyMediaLimits,
  imagePicker,
  limitRejectSummary,
  mediaPickerAvailable,
  uploadMediaItem,
  type MediaItem,
} from '@/lib/media';
import type { UploadPath } from '@/lib/api/endpoints/upload';

export interface MediaFieldProps {
  items: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  limit: number;
  uploadPath: UploadPath;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  testID?: string;
}

export function MediaField({
  items,
  onChange,
  limit,
  uploadPath,
  label = '图片',
  required,
  hint,
  error,
  testID,
}: MediaFieldProps) {
  const { toast } = useToast();
  const [note, setNote] = useState<string | null>(null);
  const available = mediaPickerAvailable();
  const full = items.length >= limit;

  const runUpload = useCallback(
    async (item: MediaItem) => {
      const result = await uploadMediaItem(item, uploadPath);
      onChange(
        items.map((current) =>
          current.key === item.key
            ? result.ok
              ? { ...current, url: result.url, state: 'done' as const, message: result.note }
              : { ...current, url: null, state: 'error' as const, message: result.message }
            : current,
        ),
      );
    },
    [items, onChange, uploadPath],
  );

  const pick = useCallback(async () => {
    setNote(null);
    const remain = Math.max(0, limit - items.length);
    if (!remain) {
      toast(`最多 ${limit} 张,请先删除部分图片`, 'warn');
      return;
    }
    const result = await imagePicker.pickImages(remain);
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    const { accepted, rejected } = applyMediaLimits(items, result.value, limit);
    const added = accepted.filter((item) => !items.some((current) => current.key === item.key));
    onChange(accepted);
    const summary = limitRejectSummary(rejected);
    if (summary) toast(summary, 'warn');
    added.forEach((item) => void runUpload(item));
  }, [items, limit, onChange, runUpload, toast]);

  return (
    <Field
      label={label}
      required={required}
      error={error}
      hint={hint ?? `已选 ${items.length}/${limit} 张,单张不超过 5MB`}
      testID={testID}
    >
      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <MediaThumb
            key={item.key}
            item={item}
            onRemove={() => onChange(items.filter((current) => current.key !== item.key))}
            onRetry={() => void runUpload(item)}
          />
        ))}
        <Pressable
          testID={`${testID ?? 'media'}-add`}
          accessibilityRole="button"
          disabled={!available || full}
          onPress={() => void pick()}
          className="border-border bg-muted size-20 items-center justify-center rounded-lg border border-dashed"
          style={!available || full ? { opacity: 0.4 } : undefined}
        >
          <Icon as={ImagePlus} size={22} className="text-muted-foreground" />
          <Text className="text-muted-foreground mt-1 text-xs">
            {available ? (full ? '已达上限' : '添加') : '暂不支持选图'}
          </Text>
        </Pressable>
      </View>

      {!available ? (
        <NoticeBar
          tone="warn"
          title="当前设备未接入系统图片选择器"
          lines={[
            '可以先填写文字内容,图片稍后在草稿箱补齐。',
            '接入需要经 expo-harmony-cli 安装并实机验证,未验证不承诺可用。',
          ]}
        />
      ) : null}
      {note ? <NoticeBar tone="warn" title={note} /> : null}
      {items.some((item) => item.state === 'error') ? (
        <Text className="text-urgent mt-1 text-xs">有图片上传失败,请点图片右下角的重试图标重试。</Text>
      ) : null}
    </Field>
  );
}

function MediaThumb({
  item,
  onRemove,
  onRetry,
}: {
  item: MediaItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const tone =
    item.state === 'done'
      ? 'border-found'
      : item.state === 'error'
        ? 'border-urgent'
        : 'border-border';
  return (
    <View className={`size-20 overflow-hidden rounded-lg border ${tone}`}>
      {item.uri ? (
        <Image source={{ uri: item.uri }} style={{ width: 80, height: 80 }} resizeMode="cover" />
      ) : null}
      <View className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5">
        <RNText numberOfLines={1} style={{ color: '#fff', fontSize: 10 }}>
          {item.state === 'done' ? '已上传' : item.state === 'error' ? '失败' : '上传中'}
        </RNText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="移除图片"
        onPress={onRemove}
        className="absolute right-0 top-0 p-1"
      >
        <Icon as={X} size={14} color="#fff" />
      </Pressable>
      {item.state === 'error' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重试上传"
          onPress={onRetry}
          className="absolute bottom-0 right-0 p-1"
        >
          <Icon as={RefreshCw} size={14} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 页面用它把"已上传成功"的地址抽出来交给请求体。 */
export function uploadedUrlsOf(items: MediaItem[]): string[] {
  return items
    .filter((item) => item.state === 'done' && item.url)
    .map((item) => item.url as string);
}

export function hasPendingUpload(items: MediaItem[]): boolean {
  return items.some((item) => item.state === 'uploading');
}

export function hasFailedUpload(items: MediaItem[]): boolean {
  return items.some((item) => item.state === 'error');
}
