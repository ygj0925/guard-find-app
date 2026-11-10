import { emptyPublishValues, softenMediaError, toCaseReq, validateStep, type PublishValues } from '../schema';

function filled(patch: Partial<PublishValues> = {}): PublishValues {
  return {
    ...emptyPublishValues(),
    relationType: 'PARENT',
    name: '张小宝',
    gender: 'MALE',
    ageAtMissing: 5,
    media: [{ key: 'a', uri: 'file://a.jpg', url: 'https://cdn.test/a.jpg', state: 'done' }],
    missingTime: '2026-01-01 10:00:00',
    provinceCode: '13',
    cityCode: '1304',
    height: 110,
    caseType: 'MISSING',
    narrative: '傍晚在小区门口玩耍时走失,穿红色外套。',
    bloodSampleStatus: 'COLLECTED',
    agreementRights: true,
    agreementTruthful: true,
    ...patch,
  };
}

describe('发布分步校验', () => {
  it('完整填写时五步都通过', () => {
    for (const step of [0, 1, 2, 3, 4] as const) {
      expect(validateStep(step, filled())).toEqual({ ok: true, errors: {} });
    }
  });

  it('第一步错误定位到具体字段', () => {
    const result = validateStep(0, filled({ name: '张', media: [], relationType: '' }));
    expect(result.ok).toBe(false);
    expect(result.errors).toMatchObject({
      name: '姓名至少 2 个字',
      media: '请至少上传 1 张近照',
      relationType: '请选择与您的关系',
    });
  });

  it('失踪时间不能晚于现在', () => {
    const result = validateStep(1, filled({ missingTime: '2999-01-01 10:00:00' }));
    expect(result.errors.missingTime).toBe('失踪时间不能晚于当前时间');
  });

  it('缺体貌(身高与特征描述都空)时阻断第三步', () => {
    const blocked = validateStep(2, filled({ height: null, features: '  ' }));
    expect(blocked.ok).toBe(false);
    expect(blocked.errors.features).toContain('至少填写一项体貌特征');
    expect(validateStep(2, filled({ height: null, features: '左眉有疤' })).ok).toBe(true);
  });

  it('公开电话必须填合法号码,已报警必须填派出所', () => {
    const result = validateStep(
      3,
      filled({ contactMode: 'PHONE', contactPhone: '123', policeReported: true, policeStation: '' }),
    );
    expect(result.errors).toMatchObject({
      contactPhone: '手机号格式不正确',
      policeStation: '已报警请填写受理派出所',
    });
  });

  it('两项合规任一未勾选都不能提交', () => {
    expect(validateStep(4, filled({ agreementRights: false })).ok).toBe(false);
    expect(validateStep(4, filled({ agreementTruthful: false })).ok).toBe(false);
  });

  it('选图不可用时只放过"至少 1 张近照",其他必填照旧拦截', () => {
    const onlyMedia = validateStep(0, filled({ media: [] }));
    expect(softenMediaError(0, onlyMedia, false).ok).toBe(true);
    expect(softenMediaError(0, onlyMedia, true).ok).toBe(false);
    const withName = validateStep(0, filled({ media: [], name: '' }));
    expect(softenMediaError(0, withName, false).ok).toBe(false);
  });

  it('提交时情形为空直接拒绝,草稿允许留空', () => {
    const values = filled({ caseType: '' });
    expect(() => toCaseReq(values, { submit: true, agreementVersion: 'v1', uploadedUrls: [] })).toThrow(
      '请选择失踪情形',
    );
    const draft = toCaseReq(values, { submit: false, agreementVersion: 'v1', uploadedUrls: ['u1'] });
    expect(draft.caseType).toBe('');
    expect(draft.mediaUrls).toEqual([{ url: 'u1', type: 'PHOTO', sort: 0 }]);
  });

  it('联络方式不是电话时不上送号码', () => {
    const req = toCaseReq(filled({ contactMode: 'IN_APP', contactPhone: '13800000000' }), {
      submit: true,
      agreementVersion: 'v1',
      uploadedUrls: [],
    });
    expect(req.contactPhone).toBeNull();
    expect(req.agreementAccepted).toBe(true);
  });
});
