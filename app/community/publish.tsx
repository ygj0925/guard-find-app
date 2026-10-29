/**
 * 发布动态:正文 + 图片(≤9,能力分派层选图+压缩)+ 位置名(手输,不申请定位权限)。
 * 合规:服务端过敏感词审核;位置为用户主动提供,可不留。
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ImagePlus, MapPin, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RemoteImage } from '@/components/business/RemoteImage';
import { NoticeBar } from '@/components/business/feedback';
import { createPost } from '@/lib/api/endpoints/post';
import { uploadApi } from '@/lib/api/endpoints/upload';
import { imagePicker } from '@/lib/capabilities';
import { useToast } from '@/providers/ToastProvider';

const MAX_IMAGES = 9;

export default function PostPublishScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [locationName, setLocationName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const pickImages = useCallback(async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast(`最多 ${MAX_IMAGES} 张`, 'warn');
      return;
    }
    const picked = await imagePicker.pickImages(remaining);
    if (!picked.ok) {
      toast(picked.message, 'warn');
      return;
    }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const image of picked.value) {
        const uploaded = await uploadApi.file(
          { uri: image.uri, name: image.fileName ?? 'post.jpg', type: image.mimeType ?? 'image/jpeg' },
          'post',
        );
        urls.push(uploaded.url);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch {
      toast('图片上传失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [images.length, toast]);

  const submit = useCallback(async () => {
    const text = content.trim();
    if (!text) {
      setErrors({ content: '说点什么吧' });
      return;
    }
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      await createPost({
        content: text,
        images: images.length > 0 ? images : undefined,
        locationName: locationName.trim() || undefined,
      });
      toast('已发布', 'success');
      router.back();
    } catch (cause) {
      toast(cause instanceof Error && cause.message ? cause.message : '发布失败,请稍后再试', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, content, images, locationName, router, toast]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <Text className="text-xl font-bold">发布动态</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="取消" onPress={() => router.back()}>
            <Text className="text-muted-foreground text-sm">取消</Text>
          </Pressable>
        </View>

        <NoticeBar
          tone="info"
          title="发布须知"
          lines={['内容会经过安全审核;位置由你主动填写,可留空;图片最多 9 张。']}
        />

        <Card className="mb-3 p-4">
          <TextInput
            className="text-foreground min-h-32 text-sm leading-5"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={1000}
            placeholder="分享这一刻…"
            accessibilityLabel="动态正文"
          />
          {errors.content ? <Text className="text-urgent mt-1 text-xs">{errors.content}</Text> : null}
          <Text className="text-muted-foreground mt-1 self-end text-xs">{content.length}/1000</Text>

          {images.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap" style={{ gap: 8 }}>
              {images.map((uri) => (
                <View key={uri} style={{ width: 88, height: 88 }}>
                  <RemoteImage uri={uri} style={{ width: 88, height: 88, borderRadius: 8 }} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="移除图片"
                    onPress={() => setImages((prev) => prev.filter((item) => item !== uri))}
                    className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-overlay/50"
                  >
                    <Icon as={X} size={12} className="text-primary-foreground" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="添加图片"
            onPress={() => void pickImages()}
            disabled={busy || images.length >= MAX_IMAGES}
            className="border-border mt-3 h-11 w-11 items-center justify-center rounded-lg border border-dashed"
          >
            <Icon as={ImagePlus} size={20} className="text-muted-foreground" />
          </Pressable>

          <View className="border-border mt-3 flex-row items-center rounded-lg border px-3 py-2" style={{ gap: 6 }}>
            <Icon as={MapPin} size={16} className="text-primary" />
            <TextInput
              className="text-foreground flex-1 text-sm"
              value={locationName}
              onChangeText={setLocationName}
              placeholder="在哪里?(选填,手输地点名)"
              accessibilityLabel="位置名称"
            />
          </View>

          <Button className="mt-4" onPress={() => void submit()} disabled={busy}>
            <Text>{busy ? '发布中…' : '发布'}</Text>
          </Button>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
