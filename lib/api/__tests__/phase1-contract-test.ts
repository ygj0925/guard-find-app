import { caseApi, type CaseDraftReq } from '../endpoints/case';
import { leadApi, type Lead, type LeadReq, type LeadReply } from '../endpoints/lead';
import { reportApi, type Report } from '../endpoints/me';
import { URGENCY_LABEL, caseAgeText, formatMissingHours, formatMissingMonth } from '../../format';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('../client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

it.each(['renew', 'withdraw', 'erase'] as const)('%s 返回 null 并保留可选理由', async (action) => {
  mockPost.mockResolvedValue(null);
  const response: null = await caseApi[action]('case/id', { reason: '本人确认' });
  expect(response).toBeNull();
  expect(mockPost).toHaveBeenCalledWith(`/app/find/case/case%2Fid/${action}`, { reason: '本人确认' });
});

it('找回允许服务端填充时间并返回 null', async () => {
  mockPost.mockResolvedValue(null);
  const response: null = await caseApi.found('7', { confirmType: 'GUARDIAN' });
  expect(response).toBeNull();
  expect(mockPost).toHaveBeenCalledWith('/app/find/case/7/found', { confirmType: 'GUARDIAN' });
});

it('未完成草稿只要求姓名,不编造提交字段', async () => {
  const request: CaseDraftReq = { name: '测试档案' };
  mockPost.mockResolvedValue({ id: '7', status: 'DRAFT' });
  await expect(caseApi.create(request)).resolves.toMatchObject({ status: 'DRAFT' });
  expect(mockPost).toHaveBeenCalledWith('/app/find/case', { name: '测试档案' });
});

it('线索回复返回实际对象而非 null 类型', async () => {
  const reply: LeadReply = { id: '9', content: '感谢', from: 'OWNER', time: '2026-11-11 10:00:00' };
  mockPost.mockResolvedValue(reply);
  const response: LeadReply = await leadApi.reply('lead/id', '感谢');
  expect(response).toEqual(reply);
  expect(mockPost).toHaveBeenCalledWith('/app/lead/lead%2Fid/reply', { content: '感谢' });
});

it('线索请求允许省略时间地点,响应允许可空字段与处置备注', async () => {
  const request: LeadReq = { description: '在公交站看到相似的身影' };
  const lead: Lead = {
    id: '7', caseId: '8', caseName: null, occurTime: null, occurAddress: null,
    description: request.description, mediaUrls: [], contactMode: 'IN_APP', contactValue: null,
    submitterMasked: '好心人', status: 'PENDING', highRisk: false, handleRemark: null,
    replies: [], createTime: '2026-11-11 10:00:00',
  };
  mockPost.mockResolvedValue(lead);
  await expect(leadApi.submit('8', request)).resolves.toEqual(lead);
});

it('本人线索查询携带分页及 status', async () => {
  mockGet.mockResolvedValue({ records: [], total: 0 });
  await leadApi.mine({ page: 2, size: 10, status: 'CONTACTED' });
  expect(mockGet).toHaveBeenCalledWith('/app/lead/mine', { page: 2, size: 10, status: 'CONTACTED' });
});

it('举报使用 targetName、APPROVED 与证据数组', async () => {
  const report: Report = {
    id: '7', targetType: 'CASE', targetId: '8', targetName: '测试档案', reasonType: 'FRAUD',
    description: null, mediaUrls: ['test-image'], hitCount: 1, status: 'APPROVED',
    handleRemark: '已处理', createTime: '2026-11-11 10:00:00',
  };
  mockGet.mockResolvedValue({ records: [report], total: 1 });
  await expect(reportApi.mine({ page: 1, size: 10 })).resolves.toEqual({ records: [report], total: 1 });
});

it('服务端 STANDING 与未知时间年龄都能显示文案', () => {
  expect(URGENCY_LABEL.STANDING).toBe('长期未破');
  expect(caseAgeText({ ageAtMissing: null, ageGroup: null })).toBe('年龄不详');
  expect(formatMissingHours(null)).toBe('时长未知');
  expect(formatMissingMonth(null)).toBe('时间未知');
});
