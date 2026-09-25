/**
 * 能力层共用的降级文案与阈值。
 *
 * 为什么要单独一个模块:`*.harmony.ts` 里需要复用默认实现中的常量,
 * 而 Metro 在 harmony 打包时会把 `from './image-compress'` 解析到
 * `image-compress.harmony.ts` 自己 —— 从 .harmony 文件里按值 import 同名模块
 * 会形成自我循环引用,拿到的值是 undefined。共用常量放这里,两边都只依赖本文件。
 */

/** 上传前目标长边(spec: 媒体选取与压缩)。 */
export const COMPRESS_TARGET_LONG_EDGE = 1600;

/** 无原生压缩能力时的说明。 */
export const PASSTROUGH_NOTE =
  '当前构建无原生图片压缩能力,已按原图上传前的尺寸上限拦截(单张 5MB)。';

/** 未接入系统图片选择器时的说明(默认实现与鸿蒙实现共用同一段语义)。 */
export const UNAVAILABLE_MESSAGE =
  '当前版本未接入系统图片选择器,可先填写文字内容,图片稍后在草稿箱补齐。';
