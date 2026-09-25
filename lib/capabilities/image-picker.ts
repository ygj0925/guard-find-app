/**
 * 图片选取能力分派(spec: 媒体选取与压缩 / 平台能力分派层)。
 *
 * 一期不引 `expo-image-picker`(它需要 `pnpm dlx expo-harmony-cli install` 安装并实机验证)。
 * 在装好之前,本模块返回可识别的 `unsupported`,发布流程降级为"先填文字、稍后在草稿箱补图",
 * MUST NOT 崩溃、MUST NOT 静默失败。装好后按下面的 TODO 换实现即可,调用方零改动。
 *
 * TODO(接入步骤):
 *   1) pnpm dlx expo-harmony-cli install expo-image-picker
 *   2) grep -rl requireNativeModule node_modules/expo-image-picker/build 做顶层审计
 *   3) 若顶层 require 原生模块,则本文件保留 lazy import,并让 image-picker.harmony.ts 继续返回 unsupported
 */
import { type CapabilityResult, cancelled, failed, ok, unsupported } from './result';
import { UNAVAILABLE_MESSAGE } from './constants';

export type PickedImageSource = 'LIBRARY' | 'CAMERA';

export interface PickedImage {
  /** 本地可上传地址(file:// 或 content://)。 */
  uri: string;
  fileName?: string;
  mimeType?: string;
  /** 字节数,选取阶段就要用它拦 5MB 上限。 */
  size?: number;
  width?: number;
  height?: number;
}

export interface ImagePickerApi {
  /** 实际生效的实现标识,诊断用。 */
  readonly kind: string;
  /** 当前平台是否具备选取能力(用于把按钮置灰而不是点了才报错)。 */
  isAvailable(): boolean;
  /**
   * @param max 本次最多选几张。超出部分由调用方截断并即时提示(契约: 单档案 9 张)。
   */
  pickImages(max: number): Promise<CapabilityResult<PickedImage[]>>;
}

class UnsupportedImagePicker implements ImagePickerApi {
  readonly kind = 'image-picker:unavailable';

  isAvailable(): boolean {
    return false;
  }

  async pickImages(): Promise<CapabilityResult<PickedImage[]>> {
    return unsupported<PickedImage[]>(
      UNAVAILABLE_MESSAGE,
      this.kind,
      '缺少 expo-image-picker:请执行 pnpm dlx expo-harmony-cli install expo-image-picker',
    );
  }
}

/**
 * Web 预览用的退化实现:浏览器文件控件。
 * 只用于 `expo export --platform web` 的走查,不承诺选择体验。
 */
class WebInputImagePicker implements ImagePickerApi {
  readonly kind = 'image-picker:web-input';

  isAvailable(): boolean {
    return hasDocument();
  }

  pickImages(max: number): Promise<CapabilityResult<PickedImage[]>> {
    if (!hasDocument()) {
      return Promise.resolve(unsupported<PickedImage[]>(UNAVAILABLE_MESSAGE, this.kind));
    }
    return new Promise((resolve) => {
      const document = getDocument();
      if (!document) {
        resolve(unsupported<PickedImage[]>(UNAVAILABLE_MESSAGE, this.kind));
        return;
      }
      try {
        const input = document.createElement('input') as WebFileInput;
        let settled = false;
        const settle = (result: CapabilityResult<PickedImage[]>) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          resolve(result);
        };
        // 浏览器没有"取消文件框"事件,兜底一个超时避免调用方永远 await 下去。
        const guard = setTimeout(() => settle(cancelled<PickedImage[]>(this.kind)), 120_000);
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = max > 1;
        input.onchange = () => {
          const files = fileListToArray(input.files).slice(0, max);
          if (!files.length) {
            settle(cancelled<PickedImage[]>(this.kind));
            return;
          }
          settle(
            ok<PickedImage[]>(
              files.map((file) => ({
                uri: createObjectUrl(file),
                fileName: file.name,
                mimeType: file.type || 'image/jpeg',
                size: file.size,
              })),
              this.kind,
            ),
          );
        };
        input.click();
      } catch (error) {
        resolve(
          failed<PickedImage[]>(
            '读取图片失败,请重试或改用其他图片。',
            this.kind,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    });
  }
}

/**
 * 最小 DOM 形状:RN 的 tsconfig 不含 lib.dom,这里只声明用到的成员,
 * 避免为了 Web 兜底把 DOM 类型全局引进来。
 */
interface WebFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}
interface WebFileList {
  readonly length: number;
  item(index: number): WebFile | null;
}
interface WebFileInput {
  type: string;
  accept: string;
  multiple: boolean;
  files: WebFileList | null;
  onchange: (() => void) | null;
  click(): void;
}
interface WebDocument {
  createElement(tag: string): unknown;
}

function hasDocument(): boolean {
  return typeof (globalThis as { document?: unknown }).document !== 'undefined';
}

function getDocument(): WebDocument | null {
  const doc = (globalThis as { document?: unknown }).document;
  return doc ? (doc as unknown as WebDocument) : null;
}

function fileListToArray(list: WebFileList | null): WebFile[] {
  if (!list) return [];
  const out: WebFile[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const file = list.item(index);
    if (file) out.push(file);
  }
  return out;
}

function createObjectUrl(file: WebFile): string {
  const creator = (globalThis as unknown as { URL?: { createObjectURL?(b: WebFile): string } })
    ?.URL?.createObjectURL;
  if (typeof creator !== 'function') return '';
  try {
    return (creator as (b: WebFile) => string).call((globalThis as unknown as { URL: unknown }).URL, file);
  } catch {
    return '';
  }
}

export const imagePicker: ImagePickerApi = hasDocument()
  ? new WebInputImagePicker()
  : new UnsupportedImagePicker();

export { UNAVAILABLE_MESSAGE };
