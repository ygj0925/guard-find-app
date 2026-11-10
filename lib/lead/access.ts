import { ApiCode, ApiError } from '@/lib/api/error';

/** 线索列表越权:服务端以 4003 拒绝"非发布人且非志愿者",403 留给网关/框架层的同义拒绝。 */
export function isLeadAccessDenied(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ApiCode.FORBIDDEN || error.code === ApiCode.RULE_REJECTED)
  );
}
