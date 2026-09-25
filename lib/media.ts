/**
 * 图片选择 -> 压缩 -> 上传这条链路上的公共类型与规则。
 *
 * 为什么单独一个模块:发布表单(≤9 张)与线索表单(≤3 张)都要处理
 * "选择阶段就拦超额/超大、上传失败可单张重试"(spec: 媒体选取与压缩),
 * 两边共用同一份状态形状,页面只留渲染。
 */
import { imageCompress, imagePicker, type PickedImage } from '@/lib/capabilities';
import { uploadApi, type UploadPath } from '@/lib/api/endpoints/upload';

/** 单张上限 5MB(契约:超出 MUST 在选择阶段就提示)。 */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export interface MediaItem extends PickedImage {
  /** 本地列表内唯一键:同一张图重选也保持同一个 key,避免 React 复用错节点。 */
  key: string;
  /** 上传成功后的远端地址;null 表示还没成功。 */
  url: string | null;
  state: 'uploading' | 'done' | 'error';
  /** 失败原因,已是可以直接展示的文案。 */
  message?: string;
}

export interface MediaLimitResult {
  accepted: MediaItem[];
  rejected: { image: PickedImage; reason: 'too-large' | 'over-limit' }[];
  truncated: number;
}

export function toMediaItem(image: PickedImage, index = 0): MediaItem {
  return {
    ...image,
    key: `${image.uri || 'image'}-${index}-${image.fileName ?? ''}`,
    url: null,
    state: 'uploading',
  };
}

/** 选择阶段的即时拦截:先限张数,再限单张体积。 */
export function applyMediaLimits(
  current: MediaItem[],
  picked: PickedImage[],
  max: number,
  maxBytes = MAX_MEDIA_BYTES,
): MediaLimitResult {
  const accepted: MediaItem[] = [...current];
  const rejected: MediaLimitResult['rejected'] = [];
  let truncated = 0;
  for (const image of picked) {
    if (accepted.length >= max) {
      truncated += 1;
      rejected.push({ image, reason: 'over-limit' });
      continue;
    }
    if (typeof image.size === 'number' && image.size > maxBytes) {
      rejected.push({ image, reason: 'too-large' });
      continue;
    }
    accepted.push(toMediaItem(image, accepted.length));
  }
  return { accepted, rejected, truncated };
}

export function limitRejectSummary(rejected: MediaLimitResult['rejected']): string | null {
  if (!rejected.length) return null;
  const tooLarge = rejected.filter((item) => item.reason === 'too-large').length;
  const overLimit = rejected.filter((item) => item.reason === 'over-limit').length;
  const parts: string[] = [];
  if (tooLarge) parts.push(`${tooLarge} 张超过 5MB 已丢弃`);
  if (overLimit) parts.push(`超出数量上限的 ${overLimit} 张未加入`);
  return parts.join(';');
}

/**
 * 压缩 + 上传单张图。
 * 压缩能力不可用时(鸿蒙/无原生实现的 RN)按原图上传,但在结果里保留说明,
 * 由调用方决定要不要提示 —— 能力层自己不弹提示(spec 规则)。
 */
export async function uploadMediaItem(
  item: MediaItem,
  path: UploadPath,
): Promise<{ ok: true; url: string; note?: string } | { ok: false; message: string }> {
  const compressed = await imageCompress.compress(item);
  const target = compressed.ok ? compressed.value : item;
  try {
    const resp = await uploadApi.file(
      {
        uri: target.uri,
        name: target.fileName ?? guessName(target.uri),
        type: target.mimeType ?? 'image/jpeg',
      },
      path,
    );
    return {
      ok: true,
      url: resp.url,
      note: compressed.ok ? undefined : compressed.message,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '上传失败,请重试或改用其他图片',
    };
  }
}

function guessName(uri: string): string {
  const clean = uri.split('?')[0] ?? '';
  const tail = clean.split('/').pop();
  return tail && tail.includes('.') ? tail : `image-${Date.now()}.jpg`;
}

/** 图片选取的当前可用性(页面用它决定按钮是置灰还是隐藏)。 */
export function mediaPickerAvailable(): boolean {
  return imagePicker.isAvailable();
}

export { imagePicker };
