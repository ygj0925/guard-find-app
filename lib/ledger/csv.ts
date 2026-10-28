/**
 * 记账 CSV 导出纯函数:服务端分页数据 -> RFC 4840 安全的 CSV 文本。
 * 金额/备注等字段统一加引号转义,防公式注入(= 开头前置单引号)。
 */
import type { LedgerRecord } from '@/lib/api/endpoints/ledger';

function csvCell(value: string): string {
  const safe = /^[=+\-@\t]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildLedgerCsv(records: LedgerRecord[], typeLabel: (record: LedgerRecord) => string): string {
  const header = '记账日期,类型,金额(元),分类,备注';
  const lines = records.map((record) =>
    [
      csvCell(record.recordDate),
      csvCell(typeLabel(record)),
      csvCell(record.amount.toFixed(2)),
      csvCell(record.category),
      csvCell(record.remark ?? ''),
    ].join(','),
  );
  // BOM:Excel 打开中文不乱码
  return `\uFEFF${[header, ...lines].join('\r\n')}`;
}

export function csvFileName(month: string): string {
  return `guardfind-ledger-${month || 'all'}.csv`;
}
