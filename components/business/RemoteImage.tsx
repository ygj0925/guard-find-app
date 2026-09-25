/**
 * 远程图片:必须用 `react-native` 的 `Image` + `uri`。
 * `expo-image` / `expo-asset` 在鸿蒙侧会被 shim 掉导致静默不显示(spec 硬约束,已进 lint 规则)。
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';

export interface RemoteImageProps {
  uri: string | null | undefined;
  /** 尺寸由外层 className 或 style 决定。 */
  style?: React.ComponentProps<typeof Image>['style'];
  resizeMode?: 'cover' | 'contain';
  /** 无障碍与加载失败时展示的替代文案。 */
  fallbackLabel?: string;
  onPress?: () => void;
  testID?: string;
}

export function RemoteImage({
  uri,
  style,
  resizeMode = 'cover',
  fallbackLabel = '照片暂不可见',
  onPress,
  testID,
}: RemoteImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 换源(切卡片、重传)时重置状态,否则会一直停在上一次的失败占位。
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [uri]);

  const showPlaceholder = !uri || failed;

  const body = (
    <View style={styles.container} testID={testID}>
      {!showPlaceholder ? (
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          accessibilityRole="image"
        />
      ) : null}
      {!showPlaceholder && !loaded ? <View style={styles.loading} /> : null}
      {showPlaceholder ? (
        <View style={styles.placeholder}>
          <Text className="text-muted-foreground text-xs" numberOfLines={2}>
            {fallbackLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress}>{body}</Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#e5e7eb', minHeight: 44 },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    backgroundColor: '#eef2f7',
  },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e5e7eb' },
});
