/**
 * 8. 客户端支撑 —— 上传(`/file/upload`)与客户端日志(`/app/client-log`)。
 *
 * 上传是 `multipart/form-data`,字段名固定 `file` + `path`,复用后端既有接口。
 * 图片读取走 react-native 的本地 uri,不引 expo-file-system(无已验证鸿蒙适配)。
 */
import { api } from '../client';
import type { MonitorLevel } from '../../monitor';

export interface UploadTarget {
  uri: string;
  name: string;
  type: string;
}

export interface UploadResp {
  url: string;
  name: string;
  size: number;
}

/**
 * `path` 是后端存储前缀。一期按业务域分目录,便于审计。
 */
export type UploadPath = 'case' | 'lead' | 'avatar' | 'report' | 'post';

export interface ClientLogReq {
  level: MonitorLevel;
  message: string;
  stack?: string;
  platform: string;
  appVersion: string;
  route: string;
  extra?: Record<string, unknown>;
}

export const uploadApi = {
  /**
   * 上传单个文件。`FormData` 在 RN 与 Web 都可用,不依赖 expo-file-system。
   * 超时单独放宽到 60 秒:15 秒对弱网下的图片上传太紧,会误判成失败。
   */
  file: (target: UploadTarget, path: UploadPath) => {
    const form = new FormData();
    form.append('path', path);
    form.append('file', {
      uri: target.uri,
      name: target.name,
      type: target.type,
      // RN 的 FormData 接受 {uri,name,type} 这种"文件对象",TS 签名里没有,故断言。
    } as unknown as Blob);
    return api.post<UploadResp>('/file/upload', undefined, {
      rawBody: form as unknown as Record<string, unknown>,
      timeoutMs: 60_000,
    });
  },
};

export const clientLogApi = {
  submit: (req: ClientLogReq) => api.post<null>('/app/client-log', req),
};
