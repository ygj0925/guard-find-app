/**
 * HarmonyOS 侧音乐播放(RNOH 0.77.71 现状:RN 核心无音频播放,
 * expo-av / expo-audio 均未实机验证,一期不引)。
 *
 * 鸿蒙接入路径(验证通过后替换本文件,调用方零改动):
 *   1) pnpm dlx expo-harmony-cli install expo-av
 *   2) 用 expo-av 的 Audio.Sound 实现 load/play/pause/seek/snapshot
 *   3) 后台播放与锁屏控制需要 AVSession(音频会话),二期再做
 */
import { type CapabilityResult, unsupported } from './result';
import type { MusicPlayerApi, MusicTrack } from './music';

class HarmonyMusicPlayer implements MusicPlayerApi {
  readonly kind = 'music:harmony-placeholder';

  isAvailable(): boolean {
    return false;
  }

  pickTracks(): Promise<CapabilityResult<MusicTrack[]>> {
    return Promise.resolve(
      unsupported<MusicTrack[]>(
        '当前设备暂不支持本地音乐播放,等原生音频能力接入后开放。',
        this.kind,
        '鸿蒙侧 expo-av 未实机验证;验证通过后经 expo-harmony-cli 安装并替换本文件。',
      ),
    );
  }

  load(): void {
    return undefined;
  }

  play(): void {
    return undefined;
  }

  pause(): void {
    return undefined;
  }

  select(): void {
    return undefined;
  }

  seek(): void {
    return undefined;
  }

  snapshot(): PlaybackStatePlaceholder {
    return { index: -1, playing: false, position: 0, duration: 0 };
  }
}

interface PlaybackStatePlaceholder {
  index: number;
  playing: boolean;
  position: number;
  duration: number;
}

/** 与默认实现同名导出,调用方 import 路径保持不变。 */
export const musicPlayer: MusicPlayerApi = new HarmonyMusicPlayer();
