import { api } from '../client';
import { sendAiMessage, fetchAiWeeklyReport, requestAiDecompose, fetchAiLedgerInsight } from '../endpoints/ai';

jest.mock('../client', () => ({ api: { post: jest.fn().mockResolvedValue({}) } }));

it('allows model generation to reach the server timeout while preserving payloads', async () => {
  await sendAiMessage('123', 'hello');
  await fetchAiWeeklyReport('2026-11-17');
  await requestAiDecompose('task');
  await fetchAiLedgerInsight('week');
  expect(api.post).toHaveBeenNthCalledWith(1, '/app/ai/conversation/123/message', { content: 'hello' }, { timeoutMs: 75000 });
  expect(api.post).toHaveBeenNthCalledWith(2, '/app/ai/weekly-report', undefined, { params: { date: '2026-11-17' }, timeoutMs: 75000 });
  expect(api.post).toHaveBeenNthCalledWith(3, '/app/ai/decompose', { content: 'task' }, { timeoutMs: 75000 });
  expect(api.post).toHaveBeenNthCalledWith(4, '/app/ai/ledger-insight', undefined, { params: { period: 'week' }, timeoutMs: 75000 });
});
