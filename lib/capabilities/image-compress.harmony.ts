/**
 * HarmonyOS 图片压缩:一期无可用实现(RN 0.77 已移除 ImageEditor,RNOH 亦无验证过的
 * 图片处理包)。返回 unsupported,调用方按"上传前硬拦尺寸/体积上限"降级。
 */
import { type CapabilityResult, unsupported } from './result';
import { COMPRESS_TARGET_LONG_EDGE, PASSTROUGH_NOTE } from './constants';
import type { CompressedImage, ImageCompressApi, PickedImage } from './image-compress';

class HarmonyCompressor implements ImageCompressApi {
  readonly kind = 'image-compress:harmony-placeholder';

  isAvailable(): boolean {
    return false;
  }

  compress(): Promise<CapabilityResult<CompressedImage>> {
    return Promise.resolve(
      unsupported<CompressedImage>(
        `${PASSTROUGH_NOTE}(目标长边 ${COMPRESS_TARGET_LONG_EDGE}px 将在后续版本生效)`,
        this.kind,
      ),
    );
  }
}

export const imageCompress: ImageCompressApi = new HarmonyCompressor();
export type { PickedImage };
// index.ts 从 './image-compress' 同时转出这两个值,鸿蒙分派文件必须保持同名导出。
export { COMPRESS_TARGET_LONG_EDGE, PASSTROUGH_NOTE };
