/**
 * 图片压缩能力(spec: 媒体选取与压缩 —— 上传前压到长边 1600px)。
 *
 * 现状:`react-native` 0.77 已把 `ImageEditor` 移出核心,一期不引任何图片处理原生包,
 * 所以原生侧只能返回 `unsupported`。调用方的兜底动作是硬拦"单张 5MB / 单档案 9 张",
 * 并在选择阶段就提示,而不是等上传到一半失败。
 *
 * Web 预览走 canvas 缩放(零依赖),便于浏览器里走通整条发布链路。
 * 若要原生真压缩,候选是 `expo-image-manipulator`,但它无已验证鸿蒙适配,
 * 引入前必须走 `pnpm dlx expo-harmony-cli install` + 顶层 requireNativeModule 审计。
 */
import { type CapabilityResult, failed, ok, unsupported } from './result';
import { COMPRESS_TARGET_LONG_EDGE, PASSTROUGH_NOTE } from './constants';
import type { PickedImage } from './image-picker';

export type { PickedImage };
export { COMPRESS_TARGET_LONG_EDGE, PASSTROUGH_NOTE };

export interface CompressedImage extends PickedImage {
  /** 是否真的重编码过。false 表示原图直传(尺寸未变)。 */
  compressed: boolean;
  /** 压缩后字节数;取不到时为原图大小。 */
  bytes: number;
}

export interface ImageCompressApi {
  readonly kind: string;
  isAvailable(): boolean;
  compress(image: PickedImage): Promise<CapabilityResult<CompressedImage>>;
}

class PassthroughCompressor implements ImageCompressApi {
  readonly kind = 'image-compress:passthrough';

  isAvailable(): boolean {
    return false;
  }

  compress(image: PickedImage): Promise<CapabilityResult<CompressedImage>> {
    return Promise.resolve(
      unsupported<CompressedImage>(
        PASSTROUGH_NOTE,
        this.kind,
        'RN 0.77 移除了 ImageEditor;如需真压缩请经 expo-harmony-cli 引入验证过的图片处理包。',
      ),
    );
  }
}

/** 与 PassthroughCompressor 行为一致,但语义上是"没压但可用",不阻断上传。 */
class NoopCompressor implements ImageCompressApi {
  readonly kind = 'image-compress:noop';

  isAvailable(): boolean {
    return true;
  }

  compress(image: PickedImage): Promise<CapabilityResult<CompressedImage>> {
    return Promise.resolve(
      ok<CompressedImage>(
        { ...image, compressed: false, bytes: image.size ?? 0 },
        this.kind,
      ),
    );
  }
}

class WebCanvasCompressor implements ImageCompressApi {
  readonly kind = 'image-compress:web-canvas';

  isAvailable(): boolean {
    return typeof (globalThis as { document?: unknown }).document !== 'undefined';
  }

  async compress(image: PickedImage): Promise<CapabilityResult<CompressedImage>> {
    const g = globalThis as {
      document?: {
        createElement(tag: string): unknown;
      };
      Image?: new () => {
        src: string;
        width: number;
        height: number;
        onload: (() => void) | null;
        onerror: (() => void) | null;
      };
    };
    if (!g.document || !g.Image) return new NoopCompressor().compress(image);
    try {
      const img = new g.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('decode failed'));
        img.src = image.uri;
      });
      const sourceWidth = img.width || image.width || 0;
      const sourceHeight = img.height || image.height || 0;
      if (!sourceWidth || !sourceHeight) return new NoopCompressor().compress(image);
      const scale = Math.min(1, COMPRESS_TARGET_LONG_EDGE / Math.max(sourceWidth, sourceHeight));
      const width = Math.round(sourceWidth * scale);
      const height = Math.round(sourceHeight * scale);
      const canvas = g.document.createElement('canvas') as {
        width: number;
        height: number;
        getContext(id: string): unknown;
        toDataURL(type: string, quality: number): string;
      };
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d') as {
        drawImage(image: unknown, dx: number, dy: number, dw: number, dh: number): void;
      } | null;
      if (!ctx) return failed<CompressedImage>('压缩失败,请重试。', this.kind);
      ctx.drawImage(img as unknown, 0, 0, width, height);
      const uri = canvas.toDataURL('image/jpeg', 0.82);
      return ok<CompressedImage>(
        {
          ...image,
          uri,
          width,
          height,
          mimeType: 'image/jpeg',
          compressed: scale < 1,
          bytes: Math.round((uri.length - 'data:image/jpeg;base64,'.length) * 0.75),
        },
        this.kind,
      );
    } catch (error) {
      return failed<CompressedImage>(
        '压缩失败,已退回原图。',
        this.kind,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

const hasDocument =
  typeof (globalThis as { document?: unknown }).document !== 'undefined';

export const imageCompress: ImageCompressApi = hasDocument
  ? new WebCanvasCompressor()
  : new PassthroughCompressor();
