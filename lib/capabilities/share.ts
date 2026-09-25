/**
 * 分享能力。默认走 `react-native` 的 `Share`(iOS/Android 原生支持,零新增依赖);
 * 鸿蒙侧见 `share.harmony.ts` —— RNOH 的 ShareModule 未实机验证,一期直接返回 unsupported
 * 并由调用方降级为"复制链接"。
 */
import { Share } from 'react-native';
import { type CapabilityResult, cancelled, failed, ok } from './result';

export interface SharePayload {
  title: string;
  message: string;
  /** 档案落地链接,契约要求带编号。 */
  url: string;
}

export interface ShareApi {
  readonly kind: string;
  isAvailable(): boolean;
  share(payload: SharePayload): Promise<CapabilityResult<{ copiedFallback: boolean }>>;
}

class ReactNativeShare implements ShareApi {
  readonly kind = 'share:react-native';

  isAvailable(): boolean {
    return typeof Share?.share === 'function';
  }

  async share(payload: SharePayload): Promise<CapabilityResult<{ copiedFallback: boolean }>> {
    if (!this.isAvailable()) {
      return failed<{ copiedFallback: boolean }>(
        '当前设备未提供系统分享面板,请使用"复制链接"。',
        this.kind,
      );
    }
    try {
      const result = await Share.share({
        title: payload.title,
        message: payload.message,
        url: payload.url,
      });
      if (result.action === Share.dismissedAction) {
        return cancelled<{ copiedFallback: boolean }>(this.kind);
      }
      return ok<{ copiedFallback: boolean }>({ copiedFallback: false }, this.kind);
    } catch (error) {
      return failed<{ copiedFallback: boolean }>(
        '系统分享未完成,请使用"复制链接"。',
        this.kind,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export const shareApi: ShareApi = new ReactNativeShare();
