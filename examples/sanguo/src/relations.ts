/**
 * Cross-person relationships for the Sanguo example.
 *
 * These are explicit, human-confirmed connections — the opposite of the
 * machine-suggested similarity edges. They are persisted as `CavinEdge`
 * entries and drawn on the canvas as solid lines.
 *
 * The `parentId` tree already covers family/succession, so this list focuses
 * on the meaningful political/military/personal links: 君臣、同僚、师徒、
 * 对手、盟友、旧友、不和 etc.
 */

export interface SanguoRelation {
  from: string
  to: string
  type: string
  note?: string
}

export interface SanguoEdge {
  id: string
  from: string
  to: string
  createdAt: number
  /** Human-readable relation label, e.g. "主公" / "师徒". */
  label?: string
}

export const RELATIONS: SanguoRelation[] = [
  /* ============================ 蜀 ============================ */
  { from: 'liu-bei', to: 'zhuge-liang', type: '三顾茅庐 · 君臣' },
  { from: 'liu-bei', to: 'guan-yu', type: '义兄弟 · 君臣' },
  { from: 'liu-bei', to: 'zhang-fei', type: '义兄弟 · 君臣' },
  { from: 'liu-bei', to: 'zhao-yun', type: '君臣 · 护卫' },
  { from: 'liu-bei', to: 'ma-chao', type: '君臣' },
  { from: 'liu-bei', to: 'huang-zhong', type: '君臣' },
  { from: 'liu-bei', to: 'fa-zheng', type: '谋主 · 君臣' },
  { from: 'liu-bei', to: 'pang-tong', type: '谋主 · 君臣' },
  { from: 'liu-bei', to: 'mi-zhu', type: '元从 · 资助' },
  { from: 'liu-bei', to: 'sun-qian', type: '元从 · 幕僚' },
  { from: 'liu-bei', to: 'jian-yong', type: '元从 · 故交' },
  { from: 'liu-bei', to: 'liu-zhang', type: '同宗 · 取益州' },
  { from: 'liu-bei', to: 'cao-cao', type: '青梅煮酒 · 对手' },
  { from: 'liu-bei', to: 'sun-quan', type: '盟友 · 联姻' },

  { from: 'guan-yu', to: 'zhang-fei', type: '义兄弟' },
  { from: 'guan-yu', to: 'zhao-yun', type: '同僚' },
  { from: 'guan-yu', to: 'huang-zhong', type: '同僚' },
  { from: 'guan-yu', to: 'cao-cao', type: '知遇 · 敬重' },
  { from: 'guan-yu', to: 'lv-meng', type: '对手 · 白衣渡江' },
  { from: 'guan-yu', to: 'sun-quan', type: '对手' },
  { from: 'guan-yu', to: 'zhang-liao', type: '旧友 · 同乡' },

  { from: 'zhang-fei', to: 'zhao-yun', type: '同僚' },
  { from: 'zhang-fei', to: 'yan-yan', type: '义释 · 收降' },

  { from: 'zhao-yun', to: 'zhuge-liang', type: '君臣 · 同僚' },
  { from: 'ma-chao', to: 'ma-dai', type: '从兄弟' },

  { from: 'zhuge-liang', to: 'pang-tong', type: '卧龙凤雏 · 同僚' },
  { from: 'zhuge-liang', to: 'fa-zheng', type: '同僚' },
  { from: 'zhuge-liang', to: 'jiang-wei', type: '师徒 · 传人' },
  { from: 'zhuge-liang', to: 'ma-su', type: '赏识 · 街亭之失' },
  { from: 'zhuge-liang', to: 'jiang-wan', type: '举荐 · 继任' },
  { from: 'zhuge-liang', to: 'fei-yi', type: '举荐 · 继任' },
  { from: 'zhuge-liang', to: 'dong-yun', type: '举荐' },
  { from: 'zhuge-liang', to: 'wei-yan', type: '部下 · 猜疑' },
  { from: 'zhuge-liang', to: 'sima-yi', type: '宿敌 · 五丈原' },

  { from: 'pang-tong', to: 'zhang-ren', type: '对手 · 落凤坡' },
  { from: 'fa-zheng', to: 'huang-zhong', type: '定军山献策' },
  { from: 'ma-su', to: 'zhang-he', type: '对手 · 街亭' },

  { from: 'wei-yan', to: 'yang-yi', type: '不和 · 争权' },
  { from: 'zhang-fei', to: 'zhang-bao', type: '父子' },
  { from: 'zhao-yun', to: 'zhao-tong', type: '父子' },
  { from: 'zhao-yun', to: 'zhao-guang', type: '父子' },

  /* ============================ 魏 ============================ */
  { from: 'cao-cao', to: 'xun-yu', type: '王佐 · 谋主' },
  { from: 'cao-cao', to: 'xun-you', type: '谋主' },
  { from: 'cao-cao', to: 'guo-jia', type: '谋主 · 奇佐' },
  { from: 'cao-cao', to: 'jia-xu', type: '谋主 · 毒士' },
  { from: 'cao-cao', to: 'cheng-yu', type: '谋臣' },
  { from: 'cao-cao', to: 'liu-ye', type: '谋臣' },
  { from: 'cao-cao', to: 'sima-yi', type: '君臣 · 猜忌' },
  { from: 'cao-cao', to: 'zhang-liao', type: '君臣 · 五子良将' },
  { from: 'cao-cao', to: 'yue-jin', type: '君臣 · 五子良将' },
  { from: 'cao-cao', to: 'yu-jin', type: '君臣 · 五子良将' },
  { from: 'cao-cao', to: 'zhang-he', type: '君臣 · 五子良将' },
  { from: 'cao-cao', to: 'xu-huang', type: '君臣 · 五子良将' },
  { from: 'cao-cao', to: 'dian-wei', type: '亲卫 · 救命' },
  { from: 'cao-cao', to: 'xu-chu', type: '亲卫 · 虎痴' },
  { from: 'cao-cao', to: 'lv-bu', type: '对手 · 濮阳/下邳' },

  { from: 'xun-yu', to: 'xun-you', type: '同族 · 叔侄' },
  { from: 'xun-yu', to: 'guo-jia', type: '同僚' },
  { from: 'guo-jia', to: 'jia-xu', type: '同僚' },
  { from: 'sima-yi', to: 'cao-shuang', type: '政敌 · 高平陵' },
  { from: 'cao-pi', to: 'cao-zhi', type: '兄弟 · 争储' },
  { from: 'cao-pi', to: 'zhen-furen', type: '夫妻 · 赐死' },
  { from: 'deng-ai', to: 'zhong-hui', type: '同僚 · 灭蜀内斗' },
  { from: 'deng-ai', to: 'jiang-wei', type: '对手 · 灭蜀' },

  /* ============================ 吴 ============================ */
  { from: 'sun-jian', to: 'sun-ce', type: '父子 · 继承' },
  { from: 'sun-jian', to: 'sun-quan', type: '父子 · 继承' },
  { from: 'sun-ce', to: 'sun-quan', type: '兄弟 · 托付' },
  { from: 'sun-ce', to: 'zhou-yu', type: '总角之交 · 君臣' },
  { from: 'sun-quan', to: 'zhou-yu', type: '君臣 · 赤壁' },
  { from: 'sun-quan', to: 'lu-su', type: '君臣 · 榻上策' },
  { from: 'sun-quan', to: 'lv-meng', type: '君臣 · 士别三日' },
  { from: 'sun-quan', to: 'lu-xun', type: '君臣 · 夷陵' },
  { from: 'sun-quan', to: 'zhang-zhao', type: '托孤 · 直臣' },
  { from: 'sun-quan', to: 'zhuge-jin', type: '君臣 · 重臣' },
  { from: 'sun-quan', to: 'gu-yong', type: '君臣 · 丞相' },
  { from: 'sun-quan', to: 'cao-cao', type: '称臣 · 对手' },

  { from: 'zhou-yu', to: 'lu-su', type: '同僚 · 继任' },
  { from: 'lu-su', to: 'lv-meng', type: '同僚 · 继任' },
  { from: 'lv-meng', to: 'lu-xun', type: '同僚 · 继任' },
  { from: 'sun-ce', to: 'taishi-ci', type: '收降 · 信义' },
  { from: 'sun-quan', to: 'gan-ning', type: '君臣 · 锦帆' },
  { from: 'sun-quan', to: 'zhou-tai', type: '护卫 · 救命' },
  { from: 'sun-quan', to: 'ling-tong', type: '护卫 · 逍遥津' },
  { from: 'lu-xun', to: 'lu-kang', type: '父子 · 继任' },
  { from: 'zhuge-jin', to: 'zhuge-ke', type: '父子' },
  { from: 'zhuge-jin', to: 'zhuge-liang', type: '兄弟 · 各仕一方' },

  /* ============================ 群雄 / 汉末 ============================ */
  { from: 'dong-zhuo', to: 'lv-bu', type: '义父子 · 部下' },
  { from: 'lv-bu', to: 'diaochan', type: '演义 · 情侣' },
  { from: 'wang-yun', to: 'diaochan', type: '义父女 · 连环计' },
  { from: 'wang-yun', to: 'dong-zhuo', type: '政敌 · 除董卓' },
  { from: 'yuan-shao', to: 'yuan-shu', type: '兄弟 · 不和' },
  { from: 'yuan-shao', to: 'cao-cao', type: '旧友 · 官渡对手' },
  { from: 'yuan-shao', to: 'tian-feng', type: '谋主 · 冤杀' },
  { from: 'yuan-shao', to: 'ju-shou', type: '谋主 · 不用' },
  { from: 'yuan-shao', to: 'shen-pei', type: '谋臣 · 忠臣' },
  { from: 'liu-biao', to: 'liu-bei', type: '同宗 · 收留' },
  { from: 'liu-yan', to: 'liu-zhang', type: '父子 · 益州' },
  { from: 'gongsun-zan', to: 'liu-bei', type: '同窗 · 旧友' },
  { from: 'sima-hui', to: 'zhuge-liang', type: '赏识 · 水镜荐才' },
  { from: 'sima-hui', to: 'pang-tong', type: '赏识 · 水镜荐才' },
  { from: 'pang-degong', to: 'pang-tong', type: '叔侄 · 赏识' },
  { from: 'hua-tuo', to: 'cao-cao', type: '医患 · 猜忌' },
  { from: 'zhang-xiu', to: 'cao-cao', type: '宛城 · 降而复叛' },
  { from: 'gongsun-zan', to: 'zhao-yun', type: '旧主 · 未得重用' },
]

/** Pair key used to de-duplicate undirected relations. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

/**
 * Build confirmed edge entries for the framework. Labels are carried on the
 * edge so the detail panel can say what the connection means.
 */
export function generateSanguoEdges(): SanguoEdge[] {
  const seen = new Set<string>()
  const out: SanguoEdge[] = []
  for (const r of RELATIONS) {
    if (r.from === r.to) continue
    const key = pairKey(r.from, r.to)
    if (seen.has(key)) continue
    seen.add(key)
    const label = r.note ? `${r.type} · ${r.note}` : r.type
    out.push({
      id: `rel:${key}`,
      from: r.from,
      to: r.to,
      createdAt: 0,
      label,
    })
  }
  return out
}
