/**
 * 鸿蒙侧不加载 async-storage:expo-harmony-cli 安装时提示"未自动适配 HarmonyOS",
 * 且其 `.native.js` 在原生模块缺失时顶层抛错。接入已验证的鸿蒙适配包前,kv 保持内存态并如实标注不持久。
 */
import type { KvDriver } from './kv';

export function loadNativeKvDriver(): KvDriver | null {
  return null;
}
