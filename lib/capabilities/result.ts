/**
 * 能力分派层的结果类型(spec: app-harmony-compatibility / 平台能力分派层)。
 *
 * 规则:任一能力在不支持的平台上 MUST 返回可识别的 `unsupported`,
 * 由调用方展示降级 UI —— 能力层自己不弹提示、不抛异常、更不崩溃。
 */

export type CapabilityFailureReason =
  /** 当前平台没有已验证的实现(鸿蒙最常见)。 */
  | 'unsupported'
  /** 用户或系统拒绝了权限。 */
  | 'denied'
  /** 调用过程出错(可重试)。 */
  | 'failed'
  /** 取消,不算错误。 */
  | 'cancelled';

export type CapabilityResult<T> =
  | { ok: true; value: T; /** 实际生效的实现名,便于诊断页展示。 */ via: string }
  | {
      ok: false;
      reason: CapabilityFailureReason;
      /** 直接可展示给用户的中文文案。 */
      message: string;
      /** 面向支持方的技术细节,不进 UI。 */
      detail?: string;
      via: string;
    };

export function unsupported<T>(
  message: string,
  via: string,
  detail?: string,
): CapabilityResult<T> {
  return { ok: false, reason: 'unsupported', message, detail, via };
}

export function failed<T>(
  message: string,
  via: string,
  detail?: string,
): CapabilityResult<T> {
  return { ok: false, reason: 'failed', message, detail, via };
}

export function cancelled<T>(via: string): CapabilityResult<T> {
  return { ok: false, reason: 'cancelled', message: '已取消', via };
}

export function ok<T>(value: T, via: string): CapabilityResult<T> {
  return { ok: true, value, via };
}

/** 探测"是否存在某个全局能力",不触发任何原生加载。 */
export function hasGlobal(path: string[]): boolean {
  try {
    let cursor: unknown = globalThis;
    for (const key of path) {
      if (cursor === null || cursor === undefined) return false;
      cursor = (cursor as Record<string, unknown>)[key];
    }
    return cursor !== undefined && cursor !== null;
  } catch {
    return false;
  }
}
