/**
 * HarmonyOS 侧图片选取:暂不启用。
 *
 * expo-image-picker 已经 expo-harmony-cli 安装,补丁会在鸿蒙上转发到
 * `@react-native-ohos/react-native-image-picker`。但两点未过:一是没有实机验证;
 * 二是补丁把插件 errorCode 映射成 `canceled`,失败会被吞成"用户取消",违反 MUST NOT 静默失败。
 * 实机验证并能区分失败与取消后,再把本文件换成 expo 实现。
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
        '鸿蒙图片选取适配未实机验证,且补丁会把插件错误当作取消;验证并修正错误映射后再启用。',
      ),
    );
  }
}

/** 与默认实现同名导出,调用方 import 路径保持不变。 */
export const imagePicker: ImagePickerApi = new HarmonyImagePicker();
/** `lib/capabilities/index.ts` 会把这条文案以 `IMAGE_PICKER_UNAVAILABLE` 之名再导出,鸿蒙侧必须同样存在。 */
export { UNAVAILABLE_MESSAGE };
