/**
 * token 存储的共用实现。`token.ts`(iOS/Android)与 `token.harmony.ts`(鸿蒙)各绑一个
 * 强度不同的驱动,对上层暴露同一组 API,业务代码对差异无感知(spec D4)。
 *
 * 载荷:契约 1.2 的 `{ token, tokenName, expiresIn }` 加本地写入时间,
 * 冷启动时可先做一次"必然过期"的快速判断,省掉一次 401 往返。
 */
import { memoryDriver, type KvDriver } from './kv';

export interface StoredSession {
  token: string;
  /** 请求头名,契约固定返回 `Authorization`,但仍按服务端值处理。 */
  tokenName: string;
  /** 绝对过期时间戳(ms);服务端未给 expiresIn 时为 null。 */
  expiresAt: number | null;
  savedAt: number;
}

export interface TokenStore {
  /** 存储实现标识,诊断页与上报用。 */
  kind: string;
  read(): Promise<StoredSession | null>;
  write(session: Omit<StoredSession, 'savedAt'>): Promise<void>;
  clear(): Promise<void>;
}

export const SESSION_KEY = 'guardfind.session.v1';

/**
 * iOS/Android 侧的系统级安全存储(Keychain / Keystore)驱动登记处。
 * `expo-secure-store` 在 RNOH 无已验证适配,一期不引;等通过
 * `pnpm dlx expo-harmony-cli install` 引入验证过的安全存储包后,
 * 在应用入口调用 `registerSecureDriver` 即可升级,业务零改动。
 */
let secureDriver: KvDriver | null = null;

export function registerSecureDriver(driver: KvDriver): void {
  secureDriver = driver;
}

export function getSecureDriver(): KvDriver | null {
  return secureDriver;
}

export function createTokenStore(
  resolveDriver: () => { driver: KvDriver; kind: string },
  fallbackKind: string,
): TokenStore {
  return {
    kind: fallbackKind,
    async read() {
      try {
        const raw = await resolveDriver().driver.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredSession;
        if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null;
        return parsed;
      } catch {
        // spec: 存储读取抛异常时按未登录处理,不白屏、不崩溃。
        return null;
      }
    },
    async write(session) {
      const payload: StoredSession = { ...session, savedAt: Date.now() };
      const serialized = JSON.stringify(payload);
      // 内存镜像永远先写:持久化失败时当前进程会话仍然有效。
      await memoryDriver.setItem(SESSION_KEY, serialized).catch(() => undefined);
      try {
        await resolveDriver().driver.setItem(SESSION_KEY, serialized);
      } catch {
        // 降级为进程内会话:不抛,由诊断页展示当前存储强度。
      }
    },
    async clear() {
      await Promise.all([
        memoryDriver.removeItem(SESSION_KEY).catch(() => undefined),
        resolveDriver()
          .driver.removeItem(SESSION_KEY)
          .catch(() => undefined),
      ]);
    },
  };
}

export function isSessionExpired(session: StoredSession | null): boolean {
  if (!session || session.expiresAt === null) return false;
  // 提前 30 秒判过期,避免卡在临界点又发一个 401。
  return session.expiresAt - 30_000 <= Date.now();
}

export function sessionFromExpiry(input: {
  token: string;
  tokenName?: string | null;
  expiresIn?: number | null;
}): Omit<StoredSession, 'savedAt'> {
  const tokenName = input.tokenName?.trim() || 'Authorization';
  const expiresIn = typeof input.expiresIn === 'number' && input.expiresIn > 0 ? input.expiresIn : null;
  return {
    token: input.token,
    tokenName,
    expiresAt: expiresIn === null ? null : Date.now() + expiresIn * 1000,
  };
}
