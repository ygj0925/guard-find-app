/**
 * 能力分派层的唯一出口。业务页面只 import 这里,平台差异由 Metro 的 `.harmony.ts`
 * 后缀分派解决(spec: 平台能力分派层 —— 页面组件不得出现 Platform.OS)。
 */
export {
  imagePicker,
  UNAVAILABLE_MESSAGE as IMAGE_PICKER_UNAVAILABLE,
  type ImagePickerApi,
  type PickedImage,
} from './image-picker';
export {
  imageCompress,
  COMPRESS_TARGET_LONG_EDGE,
  type CompressedImage,
  type ImageCompressApi,
} from './image-compress';
export { shareApi, type ShareApi, type SharePayload } from './share';
export { clipboard, type ClipboardApi } from './clipboard';
export { musicPlayer, formatTrackTime, nextIndex, prevIndex, ratioToSeconds, trackDisplayName, type MusicPlayerApi, type MusicTrack, type PlaybackState } from './music';
export {
  type CapabilityResult,
  type CapabilityFailureReason,
} from './result';
