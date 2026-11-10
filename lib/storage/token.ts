/**
 * 会话存储实现(iOS / Android / 鸿蒙共用;目前没有 token.harmony.ts 分派)。
 * 原生端尚未注册持久化 kv 驱动,实际落在内存驱动上:冷启动会丢登录态,诊断标签如实显示 `kv-memory`。
 *
 * 强度说明(spec D4 的风险条目):
 *   首选驱动 = 通过 `registerSecureDriver` 登记的系统安全存储(Keychain / Keystore)。
 *   一期尚未安装任何安全存储原生包(`expo-secure-store` 在 RNOH 无已验证适配,故不引),
 *   因此当前实际落到 `kv` 驱动上 —— 强度低于系统密钥库,已按威胁模型记录:
 *   靠后端收紧 token 有效期与设备数降低泄露收益,不宣称与 Keychain 同等强度。
 */
import { getCurrentDriver, type KvDriver } from './kv';
import {
  createTokenStore,
  getSecureDriver,
  type TokenStore,
} from './token-core';

function resolve(): { driver: KvDriver; kind: string } {
  const secure = getSecureDriver();
  if (secure) return { driver: secure, kind: 'secure-keychain' };
  const driver = getCurrentDriver();
  // 内存驱动不持久,诊断标签如实反映,避免把本次运行会话误报成已落盘。
  return { driver, kind: driver.persistent ? 'kv-app-storage' : `kv-${driver.name}` };
}

const base = createTokenStore(resolve, 'kv-app-storage');

export const tokenStore: TokenStore = {
  ...base,
  get kind() {
    return resolve().kind;
  },
};

export type { TokenStore, StoredSession } from './token-core';
export {
  isSessionExpired,
  sessionFromExpiry,
  registerSecureDriver,
} from './token-core';
