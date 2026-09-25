/**
 * HarmonyOS 侧图片选取(RNOH 0.77.71 现状:无已验证适配,一期不引 expo-image-picker)。
 *
 * Metro 在打包 harmony 平台时用本文件替换 `image-picker.ts`,所以发布表单在鸿蒙上
 * 拿到的一定是 reason='unsupported' 的结果,展示降级文案而不是崩溃 ——
 * 这正是 spec「鸿蒙上图片选取失败可识别」的验收点。
 */
import { type CapabilityResult, unsupported } from './result';
import { UNAVAILABLE_MESSAGE } from './constants';
import type { ImagePickerApi, PickedImage } from './image-picker';

class HarmonyImagePicker implements ImagePickerApi {
  readonly kind = 'image-picker:harmony-placeholder';

  isAvailable(): boolean {
    return false;
  }

  pickImages(): Promise<CapabilityResult<PickedImage[]>> {
    return Promise.resolve(
      unsupported<PickedImage[]>(
        '当前设备暂不支持选择图片,可先填写文字,稍后在草稿箱继续补图。',
        this.kind,
        '鸿蒙侧 expo-image-picker 未实机验证;验证通过后经 expo-harmony-cli 安装并替换本文件。',
      ),
    );
  }
}

/** 与默认实现同名导出,调用方 import 路径保持不变。 */
export const imagePicker: ImagePickerApi = new HarmonyImagePicker();
/** `lib/capabilities/index.ts` 会把这条文案以 `IMAGE_PICKER_UNAVAILABLE` 之名再导出,鸿蒙侧必须同样存在。 */
export { UNAVAILABLE_MESSAGE };
