/**
 * 鸿蒙侧剪贴板:与默认实现同源(Web API 探测),但多一层明示 ——
 * RNOH 未提供验证过的 Clipboard 模块,一期统一降级为"长按选中复制"。
 */
import { type CapabilityResult, unsupported } from './result';
import type { ClipboardApi } from './clipboard';

class HarmonyClipboard implements ClipboardApi {
  readonly kind = 'clipboard:harmony-placeholder';

  isAvailable(): boolean {
    return false;
  }

  copy(): Promise<CapabilityResult<{ length: number }>> {
    return Promise.resolve(
      unsupported<{ length: number }>(
        '当前设备暂不支持一键复制,请长按选中文字后手动复制。',
        this.kind,
        'RNOH 0.77.71 未验证 Clipboard 模块;可经 expo-harmony-cli 安装 expo-clipboard 后替换。',
      ),
    );
  }
}

export const clipboard: ClipboardApi = new HarmonyClipboard();
