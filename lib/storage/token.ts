/**
 * iOS / Android 侧的会话存储实现(默认那份;Metro 在打包 harmony 时改用 token.harmony.ts)。
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
  return secure
    ? { driver: secure, kind: 'secure-keychain' }
    : { driver: getCurrentDriver(), kind: 'kv-app-storage' };
}

export const tokenStore: TokenStore = createTokenStore(resolve, 'kv-app-storage');

export type { TokenStore, StoredSession } from './token-core';
export {
  isSessionExpired,
  sessionFromExpiry,
  registerSecureDriver,
} from './token-core';
