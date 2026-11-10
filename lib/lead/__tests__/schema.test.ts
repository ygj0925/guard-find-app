import { ApiCode, ApiError } from '@/lib/api/error';
import { isLeadAccessDenied } from '../access';
import {
  LEAD_DESCRIPTION_MAX,
  MAX_MEDIA_PER_LEAD,
  descriptionCountHint,
  emptyLeadValues,
  toLeadReq,
  validateLead,
  type LeadValues,
} from '../schema';

function filled(overrides: Partial<LeadValues> = {}): LeadValues {
  return {
    ...emptyLeadValues(),
    occurTime: '2026-11-01 08:30',
    occurAddress: '朝阳区某某公交站',
    description: '在公交站看到一个穿红衣服的小孩独自等车',
    ...overrides,
  };
}

function apiError(code: number): ApiError {
  return new ApiError({ code, msg: 'x', bizCode: code });
}

describe('线索表单校验(spec: 线索提交表单)', () => {
  it('完整填写通过', () => {
    expect(validateLead(filled())).toEqual({ ok: true, errors: {} });
  });

  it('描述不足 10 字阻断提交,并提示还差几字', () => {
    const result = validateLead(filled({ description: '看到了孩子' }));
    expect(result.ok).toBe(false);
    expect(result.errors.description).toContain('至少 10 字');
    expect(descriptionCountHint(5)).toBe('还需 5 字');
    expect(descriptionCountHint(12)).toBe(`12/${LEAD_DESCRIPTION_MAX} 字`);
    expect(descriptionCountHint(LEAD_DESCRIPTION_MAX + 3)).toBe('超出 3 字');
  });

  it('首尾空格不计入描述字数', () => {
    expect(validateLead(filled({ description: `   ${'字'.repeat(9)}   ` })).errors.description).toBeDefined();
  });

  it('图片超过 3 张阻断', () => {
    const media = Array.from({ length: MAX_MEDIA_PER_LEAD + 1 }, (_, index) => ({ uri: `file://${index}` }));
    const result = validateLead(filled({ media: media as never }));
    expect(result.errors.media).toContain(`最多 ${MAX_MEDIA_PER_LEAD} 张`);
  });

  it('发现时间晚于当前时间阻断', () => {
    const result = validateLead(filled({ occurTime: '2999-01-01 00:00' }));
    expect(result.errors.occurTime).toBe('发现时间不能晚于当前时间');
  });

  it('公开电话必须填写合法手机号', () => {
    expect(validateLead(filled({ contactMode: 'PHONE' })).errors.contactValue).toContain('须填写联系电话');
    expect(validateLead(filled({ contactMode: 'PHONE', contactValue: '123' })).errors.contactValue).toBe(
      '手机号格式不正确',
    );
    expect(validateLead(filled({ contactMode: 'PHONE', contactValue: '13800138000' })).ok).toBe(true);
  });

  it('站内联系时不上送电话,即使输入框里残留号码', () => {
    const req = toLeadReq(filled({ contactMode: 'IN_APP', contactValue: '13800138000' }), ['https://cdn/1.jpg']);
    expect(req.contactValue).toBeNull();
    expect(req.mediaUrls).toEqual(['https://cdn/1.jpg']);
    expect(toLeadReq(filled({ contactMode: 'PHONE', contactValue: ' 13800138000 ' }), []).contactValue).toBe(
      '13800138000',
    );
  });
});

describe('线索列表越权判定', () => {
  it('4003 与 403 都进入无权限态', () => {
    expect(isLeadAccessDenied(apiError(ApiCode.RULE_REJECTED))).toBe(true);
    expect(isLeadAccessDenied(apiError(ApiCode.FORBIDDEN))).toBe(true);
  });

  it('其他错误按普通失败处理', () => {
    expect(isLeadAccessDenied(apiError(ApiCode.SERVER_ERROR))).toBe(false);
    expect(isLeadAccessDenied(new Error('network'))).toBe(false);
    expect(isLeadAccessDenied(null)).toBe(false);
  });
});
