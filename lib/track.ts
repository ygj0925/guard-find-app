/**
 * 行为埋点(契约 3.2 `POST /app/plaza/track`)。
 *
 * 两条规则:
 *   1. 埋点是尽力而为 —— 契约写明该接口按 IP 限流,失败 MUST NOT 影响业务,所以一律吞掉;
 *   2. 只上报 id 与事件类型,MUST NOT 把姓名、地址等档案内容带出去。
 */
import { plazaApi, type TrackEventType } from '@/lib/api/endpoints/plaza';
import { capture } from './monitor';

export function track(
  eventType: TrackEventType,
  targetId: string,
  targetCase: string,
  durationMs?: number,
): void {
  if (!targetId) return;
  plazaApi
    .track({ eventType, targetId, targetCase, durationMs })
    .catch((error: unknown) => {
      capture('DEBUG', `埋点 ${eventType} 未送达`, {
        detail: error instanceof Error ? error.message : String(error),
      });
    });
}

/** 卡片/详情点击:targetId 与 targetCase 同为档案 id。 */
export function trackCaseClick(caseId: string): void {
  track('CLICK', caseId, caseId);
}

/** 详情页曝光。`durationMs` 由页面在离开时补发,一期只在进入时记一次。 */
export function trackCaseExpose(caseId: string): void {
  track('EXPOSE', caseId, caseId);
}

export function trackCaseShare(caseId: string): void {
  track('SHARE', caseId, caseId);
}
