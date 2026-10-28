/**
 * 音乐播放能力分派(spec: 平台能力分派层)。
 *
 * RN 核心没有音频播放:原生侧(iOS/Android/鸿蒙)必须依赖原生模块
 * (expo-av / expo-audio),而鸿蒙侧需 `pnpm dlx expo-harmony-cli install expo-av`
 * 并实机验证——在验证通过前,本能力在鸿蒙返回可识别的 unsupported,
 * 页面展示降级文案而不是崩溃(与 image-picker 同模式)。
 *
 * Web 端用 HTML5 Audio 完整可用(与 clipboard 的 navigator 探测同模式)。
 *
 * TODO(接入原生步骤,接入后调用方零改动):
 *   1) pnpm dlx expo-harmony-cli install expo-av
 *   2) 默认实现里按平台 lazy import expo-av 的 Audio.Sound
 *   3) 鸿蒙真机验证;后台播放/锁屏控制需音频会话与 MediaSession,二期再做
 */
import { type CapabilityResult, failed, ok, unsupported } from './result';

export interface MusicTrack {
  /** 播放地址(file:// 或 content:// 或 objectURL)。 */
  uri: string;
  /** 展示名(文件名去扩展)。 */
  name: string;
  /** 时长(秒,选取后探测;未知为 0)。 */
  duration?: number;
}

export interface PlaybackState {
  /** 正在播放的曲目下标;无则为 -1。 */
  index: number;
  playing: boolean;
  /** 当前位置与时长(秒)。 */
  position: number;
  duration: number;
}

export interface MusicPlayerApi {
  readonly kind: string;
  /** 当前平台是否具备播放能力(用于置灰入口而不是点了才报错)。 */
  isAvailable(): boolean;
  /**
   * 选取音频文件(Web=文件控件;原生=文档选择器)。
   */
  pickTracks(max: number): Promise<CapabilityResult<MusicTrack[]>>;
  /** 加载播放列表并定位到 index。 */
  load(tracks: MusicTrack[], index: number): void;
  play(): void;
  pause(): void;
  /** 跳转到列表中另一首(自动播放)。 */
  select(index: number): void;
  /** 拖动进度(秒)。 */
  seek(seconds: number): void;
  /** 当前状态快照(轮询用,避免事件监听泄漏)。 */
  snapshot(): PlaybackState;
}

/** 列表内下一首(循环);单首时返回自身。 */
export function nextIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  return (index + 1) % length;
}

/** 列表内上一首(循环)。 */
export function prevIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  return (index - 1 + length) % length;
}

/** 秒 -> `m:ss`。 */
export function formatTrackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds) % 60;
  const m = Math.floor(seconds / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 进度条点击:按比例换算秒(ratio 钳制到 0-1)。 */
export function ratioToSeconds(ratio: number, duration: number): number {
  if (!Number.isFinite(ratio) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, ratio)) * duration;
}

/** 文件名去扩展与路径。 */
export function trackDisplayName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  return base.replace(/\.[a-z0-9]{1,5}$/i, '') || base;
}

/** Web Audio 探测(与 clipboard 的 navigator 探测同模式)。 */
function hasWebAudio(): boolean {
  return typeof (globalThis as unknown as { Audio?: unknown }).Audio === 'function';
}

interface WebFile {
  name: string;
  type?: string;
}

class WebAudioMusicPlayer implements MusicPlayerApi {
  readonly kind = 'music:web-audio';
  private audio: HTMLAudioElement | null = null;
  private tracks: MusicTrack[] = [];
  private index = -1;

  isAvailable(): boolean {
    return hasWebAudio();
  }

  async pickTracks(max: number): Promise<CapabilityResult<MusicTrack[]>> {
    if (!hasWebAudio()) {
      return unsupported<MusicTrack[]>(
        '当前环境暂不支持音频播放。',
        this.kind,
        '缺少 HTMLAudioElement(非 Web 环境)。',
      );
    }
    try {
      const picked = await pickWebAudioFiles(max);
      const tracks = picked.map((file) => ({
        uri: createObjectUrl(file),
        name: trackDisplayName(file.name),
        duration: 0,
      }));
      return ok(tracks, this.kind);
    } catch (cause) {
      return failed<MusicTrack[]>('选择音频失败', this.kind, String(cause));
    }
  }

  load(tracks: MusicTrack[], index: number): void {
    this.tracks = tracks;
    this.select(index);
  }

  play(): void {
    this.audio?.play().catch(() => undefined);
  }

  pause(): void {
    this.audio?.pause();
  }

  select(index: number): void {
    if (index < 0 || index >= this.tracks.length) return;
    this.index = index;
    this.audio?.pause();
    this.audio = new Audio(this.tracks[index].uri);
  }

  seek(seconds: number): void {
    if (this.audio && Number.isFinite(this.audio.duration)) {
      this.audio.currentTime = Math.min(seconds, this.audio.duration);
    }
  }

  snapshot(): PlaybackState {
    return {
      index: this.index,
      playing: this.audio ? !this.audio.paused : false,
      position: this.audio?.currentTime ?? 0,
      duration: Number.isFinite(this.audio?.duration) ? (this.audio?.duration ?? 0) : 0,
    };
  }
}

class UnsupportedMusicPlayer implements MusicPlayerApi {
  readonly kind = 'music:unavailable';

  isAvailable(): boolean {
    return false;
  }

  async pickTracks(): Promise<CapabilityResult<MusicTrack[]>> {
    return unsupported<MusicTrack[]>(
      '当前设备暂不支持本地音乐播放。',
      this.kind,
      '缺少原生音频模块:请执行 pnpm dlx expo-harmony-cli install expo-av 并实机验证后接入。',
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

  snapshot(): PlaybackState {
    return { index: -1, playing: false, position: 0, duration: 0 };
  }
}

function hasDocument(): boolean {
  return typeof (globalThis as { document?: unknown }).document === 'object';
}

/** Web 文件控件(仅接受音频 MIME)。 */
function pickWebAudioFiles(max: number): Promise<WebFile[]> {
  return new Promise((resolve, reject) => {
    const input = (globalThis as { document?: Document }).document?.createElement('input');
    if (!input) {
      reject(new Error('no document'));
      return;
    }
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = max > 1;
    input.onchange = () => {
      const files = Array.from(input.files ?? []).slice(0, max);
      if (files.length === 0) {
        reject(new Error('cancelled'));
        return;
      }
      resolve(files);
    };
    input.click();
  });
}

function createObjectUrl(file: WebFile): string {
  const creator = (globalThis as unknown as { URL?: { createObjectURL?(b: unknown): string } })?.URL
    ?.createObjectURL;
  if (typeof creator !== 'function') return '';
  try {
    return creator.call((globalThis as unknown as { URL: unknown }).URL, file);
  } catch {
    return '';
  }
}

export const musicPlayer: MusicPlayerApi = hasDocument() ? new WebAudioMusicPlayer() : new UnsupportedMusicPlayer();
