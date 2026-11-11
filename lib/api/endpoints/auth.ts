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

export interface SendSmsCodeResp {
  expireSeconds: number;
}

export interface LoginDeviceReq {
  deviceId?: string | null;
  deviceName?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  osVersion?: string | null;
}

export interface LoginByPhoneReq extends LoginDeviceReq {
  authType: 'PHONE';
  phone: string;
  code: string;
  /** 同一手机号连续 3 次短信验证码错误后必填:captchaId 为 /captcha/image 下发的 uuid。 */
  captchaId?: string | null;
  captchaValue?: string | null;
}

/** 复用后台公开取图接口;后台关闭登录验证码时 isEnabled=false 且不下发图片,服务端也不再强制。 */
export interface ImageCaptchaResp {
  uuid?: string | null;
  img?: string | null;
  expireTime?: number | null;
  isEnabled: boolean;
}

export interface LoginByAccountReq extends LoginDeviceReq {
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
  deactivationCancelled: boolean;
  user: AppUser;
}

/** 全部可选,PUT 时只提交改过的键。 */
export interface AppProfileReq {
  nickname?: string | null;
  avatar?: string | null;
  gender?: Gender | null;
  identityType?: IdentityType | null;
  provinceCode?: string | null;
  cityCode?: string | null;
  districtCode?: string | null;
}

export interface ChangePasswordReq {
  oldPassword?: string | null;
  newPassword: string;
  phone?: string | null;
  code?: string | null;
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
    api.post<SendSmsCodeResp>('/app/auth/sms-code', req, { anonymous: true }),
  login: (req: LoginReq) => api.post<LoginResp>('/app/auth/login', req, { anonymous: true }),
  imageCaptcha: () =>
    api.get<ImageCaptchaResp>('/captcha/image', undefined, { anonymous: true }),
  logout: () => api.post<null>('/app/auth/logout'),
  me: () => api.get<AppUser>('/app/auth/me'),
  updateProfile: (req: AppProfileReq) => api.put<AppUser>('/app/auth/profile', req),
  changePassword: (req: ChangePasswordReq) => api.post<null>('/app/auth/password', req),
  resetPassword: (req: ResetPasswordReq) =>
    api.post<null>('/app/auth/reset-password', req, { anonymous: true }),
  deleteAccount: (reason: string) =>
    api.delete<EraseAccountResp>('/app/auth/account', { reason }),
};
