/**
 * 亲戚称呼计算纯函数(三代内常用关系)。
 * 路径编码:每个字符代表一步关系,f=父 m=母 ob=兄 lb=弟 os=姐 ls=妹 s=子 d=女 h=夫 w=妻。
 * 简化处理: assumes 直系+旁系三代内,不做姻亲回环。
 */

export interface KinshipStep {
  /** 关系步骤文案(用于 UI 展示路径)。 */
  label: string;
  /** 编码字符。 */
  code: string;
}

export const KINSHIP_STEPS: KinshipStep[] = [
  { label: '爸爸', code: 'f' },
  { label: '妈妈', code: 'm' },
  { label: '儿子', code: 's' },
  { label: '女儿', code: 'd' },
  { label: '哥哥', code: 'ob' },
  { label: '弟弟', code: 'lb' },
  { label: '姐姐', code: 'os' },
  { label: '妹妹', code: 'ls' },
  { label: '丈夫', code: 'h' },
  { label: '妻子', code: 'w' },
];

/** 三代内称呼映射表(key = 路径编码,如 "ff" = 爷爷)。 */
const KINSHIP_MAP: Record<string, string> = {
  // 直系长辈
  f: '爸爸', m: '妈妈',
  ff: '爷爷', fm: '奶奶',
  mf: '外公', mm: '外婆',
  // 直系晚辈
  s: '儿子', d: '女儿',
  ss: '孙子', sd: '孙女',
  ds: '外孙', dd: '外孙女',
  // 兄弟姐妹
  ob: '哥哥', lb: '弟弟', os: '姐姐', ls: '妹妹',
  // 旁系:父系
  fob: '伯父', flb: '叔叔', fos: '姑妈', fls: '姑妈',
  fobs: '堂兄弟', flbs: '堂兄弟',
  // 旁系:母系
  mob: '舅舅', mlb: '舅舅', mos: '姨妈', mls: '姨妈',
  // 姻亲:配偶方
  h: '丈夫', w: '妻子',
  hf: '公公', hm: '婆婆',
  wf: '岳父', wm: '岳母',
  hs: '继子', hd: '继女',
  // 孩子
  sh: '女婿', sw: '儿媳',
  // 兄弟姐妹的孩子
  obs: '侄子', obd: '侄女',
  lbs: '侄子', lbd: '侄女',
  oss: '外甥', osd: '外甥女',
  lss: '外甥', lsd: '外甥女',
};

/** 从路径编码计算称呼;未收录返回 null。 */
export function kinshipTitle(path: string): string | null {
  const key = path.replace(/[^fmoblsdhw]/g, '');
  if (!key) return null;
  return KINSHIP_MAP[key] ?? null;
}

/** 用户可选择的步骤列表(用于 UI 逐步选择)。 */
export function availableSteps(): KinshipStep[] {
  return KINSHIP_STEPS;
}
