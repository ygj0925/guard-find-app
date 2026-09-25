/**
 * 鸿蒙侧分享降级:RNOH 的 ShareModule 未实机验证,一期统一返回 unsupported,
 * 由调用方(卡片/详情)降级为"复制链接"。
 *
 * 备注:RNOH 0.77.71 的 `Libraries/Share` 有 delegate 实现,但本仓库未做真机验证,
 * 按"未验证即不承诺"的规则先返回 unsupported,验证通过后替换本文件即可。
 */
import { type CapabilityResult, unsupported } from './result';
import type { ShareApi, SharePayload } from './share';

class HarmonyShareApi implements ShareApi {
  readonly kind = 'share:harmony-placeholder';

  isAvailable(): boolean {
    return false;
  }

  share(): Promise<CapabilityResult<{ copiedFallback: boolean }>> {
    return Promise.resolve(
      unsupported<{ copiedFallback: boolean }>(
        '当前设备暂不支持系统分享面板,请使用"复制链接"。',
        this.kind,
        'RNOH 的 ShareModule 未在本仓库真机验证。',
      ),
    );
  }
}

export const shareApi: ShareApi = new HarmonyShareApi();
export type { SharePayload };
