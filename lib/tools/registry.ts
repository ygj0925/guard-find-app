/**
 * 工具注册表:全部工具的唯一清单,工具箱宫格与首页快捷入口共用。
 * 新增工具:在此加一条 + 路由注册即可,两处入口自动出现。
 * 每个工具有 category 字段,驱动宫格图标的分类着色(视觉辨识度)。
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  CalendarClock,
  CalendarRange,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Flame,
  CloudSun,
  HeartPulse,
  KeyRound,
  ListTodo,
  MessagesSquare,
  Music,
  Percent,
  Ruler,
  Sparkles,
  SquareDashed,
  Target,
  Users,
  Wallet,
} from 'lucide-react-native';

export type ToolCategory = 'finance' | 'productivity' | 'health' | 'social' | 'utility';

export interface ToolEntry {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: ToolCategory;
  /** 已上线工具的跳转路由;未上线不配置。 */
  href?: string;
}

/** 分类中文名(设置页/筛选用)。 */
export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  finance: '金融',
  productivity: '效率',
  health: '健康',
  social: '社交',
  utility: '工具',
};

/**
 * 分类着色(图标底色 + 图标前景):不在 token 体系内引新色,
 * 用 HSL 内联值保证与暗色 token 的对比度;饱和度 < 60% 避免刺眼。
 */
export const CATEGORY_COLORS: Record<ToolCategory, { bg: string; fg: string }> = {
  finance:      { bg: 'rgba(52,152,219,0.12)', fg: '#3498db' },
  productivity: { bg: 'rgba(155,89,182,0.12)', fg: '#9b59b6' },
  health:       { bg: 'rgba(46,204,113,0.12)', fg: '#2ecc71' },
  social:       { bg: 'rgba(230,126,34,0.12)', fg: '#e67e22' },
  utility:      { bg: 'rgba(149,165,166,0.15)', fg: '#7f8c8d' },
};

export const TOOL_REGISTRY: ToolEntry[] = [
  { key: 'ledger', title: '记账', description: '记一笔 · 日账单 · 周月年报', icon: Wallet, category: 'finance', href: '/tools/ledger' },
  { key: 'ai', title: 'AI 对话', description: '智能助手 · 翻译 · 写作', icon: Sparkles, category: 'productivity', href: '/ai/conversations' },
  { key: 'habits', title: '习惯打卡', description: '连续天数 · 打卡月历', icon: Flame, category: 'health', href: '/tools/habits' },
  { key: 'countdown', title: '倒数日', description: '考试 · 纪念日 · 还款日', icon: CalendarClock, category: 'productivity', href: '/tools/countdown' },
  { key: 'todo', title: '待办清单', description: '每日计划 · AI 拆解', icon: ListTodo, category: 'productivity', href: '/tools/todo' },
  { key: 'split', title: 'AA 分账', description: '聚餐分账 · 一键记入账本', icon: Users, category: 'finance', href: '/tools/split' },
  { key: 'checkin', title: '在线签到', description: '发起签到 · 动态码防代签', icon: ClipboardCheck, category: 'productivity', href: '/tools/checkin' },
  { key: 'tasks', title: '任务分派', description: '家人互派 · 状态流转', icon: ClipboardList, category: 'productivity', href: '/tools/tasks' },
  { key: 'goals', title: '目标 OKR', description: '定目标 · 拆 KR · 量化进度', icon: Target, category: 'productivity', href: '/tools/goals' },
  { key: 'clock', title: '时钟秒表', description: '时钟 · 秒表 · 计时器 · 番茄钟', icon: Clock, category: 'utility', href: '/tools/clock' },
  { key: 'music', title: '音乐播放', description: '本地音频 · 播放列表', icon: Music, category: 'utility', href: '/tools/music' },
  { key: 'mortgage', title: '房贷计算', description: '等额本息 · 等额本金', icon: Calculator, category: 'finance', href: '/tools/mortgage' },
  { key: 'text', title: '文本工具', description: '字数 · 时间戳 · 进制 · JSON', icon: SquareDashed, category: 'utility', href: '/tools/text-toolkit' },
  { key: 'health', title: '健康计算', description: 'BMI · 基础代谢 · 饮水', icon: HeartPulse, category: 'health', href: '/tools/health' },
  { key: 'datecalc', title: '日期计算', description: '间隔天数 · 当年进度', icon: CalendarRange, category: 'utility', href: '/tools/date-calc' },
  { key: 'random', title: '随机决定', description: '转盘 · 骰子 · 硬币', icon: Ruler, category: 'utility', href: '/tools/random' },
  { key: 'unit', title: '单位换算', description: '长度 · 重量 · 温度 · 离线可用', icon: Ruler, category: 'utility', href: '/tools/unit-convert' },
  { key: 'calc', title: '计算器', description: '基础四则 · 离线可用', icon: Calculator, category: 'utility', href: '/tools/calculator' },
  { key: 'password', title: '密码生成', description: '安全随机 · 强度评分', icon: KeyRound, category: 'utility', href: '/tools/password' },
  { key: 'discount', title: '折扣比较', description: '比单价 · 算折扣', icon: Percent, category: 'finance', href: '/tools/discount' },
  { key: 'forum', title: '圈子论坛', description: '发帖 · 交流 · 互助', icon: MessagesSquare, category: 'social' },
  { key: 'weather', title: '天气', description: '实时天气 · 未来趋势', icon: CloudSun, category: 'utility' },
];

/** 按 key 取工具;未知 key(如被下线的置顶残留)返回 null。 */
export function getTool(key: string): ToolEntry | null {
  return TOOL_REGISTRY.find((tool) => tool.key === key) ?? null;
}

/** 首页快捷入口的默认展示(用户还没置顶时)。 */
export const DEFAULT_QUICK_KEYS = ['ledger', 'ai', 'checkin', 'todo'];
