/**
 * 1. 账号与会话(`/app/auth`)—— 字段逐字对齐契约 1 节。
 */
import { api } from '../client';

export type Gender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type IdentityType = 'GUARDIAN' | 'VOLUNTEER' | 'PUBLIC';
export type RealNameStatus = 'UNCHECKED' | 'CHECKING' | 'PASSED' | 'REJECTED';
export type SmsScene = 'LOGIN' | 'RESET' | 'BIND';
export type LoginType = 'PHONE' | 'ACCOUNT';

/** 契约 1.1:未注册手机号验证通过即自动建档。 */
export interface SendSmsCodeReq {
  phone: string;
  scene: SmsScene;
}

/**
 * 契约 1.1 的 data 在表头写 `null`、正文又要求 `data.expireSeconds` 供倒计时校准,
 * 两处不一致。这里按"可空对象"实现:字段缺失时客户端退回本地 60 秒。差异已记入交付报告。
 */
export interface SendSmsCodeResp {
  expireSeconds?: number | null;
}

export interface LoginByPhoneReq {
  authType: 'PHONE';
  phone: string;
  code: string;
  /** 连续 3 次错误后必填。 */
  captchaId?: string | null;
  captchaValue?: string | null;
}

export interface LoginByAccountReq {
  authType: 'ACCOUNT';
  account: string;
  password: string;
}

export type LoginReq = LoginByPhoneReq | LoginByAccountReq;

export interface AppUser {
  id: string;
  nickname: string;
  avatar: string | null;
  gender: Gender;
  /** 已脱敏,如 138****1234。 */
  phone: string | null;
  boundPhone: boolean;
  identityType: IdentityType;
  realNameStatus: RealNameStatus;
  provinceCode: string | null;
  cityCode: string | null;
  districtCode: string | null;
  volunteerVerified: boolean;
  hasPassword: boolean;
  unreadCount: number;
  createdAt: string;
}

export interface LoginResp {
  token: string;
  tokenName: string;
  expiresIn: number;
  isNewUser: boolean;
  user: AppUser;
}

/** 全部可选,PUT 时只提交改过的键。 */
export interface AppProfileReq {
  nickname?: string;
  avatar?: string;
  gender?: Gender;
  identityType?: IdentityType;
  provinceCode?: string;
  cityCode?: string;
  districtCode?: string;
}

export interface ChangePasswordReq {
  oldPassword?: string;
  newPassword: string;
  phone?: string;
  code?: string;
}

export interface ResetPasswordReq {
  phone: string;
  code: string;
  newPassword: string;
}

/** 契约:注销返回 15 日冷静期与截止日。 */
export interface EraseAccountResp {
  cooldownDays: number;
  deadline: string;
}

export const authApi = {
  sendSmsCode: (req: SendSmsCodeReq) =>
    api.post<SendSmsCodeResp | null>('/app/auth/sms-code', req, { anonymous: true }),
  login: (req: LoginReq) => api.post<LoginResp>('/app/auth/login', req, { anonymous: true }),
  logout: () => api.post<null>('/app/auth/logout'),
  me: () => api.get<AppUser>('/app/auth/me'),
  updateProfile: (req: AppProfileReq) => api.put<AppUser>('/app/auth/profile', req),
  changePassword: (req: ChangePasswordReq) => api.post<null>('/app/auth/password', req),
  resetPassword: (req: ResetPasswordReq) =>
    api.post<null>('/app/auth/reset-password', req, { anonymous: true }),
  deleteAccount: (reason: string) =>
    api.delete<EraseAccountResp>('/app/auth/account', { reason }),
};
