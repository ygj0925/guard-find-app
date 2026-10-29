/**
 * 会话 store(zustand)—— token、用户信息、身份类型、常驻地、未读数(spec 2.7)。
 *
 * 这里是 `configureClient` 的注册点:client.ts 通过回调取 token,避免 client <-> store 循环依赖。
 * 401 的"全局只触发一次"也落在这里:清会话 + 记录回跳目标,由 providers/SessionProvider 执行导航。
 */
import { create } from 'zustand';
import { configureClient, notifyAuthenticated } from '@/lib/api/client';
import { authApi, type AppProfileReq, type AppUser, type IdentityType, type LoginResp } from '@/lib/api/endpoints/auth';
import { messageApi } from '@/lib/api/endpoints/message';
import {
  isSessionExpired,
  sessionFromExpiry,
  tokenStore,
  type StoredSession,
} from '@/lib/storage/token';

export type SessionPhase =
  /** 冷启动还没读完本地 token。 */
  | 'booting'
  | 'anonymous'
  | 'authenticated';

export interface UnauthorizedEvent {
  at: number;
  /** 触发 401 时所在路径,登录成功后回跳用。 */
  fromPath: string | null;
}

interface SessionState {
  phase: SessionPhase;
  token: string | null;
  tokenName: string;
  user: AppUser | null;
  unreadCount: number;
  /** 登录响应 isNewUser=true 时的非阻断资料引导。 */
  needsProfileSetup: boolean;
  unauthorized: UnauthorizedEvent | null;
  /** 存储实现标识,诊断页展示。 */
  storageKind: string;
  restore: () => Promise<'authenticated' | 'anonymous'>;
  applyLogin: (resp: LoginResp) => Promise<void>;
  /** 静默刷新用户信息;失败时清会话。 */
  refreshUser: () => Promise<AppUser | null>;
  signOut: () => Promise<void>;
  patchUser: (patch: Partial<AppUser>) => void;
  updateProfile: (req: AppProfileReq) => Promise<AppUser>;
  setUnreadCount: (count: number) => void;
  bumpUnread: (delta?: number) => void;
  dismissProfileSetup: () => void;
  clearUnauthorized: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  phase: 'booting',
  token: null,
  tokenName: 'Authorization',
  user: null,
  unreadCount: 0,
  needsProfileSetup: false,
  unauthorized: null,
  storageKind: tokenStore.kind,

  async restore() {
    const stored = await tokenStore.read();
    if (!stored || isSessionExpired(stored)) {
      if (stored) await tokenStore.clear();
      set({ phase: 'anonymous', token: null, user: null, unreadCount: 0 });
      return 'anonymous';
    }
    set({
      phase: 'authenticated',
      token: stored.token,
      tokenName: stored.tokenName,
      storageKind: tokenStore.kind,
    });
    notifyAuthenticated();
    try {
      const user = await authApi.me();
      set({ user, unreadCount: user.unreadCount ?? 0, phase: 'authenticated' });
      return 'authenticated';
    } catch (error) {
      // 契约:code=401 才清会话;其他错误(网络)保留 token,避免弱网被踢出登录。
      if ((error as { code?: number }).code === 401) {
        await get().signOut();
        return 'anonymous';
      }
      set({ phase: 'authenticated' });
      return 'authenticated';
    }
  },

  async applyLogin(resp: LoginResp) {
    const session: Omit<StoredSession, 'savedAt'> = sessionFromExpiry({
      token: resp.token,
      tokenName: resp.tokenName,
      expiresIn: resp.expiresIn,
    });
    await tokenStore.write(session);
    notifyAuthenticated();
    set({
      phase: 'authenticated',
      token: session.token,
      tokenName: session.tokenName,
      user: resp.user ?? null,
      unreadCount: resp.user?.unreadCount ?? 0,
      needsProfileSetup: Boolean(resp.isNewUser) || !resp.user?.identityType,
      storageKind: tokenStore.kind,
      unauthorized: null,
    });
  },

  async refreshUser() {
    try {
      const user = await authApi.me();
      set({ user, unreadCount: user.unreadCount ?? get().unreadCount });
      return user;
    } catch {
      return null;
    }
  },

  async signOut() {
    try {
      if (get().token) await authApi.logout();
    } catch {
      // 退出接口失败不阻塞本地清会话。
    }
    await tokenStore.clear();
    set({
      phase: 'anonymous',
      token: null,
      user: null,
      unreadCount: 0,
      needsProfileSetup: false,
      unauthorized: null,
    });
  },

  patchUser(patch) {
    const current = get().user;
    set({ user: current ? { ...current, ...patch } : current });
  },

  async updateProfile(req: AppProfileReq) {
    const user = await authApi.updateProfile(req);
    set({
      user,
      needsProfileSetup: !user.identityType || user.identityType === ('' as IdentityType),
    });
    return user;
  },

  setUnreadCount(count) {
    set({ unreadCount: Math.max(0, Number.isFinite(count) ? count : 0) });
  },

  bumpUnread(delta = 1) {
    set({ unreadCount: Math.max(0, get().unreadCount + delta) });
  },

  dismissProfileSetup() {
    set({ needsProfileSetup: false });
  },

  clearUnauthorized() {
    set({ unauthorized: null });
  },
}));

/** 401 处理入口:并发多次只记一次事件。 */
function handleUnauthorized(): void {
  const state = useSession.getState();
  if (state.unauthorized) return;
  useSession.setState({
    phase: 'anonymous',
    token: null,
    user: null,
    unreadCount: 0,
    unauthorized: { at: Date.now(), fromPath: null },
  });
  void tokenStore.clear();
}

configureClient({
  getToken: () => useSession.getState().token,
  getTokenName: () => useSession.getState().tokenName,
  onUnauthorized: () => handleUnauthorized(),
});

/** 供路由守卫使用:是否已登录且已绑手机(线索提交要求绑手机)。 */
export function isSignedIn(): boolean {
  const { phase, token } = useSession.getState();
  return phase === 'authenticated' && Boolean(token);
}

export function canSubmitLead(): boolean {
  const user = useSession.getState().user;
  return isSignedIn() && Boolean(user?.boundPhone);
}

/** 未读数即时同步:WS 推来新消息或本地已读后调用。 */
export async function syncUnreadCount(): Promise<number> {
  if (!isSignedIn()) return 0;
  try {
    const { unreadCount } = await messageApi.unread();
    useSession.getState().setUnreadCount(unreadCount);
    return unreadCount;
  } catch {
    return useSession.getState().unreadCount;
  }
}

export { handleUnauthorized };
