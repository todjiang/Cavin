import type { Camp, PersonSeed, Role, Stats } from './types'

interface PersonOptions {
  courtesy?: string
  peakYear?: number
  approximate?: boolean
  summary: string
  tags?: string[]
  stats?: Stats
  parentId?: string
  relation?: string
}

function P(
  id: string,
  name: string,
  camp: Camp,
  role: Role,
  birthYear: number | undefined,
  deathYear: number | undefined,
  opts: PersonOptions,
): PersonSeed {
  return {
    id,
    name,
    camp,
    role,
    birthYear,
    deathYear,
    courtesy: opts.courtesy,
    peakYear: opts.peakYear,
    approximate: opts.approximate,
    summary: opts.summary,
    tags: opts.tags ?? [],
    stats: opts.stats,
    parentId: opts.parentId,
    relation: opts.relation,
  }
}

export const PERSONAE: PersonSeed[] = [
  /* ============================ 魏 ============================ */
  P('cao-cao', '曹操', '魏', '君主', 155, 220, {
    courtesy: '孟德', peakYear: 200, tags: ['魏武帝', '丞相', '建安风骨'],
    summary: '曹魏奠基者，统一北方，挟天子以令诸侯，亦为建安文学代表。',
    stats: [96, 72, 91, 94, 96],
  }),
  P('cao-pi', '曹丕', '魏', '君主', 187, 226, {
    courtesy: '子桓', peakYear: 220, parentId: 'cao-cao', relation: '父子/继承',
    tags: ['魏文帝', '代汉称帝', '建安文学'],
    summary: '曹操次子，代汉建魏，确立九品中正制，与曹植并称三曹。',
    stats: [78, 62, 82, 88, 85],
  }),
  P('cao-rui', '曹叡', '魏', '君主', 204, 239, {
    courtesy: '元仲', peakYear: 228, approximate: true, parentId: 'cao-pi', relation: '父子/继承',
    tags: ['魏明帝', '托孤', '景初'],
    summary: '曹丕之子，魏明帝，在位前期抵御吴蜀北伐，后期大兴土木。',
    stats: [72, 48, 84, 82, 80],
  }),
  P('cao-fang', '曹芳', '魏', '君主', 232, 274, {
    courtesy: '兰卿', peakYear: 240, parentId: 'cao-rui', relation: '继任',
    tags: ['魏少帝', '高平陵之变', '被废'],
    summary: '曹叡养子，魏少帝，高平陵之变后大权旁落，终被司马氏所废。',
    stats: [45, 30, 58, 52, 60],
  }),
  P('cao-mao', '曹髦', '魏', '君主', 241, 260, {
    courtesy: '彦士', peakYear: 255, parentId: 'cao-fang', relation: '继任',
    tags: ['高贵乡公', '司马昭之心', '讨伐司马氏'],
    summary: '曹魏第四位皇帝，不甘为傀儡，率众讨司马昭，兵败被杀。',
    stats: [58, 44, 74, 62, 78],
  }),
  P('cao-huan', '曹奂', '魏', '君主', 246, 302, {
    courtesy: '景明', peakYear: 260, parentId: 'cao-mao', relation: '继任',
    tags: ['魏元帝', '禅位司马炎', '曹魏末帝'],
    summary: '曹魏末代皇帝，禅位于司马炎，曹魏灭亡。',
    stats: [38, 22, 60, 55, 62],
  }),

  P('cao-ren', '曹仁', '魏', '宗室', 168, 223, {
    courtesy: '子孝', peakYear: 208, tags: ['宗室名将', '守江陵', '征南将军'],
    summary: '曹操从弟，曹魏宗室第一将，以善守著称。',
    stats: [86, 82, 68, 52, 75],
  }),
  P('cao-hong', '曹洪', '魏', '宗室', undefined, 232, {
    courtesy: '子廉', tags: ['宗室将领', '救曹操'],
    summary: '曹操从弟，早年救曹操于荥阳，后为曹魏宗室重臣。',
    stats: [70, 76, 48, 42, 68],
  }),
  P('cao-chun', '曹纯', '魏', '宗室', undefined, 210, {
    courtesy: '子和', tags: ['虎豹骑', '南皮之战'],
    summary: '曹操从弟，统领精锐虎豹骑，随征河北与乌桓。',
    stats: [78, 74, 62, 45, 72],
  }),
  P('cao-xiu', '曹休', '魏', '宗室', undefined, 228, {
    courtesy: '文烈', tags: ['曹魏宗室', '征东将军', '石亭之战'],
    summary: '曹操族子，曹魏东线统帅，石亭之战败于陆逊。',
    stats: [80, 72, 66, 50, 74],
  }),
  P('cao-zhen', '曹真', '魏', '宗室', undefined, 231, {
    courtesy: '子丹', tags: ['曹魏宗室', '西线统帅', '抗蜀'],
    summary: '曹魏宗室名将，主持西线抵御诸葛亮北伐。',
    stats: [84, 75, 72, 58, 78],
  }),
  P('cao-shuang', '曹爽', '魏', '宗室', undefined, 249, {
    courtesy: '昭伯', peakYear: 239, tags: ['辅政大臣', '高平陵之变'],
    summary: '曹真之子，曹叡托孤重臣，高平陵之变中被司马懿诛除。',
    stats: [52, 38, 58, 60, 55],
  }),
  P('cao-zhang', '曹彰', '魏', '宗室', undefined, 223, {
    courtesy: '子文', parentId: 'cao-cao', relation: '父子',
    tags: ['黄须儿', '勇武'],
    summary: '曹操第三子，以勇武闻名，曾北征乌桓。',
    stats: [72, 88, 45, 30, 70],
  }),
  P('cao-zhi', '曹植', '魏', '宗室', 192, 232, {
    courtesy: '子建', parentId: 'cao-cao', relation: '父子',
    tags: ['建安文学', '七步诗', '洛神赋'],
    summary: '曹操之子，才高八斗，建安文学集大成者。',
    stats: [35, 25, 86, 72, 88],
  }),
  P('cao-chong', '曹冲', '魏', '宗室', 196, 208, {
    courtesy: '仓舒', parentId: 'cao-cao', relation: '父子',
    tags: ['神童', '曹冲称象'],
    summary: '曹操幼子，以称象故事闻名，早夭。',
    stats: [20, 15, 88, 55, 80],
  }),
  P('xiahou-dun', '夏侯惇', '魏', '宗室', undefined, 220, {
    courtesy: '元让', tags: ['宗亲名将', '独眼将军', '屯田'],
    summary: '曹操亲信大将，作战勇猛，亦主持屯田。',
    stats: [82, 84, 60, 58, 76],
  }),
  P('xiahou-yuan', '夏侯渊', '魏', '宗室', undefined, 219, {
    courtesy: '妙才', tags: ['宗亲名将', '虎步关右', '定军山'],
    summary: '曹操亲信大将，擅长奔袭，定军山之战被黄忠斩杀。',
    stats: [88, 86, 62, 48, 74],
  }),
  P('xiahou-shang', '夏侯尚', '魏', '宗室', undefined, 225, {
    courtesy: '伯仁', tags: ['宗亲将领', '荆州'],
    summary: '夏侯渊之侄，曹魏宗亲将领，曾主持荆州军务。',
    stats: [74, 70, 60, 46, 70],
  }),
  P('xiahou-ba', '夏侯霸', '魏', '宗室', undefined, 259, {
    courtesy: '仲权', parentId: 'xiahou-yuan', relation: '父子',
    tags: ['宗亲将领', '后投蜀汉'],
    summary: '夏侯渊之子，司马氏掌权后投奔蜀汉，成为蜀汉后期将领。',
    stats: [76, 78, 58, 40, 68],
  }),

  P('zhang-liao', '张辽', '魏', '武将', 169, 222, {
    courtesy: '文远', peakYear: 215, tags: ['五子良将', '逍遥津', '威震江东'],
    summary: '曹魏五子良将之首，合肥之战以八百破十万，威震江东。',
    stats: [93, 92, 76, 58, 82],
  }),
  P('yue-jin', '乐进', '魏', '武将', undefined, 218, {
    courtesy: '文谦', tags: ['五子良将', '先登'],
    summary: '曹魏五子良将之一，以骁勇先登闻名。',
    stats: [80, 86, 55, 42, 72],
  }),
  P('yu-jin', '于禁', '魏', '武将', undefined, 221, {
    courtesy: '文则', tags: ['五子良将', '水淹七军'],
    summary: '曹魏五子良将之一，以治军严整著称，襄樊之战兵败降关羽。',
    stats: [82, 78, 66, 55, 74],
  }),
  P('zhang-he', '张郃', '魏', '武将', undefined, 231, {
    courtesy: '儁乂', tags: ['五子良将', '街亭之战', '西线宿将'],
    summary: '曹魏五子良将之一，用兵巧变，街亭之战破马谡。',
    stats: [91, 87, 74, 52, 76],
  }),
  P('xu-huang', '徐晃', '魏', '武将', undefined, 227, {
    courtesy: '公明', tags: ['五子良将', '樊城解围', '治军严整'],
    summary: '曹魏五子良将之一，樊城之战击退关羽。',
    stats: [88, 84, 70, 50, 78],
  }),
  P('dian-wei', '典韦', '魏', '武将', undefined, 197, {
    tags: ['古之恶来', '宛城护主'],
    summary: '曹操近卫猛将，宛城之战为掩护曹操战死。',
    stats: [68, 96, 35, 25, 72],
  }),
  P('xu-chu', '许褚', '魏', '武将', undefined, 230, {
    courtesy: '仲康', tags: ['虎痴', '曹操近卫'],
    summary: '曹操近卫猛将，以力大如虎闻名。',
    stats: [70, 95, 38, 28, 70],
  }),
  P('pang-de', '庞德', '魏', '武将', undefined, 219, {
    courtesy: '令明', tags: ['白马将军', '樊城死战'],
    summary: '原马超部将，后归曹操，樊城之战宁死不降。',
    stats: [80, 90, 55, 35, 78],
  }),
  P('wen-pin', '文聘', '魏', '武将', undefined, 226, {
    courtesy: '仲业', tags: ['荆州名将', '江夏太守'],
    summary: '原刘表部将，后归曹操，镇守江夏数十年。',
    stats: [80, 78, 66, 52, 74],
  }),
  P('li-dian', '李典', '魏', '武将', undefined, 220, {
    courtesy: '曼成', tags: ['儒将', '合肥之战'],
    summary: '曹魏将领，合肥之战与张辽、乐进协力破吴。',
    stats: [76, 74, 70, 55, 73],
  }),
  P('zang-ba', '臧霸', '魏', '武将', undefined, 231, {
    courtesy: '宣高', tags: ['青徐豪帅', '镇守东方'],
    summary: '青徐豪帅，后归曹操，长期镇守青徐。',
    stats: [78, 80, 60, 48, 70],
  }),
  P('guo-huai', '郭淮', '魏', '武将', undefined, 255, {
    courtesy: '伯济', tags: ['关中都督', '抗蜀'],
    summary: '曹魏西线宿将，长期抵御蜀汉北伐。',
    stats: [84, 76, 70, 55, 72],
  }),
  P('hao-zhao', '郝昭', '魏', '武将', undefined, 229, {
    courtesy: '伯道', tags: ['陈仓之战', '善守'],
    summary: '曹魏将领，陈仓之战以寡兵挡住诸葛亮北伐。',
    stats: [78, 72, 74, 48, 70],
  }),
  P('deng-ai', '邓艾', '魏', '武将', 197, 264, {
    courtesy: '士载', peakYear: 263, tags: ['灭蜀', '阴平偷渡'],
    summary: '曹魏名将，偷渡阴平灭亡蜀汉，后因钟会构陷被杀。',
    stats: [92, 80, 86, 68, 72],
  }),
  P('wang-ji', '王基', '魏', '武将', 190, 261, {
    courtesy: '伯舆', tags: ['荆州都督', '平淮南'],
    summary: '曹魏后期名将，参与平定淮南三叛。',
    stats: [82, 72, 72, 58, 72],
  }),
  P('chen-tai', '陈泰', '魏', '武将', undefined, 260, {
    courtesy: '玄伯', tags: ['西线统帅', '陈群之子'],
    summary: '陈群之子，曹魏西线重臣，多次与姜维交锋。',
    stats: [80, 68, 78, 62, 74],
  }),
  P('guanqiu-jian', '毌丘俭', '魏', '武将', undefined, 255, {
    courtesy: '仲恭', tags: ['淮南三叛', '伐高句丽'],
    summary: '曹魏将领，曾远征高句丽，后起兵讨司马氏兵败。',
    stats: [78, 74, 66, 52, 68],
  }),
  P('wang-ling', '王凌', '魏', '武将', 172, 251, {
    courtesy: '彦云', tags: ['淮南三叛', '太尉'],
    summary: '曹魏重臣，淮南三叛之一，谋立曹彪事败自杀。',
    stats: [74, 68, 70, 66, 70],
  }),
  P('zhuge-dan', '诸葛诞', '魏', '武将', undefined, 258, {
    courtesy: '公休', tags: ['淮南三叛', '诸葛氏'],
    summary: '曹魏将领，淮南三叛之一，兵败被杀。',
    stats: [76, 72, 68, 58, 72],
  }),
  P('wen-yang', '文鸯', '魏', '武将', 238, 291, {
    courtesy: '次骞', tags: ['勇猛', '乐嘉夜袭'],
    summary: '曹魏末至西晋初猛将，乐嘉城夜袭司马师大营。',
    stats: [72, 92, 52, 30, 68],
  }),

  P('xun-yu', '荀彧', '魏', '谋士', 163, 212, {
    courtesy: '文若', peakYear: 196, tags: ['王佐之才', '颍川士族', '奉迎天子'],
    summary: '曹操首席谋臣，定北方战略，反对曹操称公，忧死。',
    stats: [78, 30, 96, 98, 90],
  }),
  P('xun-you', '荀攸', '魏', '谋士', 157, 214, {
    courtesy: '公达', tags: ['算无遗策', '官渡之战'],
    summary: '曹操谋主之一，以奇策闻名。',
    stats: [74, 25, 95, 92, 84],
  }),
  P('guo-jia', '郭嘉', '魏', '谋士', 170, 207, {
    courtesy: '奉孝', peakYear: 200, tags: ['十胜十败', '奇谋'],
    summary: '曹操重要谋士，料孙策、定辽东，英年早逝。',
    stats: [68, 20, 96, 82, 88],
  }),
  P('jia-xu', '贾诩', '魏', '谋士', 147, 223, {
    courtesy: '文和', peakYear: 192, tags: ['毒士', '自保', '离间马韩'],
    summary: '初仕董卓，后归曹操，以奇谋与明哲保身著称。',
    stats: [72, 32, 97, 88, 76],
  }),
  P('cheng-yu', '程昱', '魏', '谋士', 141, 220, {
    courtesy: '仲德', tags: ['刚毅', '兖州'],
    summary: '曹操重要谋臣，曾守兖州三城。',
    stats: [70, 48, 88, 82, 72],
  }),
  P('liu-ye', '刘晔', '魏', '谋士', undefined, 234, {
    courtesy: '子扬', tags: ['料事如神', '伐吴献策'],
    summary: '汉室宗亲，曹魏谋臣，以识破敌情著称。',
    stats: [60, 35, 92, 80, 74],
  }),
  P('sima-yi', '司马懿', '魏', '谋士', 179, 251, {
    courtesy: '仲达', peakYear: 238, tags: ['冢虎', '抗蜀', '高平陵之变'],
    summary: '曹魏重臣，西拒诸葛、北平辽东，高平陵之变夺权，为晋室奠基。',
    stats: [98, 62, 98, 90, 86],
  }),
  P('sima-shi', '司马师', '魏', '谋士', 208, 255, {
    courtesy: '子元', parentId: 'sima-yi', relation: '父子',
    tags: ['司马氏', '废曹芳', '淮南平叛'],
    summary: '司马懿长子，废曹芳立曹髦，平定毌丘俭之叛。',
    stats: [84, 66, 86, 80, 76],
  }),
  P('sima-zhao', '司马昭', '魏', '谋士', 211, 265, {
    courtesy: '子上', parentId: 'sima-yi', relation: '父子',
    tags: ['司马氏', '灭蜀', '晋文帝(追尊)'],
    summary: '司马懿次子，掌曹魏大权，灭蜀，为西晋奠基。',
    stats: [86, 60, 88, 85, 78],
  }),
  P('jiang-ji', '蒋济', '魏', '谋士', 188, 249, {
    courtesy: '子通', tags: ['四朝元老', '高平陵之变'],
    summary: '曹魏四朝重臣，高平陵之变中助司马懿，后愧对曹爽。',
    stats: [64, 42, 84, 80, 74],
  }),
  P('dong-zhao', '董昭', '魏', '谋士', 156, 236, {
    courtesy: '公仁', tags: ['劝进', '九锡'],
    summary: '曹魏谋臣，长期掌机要。',
    stats: [52, 30, 86, 84, 72],
  }),
  P('jia-kui', '贾逵', '魏', '谋士', 174, 228, {
    courtesy: '梁道', tags: ['豫州刺史', '治水'],
    summary: '曹魏能臣，治理地方与军务皆有建树。',
    stats: [68, 55, 80, 82, 76],
  }),
  P('liu-fang', '刘放', '魏', '谋士', undefined, 250, {
    courtesy: '子弃', tags: ['中书令', '托孤'],
    summary: '曹魏近臣，曹叡临终与孙资共定辅政人选。',
    stats: [40, 25, 80, 84, 70],
  }),
  P('sun-zi', '孙资', '魏', '谋士', undefined, 251, {
    courtesy: '彦龙', tags: ['中书令', '托孤'],
    summary: '曹魏近臣，与刘放同掌机要。',
    stats: [38, 24, 82, 83, 70],
  }),
  P('zhong-hui', '钟会', '魏', '谋士', 225, 264, {
    courtesy: '士季', tags: ['灭蜀', '书法', '叛乱'],
    summary: '钟繇之子，与邓艾灭蜀，后据蜀叛乱被杀。',
    stats: [88, 58, 92, 78, 72],
  }),
  P('wei-guan', '卫瓘', '魏', '谋士', 220, 291, {
    courtesy: '伯玉', tags: ['灭蜀', '书法家'],
    summary: '曹魏末至西晋重臣，参与灭蜀，书法名家。',
    stats: [62, 45, 84, 82, 76],
  }),

  P('zhong-yao', '钟繇', '魏', '文臣', 151, 230, {
    courtesy: '元常', tags: ['书法家', '楷书之祖', '三公'],
    summary: '曹魏重臣，书法与王羲之并称钟王。',
    stats: [50, 28, 82, 92, 84],
  }),
  P('chen-qun', '陈群', '魏', '文臣', undefined, 237, {
    courtesy: '长文', peakYear: 220, tags: ['九品中正制', '尚书令'],
    summary: '曹魏重臣，创九品中正制。',
    stats: [44, 22, 88, 96, 82],
  }),
  P('hua-xin', '华歆', '魏', '文臣', 157, 232, {
    courtesy: '子鱼', tags: ['三公', '名士'],
    summary: '原孙吴重臣，后入魏，官至司徒。',
    stats: [40, 25, 78, 88, 74],
  }),
  P('wang-lang', '王朗', '魏', '文臣', undefined, 228, {
    courtesy: '景兴', tags: ['三公', '经学家'],
    summary: '曹魏重臣，经学家，演义中被诸葛亮骂死。',
    stats: [36, 22, 80, 86, 74],
  }),
  P('man-chong', '满宠', '魏', '文臣', undefined, 242, {
    courtesy: '伯宁', tags: ['酷吏', '镇守淮南'],
    summary: '曹魏重臣，以执法严明著称，长期镇守淮南。',
    stats: [72, 62, 78, 80, 72],
  }),
  P('yang-xiu', '杨修', '魏', '文臣', 175, 219, {
    courtesy: '德祖', tags: ['才子', '鸡肋', '弘农杨氏'],
    summary: '曹操主簿，才思敏捷，因卷入夺嫡被杀。',
    stats: [30, 25, 90, 72, 78],
  }),
  P('cui-yan', '崔琰', '魏', '文臣', 163, 216, {
    courtesy: '季珪', tags: ['清河崔氏', '刚正'],
    summary: '曹操谋臣，以风骨刚正闻名，后被曹操赐死。',
    stats: [42, 35, 80, 84, 82],
  }),
  P('mao-jie', '毛玠', '魏', '文臣', undefined, 216, {
    courtesy: '孝先', tags: ['选官', '清正'],
    summary: '曹操谋臣，与崔琰共掌选举。',
    stats: [38, 28, 78, 86, 76],
  }),
  P('wang-can', '王粲', '魏', '文臣', 177, 217, {
    courtesy: '仲宣', tags: ['建安七子', '登楼赋'],
    summary: '建安七子之首，文学成就最高。',
    stats: [22, 18, 88, 70, 82],
  }),
  P('chen-lin', '陈琳', '魏', '文臣', undefined, 217, {
    courtesy: '孔璋', tags: ['建安七子', '讨曹檄文'],
    summary: '建安七子之一，曾为袁绍草檄讨曹操。',
    stats: [20, 16, 84, 66, 78],
  }),
  P('ruan-yu', '阮瑀', '魏', '文臣', undefined, 212, {
    courtesy: '元瑜', tags: ['建安七子', '书记'],
    summary: '建安七子之一，长于书檄。',
    stats: [18, 14, 82, 64, 76],
  }),
  P('xu-gan', '徐干', '魏', '文臣', 171, 218, {
    courtesy: '伟长', tags: ['建安七子', '中论'],
    summary: '建安七子之一，学者型文人。',
    stats: [16, 14, 84, 62, 76],
  }),
  P('ying-yang', '应玚', '魏', '文臣', undefined, 217, {
    courtesy: '德琏', tags: ['建安七子'],
    summary: '建安七子之一。',
    stats: [15, 15, 76, 58, 74],
  }),
  P('liu-zhen', '刘桢', '魏', '文臣', undefined, 217, {
    courtesy: '公干', tags: ['建安七子', '五言诗'],
    summary: '建安七子之一，以五言诗见长。',
    stats: [15, 15, 80, 56, 76],
  }),
  P('du-ji', '杜畿', '魏', '文臣', 163, 224, {
    courtesy: '伯侯', tags: ['河东太守', '能臣'],
    summary: '曹魏能臣，治理河东政绩卓著。',
    stats: [48, 32, 78, 92, 78],
  }),
  P('zhang-ji', '张既', '魏', '文臣', undefined, 223, {
    courtesy: '德容', tags: ['雍凉都督', '安边'],
    summary: '曹魏西北重臣，安定雍凉。',
    stats: [62, 48, 76, 84, 76],
  }),
  P('gao-rou', '高柔', '魏', '文臣', 174, 263, {
    courtesy: '文惠', tags: ['廷尉', '三公'],
    summary: '曹魏司法重臣，历仕数朝。',
    stats: [40, 25, 76, 88, 76],
  }),
  P('chen-jiao', '陈矫', '魏', '文臣', undefined, 237, {
    courtesy: '季弼', tags: ['尚书令', '刚正'],
    summary: '曹魏重臣，以刚正敢谏著称。',
    stats: [42, 30, 76, 86, 76],
  }),

  P('bian-furen', '卞夫人', '魏', '女性', 160, 230, {
    tags: ['武宣卞皇后', '曹操正室'],
    summary: '曹操正室，曹丕、曹植生母，以俭朴贤德著称。',
    stats: [20, 10, 78, 74, 88],
  }),
  P('zhen-furen', '甄氏', '魏', '女性', 183, 221, {
    tags: ['文昭甄皇后', '洛神'],
    summary: '曹丕皇后，相传为《洛神赋》原型，后被赐死。',
    stats: [15, 8, 76, 62, 92],
  }),
  P('guo-zhao', '郭照', '魏', '女性', 184, 235, {
    courtesy: '女王', tags: ['文德郭皇后'],
    summary: '曹丕皇后，有智谋，辅佐曹叡。',
    stats: [18, 10, 82, 70, 84],
  }),
  P('xin-xianying', '辛宪英', '魏', '女性', 191, 269, {
    tags: ['智识过人', '辛毗之女'],
    summary: '曹魏至西晋名士，以洞察时局著称。',
    stats: [20, 8, 88, 68, 82],
  }),
  P('wang-yi', '王异', '魏', '女性', undefined, undefined, {
    tags: ['冀城之围', '奇女子'],
    summary: '赵昂之妻，助夫守冀城对抗马超。',
    stats: [32, 18, 80, 58, 80],
  }),

  P('guan-lu', '管辂', '魏', '方技', 209, 256, {
    courtesy: '公明', tags: ['占卜', '术数'],
    summary: '曹魏方士，精于《周易》占卜。',
    stats: [18, 12, 94, 48, 70],
  }),
  P('wang-bi', '王弼', '魏', '方技', 226, 249, {
    courtesy: '辅嗣', tags: ['玄学', '老子注'],
    summary: '曹魏玄学家，开创正始玄学。',
    stats: [12, 8, 98, 55, 76],
  }),
  P('he-yan', '何晏', '魏', '方技', 190, 249, {
    courtesy: '平叔', tags: ['玄学', '五石散'],
    summary: '曹魏玄学名士，高平陵之变后被司马懿诛杀。',
    stats: [18, 12, 88, 62, 74],
  }),
  P('ji-kang', '嵇康', '魏', '方技', 223, 262, {
    courtesy: '叔夜', tags: ['竹林七贤', '广陵散'],
    summary: '竹林七贤之一，文学家、音乐家，被司马昭所杀。',
    stats: [14, 22, 90, 50, 86],
  }),
  P('ruan-ji', '阮籍', '魏', '方技', 210, 263, {
    courtesy: '嗣宗', tags: ['竹林七贤', '咏怀诗'],
    summary: '竹林七贤之一，以放达避世闻名。',
    stats: [12, 16, 88, 46, 82],
  }),

  /* ============================ 蜀 ============================ */
  P('liu-bei', '刘备', '蜀', '君主', 161, 223, {
    courtesy: '玄德', peakYear: 219, tags: ['蜀汉昭烈帝', '汉室宗亲', '仁德'],
    summary: '蜀汉开国皇帝，以仁德聚人，三顾茅庐，夷陵之战后病逝白帝城。',
    stats: [78, 72, 76, 80, 96],
  }),
  P('liu-shan', '刘禅', '蜀', '君主', 207, 271, {
    courtesy: '公嗣', peakYear: 223, parentId: 'liu-bei', relation: '父子/继承',
    tags: ['蜀汉后主', '乐不思蜀'],
    summary: '刘备之子，蜀汉后主，在位四十年，后降魏。',
    stats: [30, 18, 50, 48, 65],
  }),
  P('liu-chen', '刘谌', '蜀', '君主', undefined, 263, {
    parentId: 'liu-shan', relation: '父子',
    tags: ['北地王', '殉国'],
    summary: '刘禅第五子，反对投降，蜀亡时在祖庙自杀殉国。',
    stats: [42, 38, 58, 50, 82],
  }),

  P('liu-feng', '刘封', '蜀', '宗室', undefined, 220, {
    parentId: 'liu-bei', relation: '养父子',
    tags: ['刘备养子', '上庸'],
    summary: '刘备养子，因不救关羽与欺凌孟达被赐死。',
    stats: [62, 72, 45, 32, 68],
  }),
  P('liu-li', '刘理', '蜀', '宗室', undefined, 244, {
    courtesy: '奉孝', parentId: 'liu-bei', relation: '父子',
    tags: ['梁王'],
    summary: '刘备之子，蜀汉宗室。',
    stats: [30, 20, 55, 48, 65],
  }),
  P('liu-yong', '刘永', '蜀', '宗室', undefined, undefined, {
    courtesy: '公寿', parentId: 'liu-bei', relation: '父子',
    tags: ['甘陵王'],
    summary: '刘备之子，蜀汉宗室。',
    stats: [30, 20, 55, 48, 65],
  }),
  P('wu-yi', '吴懿', '蜀', '宗室', undefined, 237, {
    courtesy: '子远', tags: ['外戚', '车骑将军'],
    summary: '刘备吴皇后之兄，蜀汉外戚重臣。',
    stats: [70, 68, 58, 52, 72],
  }),
  P('wu-ban', '吴班', '蜀', '宗室', undefined, undefined, {
    courtesy: '元雄', tags: ['外戚', '夷陵之战'],
    summary: '吴懿族弟，蜀汉将领，随刘备伐吴。',
    stats: [68, 74, 48, 38, 66],
  }),

  P('guan-yu', '关羽', '蜀', '武将', undefined, 220, {
    courtesy: '云长', peakYear: 219, tags: ['五虎上将', '武圣', '襄樊之战'],
    summary: '蜀汉五虎上将之首，白马斩颜良，水淹七军，后败走麦城。',
    stats: [92, 97, 75, 58, 93],
  }),
  P('zhang-fei', '张飞', '蜀', '武将', undefined, 221, {
    courtesy: '益德', peakYear: 214, tags: ['五虎上将', '当阳桥', '巴西之战'],
    summary: '蜀汉五虎上将之一，勇猛雄壮，后被部将刺杀。',
    stats: [82, 98, 62, 36, 68],
  }),
  P('zhao-yun', '赵云', '蜀', '武将', undefined, 229, {
    courtesy: '子龙', peakYear: 219, tags: ['五虎上将', '长坂坡', '常胜将军'],
    summary: '蜀汉五虎上将之一，长坂坡救阿斗，一身是胆。',
    stats: [90, 96, 76, 62, 88],
  }),
  P('ma-chao', '马超', '蜀', '武将', 176, 222, {
    courtesy: '孟起', peakYear: 211, tags: ['五虎上将', '锦马超', '渭水之战'],
    summary: '蜀汉五虎上将之一，曾杀得曹操割须弃袍。',
    stats: [86, 97, 52, 38, 82],
  }),
  P('huang-zhong', '黄忠', '蜀', '武将', undefined, 220, {
    courtesy: '汉升', peakYear: 219, tags: ['五虎上将', '定军山斩夏侯'],
    summary: '蜀汉五虎上将之一，定军山阵斩夏侯渊。',
    stats: [84, 93, 58, 42, 78],
  }),
  P('wei-yan', '魏延', '蜀', '武将', undefined, 234, {
    courtesy: '文长', tags: ['汉中太守', '子午谷奇谋'],
    summary: '蜀汉大将，镇守汉中，诸葛亮死后与杨仪争权被杀。',
    stats: [86, 90, 66, 48, 68],
  }),
  P('wang-ping', '王平', '蜀', '武将', undefined, 248, {
    courtesy: '子均', tags: ['街亭之战', '无当飞军'],
    summary: '蜀汉后期大将，街亭之战唯一未败，统领无当飞军。',
    stats: [78, 74, 68, 48, 72],
  }),
  P('liao-hua', '廖化', '蜀', '武将', undefined, 264, {
    courtesy: '元俭', tags: ['蜀汉宿将', '见证兴亡'],
    summary: '蜀汉宿将，从黄巾时代活到蜀亡。',
    stats: [68, 72, 55, 40, 70],
  }),
  P('ma-dai', '马岱', '蜀', '武将', undefined, undefined, {
    tags: ['马超从弟', '斩杀魏延'],
    summary: '马超从弟，后随蜀汉，杨仪命其斩杀魏延。',
    stats: [66, 76, 52, 36, 66],
  }),
  P('zhang-yi', '张翼', '蜀', '武将', undefined, 264, {
    courtesy: '伯恭', tags: ['蜀汉后期', '持重'],
    summary: '蜀汉后期将领，官至左车骑将军。',
    stats: [70, 70, 60, 52, 70],
  }),
  P('zhang-ni', '张嶷', '蜀', '武将', undefined, 254, {
    courtesy: '伯岐', tags: ['南中', '无当飞军'],
    summary: '蜀汉将领，治理南中，后随姜维战死。',
    stats: [68, 70, 64, 58, 72],
  }),
  P('chen-dao', '陈到', '蜀', '武将', undefined, undefined, {
    courtesy: '叔至', tags: ['白毦兵', '亲卫'],
    summary: '刘备亲卫统领，名位常亚于赵云。',
    stats: [72, 78, 58, 42, 74],
  }),
  P('xiang-chong', '向宠', '蜀', '武将', undefined, 240, {
    tags: ['出师表', '御林军'],
    summary: '诸葛亮在《出师表》中称赞的将领。',
    stats: [62, 64, 58, 52, 74],
  }),
  P('fu-qian', '傅佥', '蜀', '武将', undefined, 263, {
    tags: ['阳安关', '殉国'],
    summary: '蜀汉将领，阳安关失守时战死。',
    stats: [66, 74, 50, 38, 78],
  }),
  P('huo-jun', '霍峻', '蜀', '武将', 177, 217, {
    courtesy: '仲邈', tags: ['葭萌关', '善守'],
    summary: '刘备部将，以数百兵守葭萌关一年。',
    stats: [72, 68, 62, 44, 72],
  }),
  P('luo-xian', '罗宪', '蜀', '武将', 218, 270, {
    courtesy: '令则', tags: ['永安', '守城'],
    summary: '蜀汉后期将领，蜀亡后坚守永安抗拒东吴。',
    stats: [74, 68, 66, 54, 76],
  }),
  P('meng-huo', '孟获', '蜀', '武将', undefined, undefined, {
    tags: ['南中豪强', '七擒七纵'],
    summary: '南中豪强，被诸葛亮七擒七纵后归心。',
    stats: [58, 80, 42, 35, 70],
  }),
  P('guan-ping', '关平', '蜀', '武将', undefined, 220, {
    parentId: 'guan-yu', relation: '父子',
    tags: ['关羽长子', '襄樊之战'],
    summary: '关羽之子，随父镇守荆州，后被东吴擒杀。',
    stats: [68, 78, 52, 36, 76],
  }),
  P('guan-xing', '关兴', '蜀', '武将', undefined, undefined, {
    courtesy: '安国', parentId: 'guan-yu', relation: '父子',
    tags: ['关羽次子', '北伐'],
    summary: '关羽次子，蜀汉后期将领。',
    stats: [64, 76, 50, 34, 74],
  }),
  P('zhang-bao', '张苞', '蜀', '武将', undefined, undefined, {
    parentId: 'zhang-fei', relation: '父子',
    tags: ['张飞长子', '北伐'],
    summary: '张飞之子，蜀汉将领，早卒。',
    stats: [62, 82, 44, 28, 72],
  }),
  P('zhang-shao', '张绍', '蜀', '文臣', undefined, undefined, {
    parentId: 'zhang-fei', relation: '父子',
    tags: ['张飞次子', '降魏'],
    summary: '张飞次子，蜀亡时奉刘禅之命向魏军投降。',
    stats: [28, 24, 58, 52, 60],
  }),
  P('zhao-tong', '赵统', '蜀', '武将', undefined, undefined, {
    parentId: 'zhao-yun', relation: '父子',
    tags: ['赵云长子'],
    summary: '赵云长子，蜀汉将领。',
    stats: [58, 66, 48, 40, 68],
  }),
  P('zhao-guang', '赵广', '蜀', '武将', undefined, 263, {
    parentId: 'zhao-yun', relation: '父子',
    tags: ['赵云次子', '沓中战死'],
    summary: '赵云次子，随姜维战死沓中。',
    stats: [56, 68, 46, 36, 70],
  }),
  P('yan-yan', '严颜', '蜀', '武将', undefined, undefined, {
    tags: ['巴郡太守', '断头将军'],
    summary: '原刘璋部将，被张飞俘获后归蜀汉。',
    stats: [64, 72, 52, 38, 76],
  }),
  P('feng-xi', '冯习', '蜀', '武将', undefined, 222, {
    courtesy: '休元', tags: ['夷陵之战'],
    summary: '蜀汉将领，夷陵之战中战死。',
    stats: [62, 70, 48, 34, 68],
  }),
  P('zhang-nan', '张南', '蜀', '武将', undefined, 222, {
    courtesy: '文进', tags: ['夷陵之战'],
    summary: '蜀汉将领，夷陵之战中战死。',
    stats: [60, 68, 46, 32, 68],
  }),

  P('zhuge-liang', '诸葛亮', '蜀', '谋士', 181, 234, {
    courtesy: '孔明', peakYear: 227, tags: ['卧龙', '隆中对', '出师表', '六出祁山'],
    summary: '蜀汉丞相，政治家、军事家，鞠躬尽瘁死而后已。',
    stats: [97, 38, 100, 96, 92],
  }),
  P('pang-tong', '庞统', '蜀', '谋士', 179, 214, {
    courtesy: '士元', tags: ['凤雏', '入蜀献策'],
    summary: '与诸葛亮并称卧龙凤雏，随刘备入蜀，落凤坡中箭身亡。',
    stats: [78, 34, 95, 82, 78],
  }),
  P('fa-zheng', '法正', '蜀', '谋士', 176, 220, {
    courtesy: '孝直', tags: ['汉中献策', '定军山'],
    summary: '刘备重要谋主，助刘备取汉中。',
    stats: [72, 35, 94, 80, 76],
  }),
  P('ma-su', '马谡', '蜀', '谋士', 190, 228, {
    courtesy: '幼常', tags: ['街亭之战', '纸上谈兵'],
    summary: '诸葛亮器重的谋士，街亭失守后被斩。',
    stats: [62, 45, 80, 58, 72],
  }),
  P('jiang-wei', '姜维', '蜀', '谋士', 202, 264, {
    courtesy: '伯约', peakYear: 253, tags: ['大将军', '九伐中原', '继诸葛遗志'],
    summary: '蜀汉后期统帅，继承诸葛亮北伐之志，蜀亡后谋复国被杀。',
    stats: [90, 86, 88, 68, 80],
  }),
  P('huang-quan', '黄权', '蜀', '谋士', undefined, 240, {
    courtesy: '公衡', tags: ['夷陵之战', '后仕曹魏'],
    summary: '刘备谋臣，夷陵之战归路被断，不得已降魏。',
    stats: [68, 42, 82, 72, 76],
  }),
  P('li-hui', '李恢', '蜀', '谋士', undefined, 231, {
    courtesy: '德昂', tags: ['南中', '庲降都督'],
    summary: '蜀汉南中重臣，参与平定南中。',
    stats: [56, 48, 76, 74, 72],
  }),
  P('deng-zhi', '邓芝', '蜀', '谋士', undefined, 251, {
    courtesy: '伯苗', tags: ['出使东吴', '重修盟好'],
    summary: '蜀汉外交家，出使东吴恢复同盟。',
    stats: [48, 52, 80, 78, 80],
  }),
  P('ma-liang', '马良', '蜀', '谋士', 187, 222, {
    courtesy: '季常', tags: ['马氏五常', '夷陵之战'],
    summary: '马谡之兄，刘备谋臣，夷陵之战遇害。',
    stats: [45, 35, 82, 76, 78],
  }),

  P('jiang-wan', '蒋琬', '蜀', '文臣', undefined, 246, {
    courtesy: '公琰', tags: ['蜀汉四相', '诸葛亮继任者'],
    summary: '诸葛亮指定的继任者之一，治蜀稳健。',
    stats: [62, 38, 82, 92, 80],
  }),
  P('fei-yi', '费祎', '蜀', '文臣', undefined, 253, {
    courtesy: '文伟', tags: ['蜀汉四相', '遇刺'],
    summary: '蜀汉四相之一，后被降将刺杀。',
    stats: [60, 40, 84, 90, 82],
  }),
  P('dong-yun', '董允', '蜀', '文臣', undefined, 246, {
    courtesy: '休昭', tags: ['蜀汉四相', '匡正后主'],
    summary: '蜀汉四相之一，以匡正刘禅著称。',
    stats: [48, 30, 78, 88, 84],
  }),
  P('guo-youzhi', '郭攸之', '蜀', '文臣', undefined, undefined, {
    tags: ['出师表', '侍中'],
    summary: '诸葛亮《出师表》中推荐的侍中。',
    stats: [35, 22, 74, 80, 76],
  }),
  P('jian-yong', '简雍', '蜀', '文臣', undefined, undefined, {
    courtesy: '宪和', tags: ['刘备旧交', '诙谐善谏'],
    summary: '刘备早年幕僚，以诙谐进谏闻名。',
    stats: [30, 25, 76, 70, 76],
  }),
  P('sun-qian', '孙乾', '蜀', '文臣', undefined, undefined, {
    courtesy: '公祐', tags: ['刘备幕僚', '外交'],
    summary: '刘备早期幕僚，多次出使。',
    stats: [28, 22, 74, 72, 74],
  }),
  P('mi-zhu', '糜竺', '蜀', '文臣', undefined, 220, {
    courtesy: '子仲', tags: ['徐州豪商', '资助刘备'],
    summary: '徐州富商，倾家资助刘备，后为蜀汉重臣。',
    stats: [35, 25, 72, 78, 80],
  }),
  P('yi-ji', '伊籍', '蜀', '文臣', undefined, undefined, {
    courtesy: '机伯', tags: ['外交', '蜀科'],
    summary: '蜀汉文臣，参与制定《蜀科》。',
    stats: [30, 26, 76, 78, 74],
  }),
  P('qin-mi', '秦宓', '蜀', '文臣', undefined, 226, {
    courtesy: '子敕', tags: ['善辩', '出使东吴'],
    summary: '蜀汉文臣，以雄辩著称。',
    stats: [22, 18, 82, 74, 76],
  }),
  P('qiao-zhou', '谯周', '蜀', '文臣', 201, 270, {
    courtesy: '允南', tags: ['劝降', '史学家'],
    summary: '蜀汉学者，力劝刘禅降魏。',
    stats: [24, 14, 84, 76, 72],
  }),
  P('xi-zheng', '郤正', '蜀', '文臣', undefined, 278, {
    courtesy: '令先', tags: ['随刘禅入魏', '护主'],
    summary: '蜀汉文臣，蜀亡后随刘禅入魏。',
    stats: [28, 20, 78, 74, 76],
  }),
  P('yang-yi', '杨仪', '蜀', '文臣', undefined, 235, {
    courtesy: '威公', tags: ['丞相长史', '与魏延争权'],
    summary: '诸葛亮长史，诸葛亮死后与魏延争权。',
    stats: [42, 30, 76, 80, 62],
  }),
  P('li-yan', '李严', '蜀', '文臣', undefined, 234, {
    courtesy: '正方', tags: ['托孤大臣', '督运粮草'],
    summary: '刘备托孤大臣之一，后因运粮不济被废。',
    stats: [62, 52, 68, 72, 62],
  }),
  P('chen-zhen', '陈震', '蜀', '文臣', undefined, 235, {
    courtesy: '孝起', tags: ['出使东吴'],
    summary: '蜀汉文臣，出使东吴庆贺孙权称帝。',
    stats: [32, 24, 76, 78, 76],
  }),
  P('liu-ba', '刘巴', '蜀', '文臣', undefined, 222, {
    courtesy: '子初', tags: ['蜀科', '理财'],
    summary: '蜀汉文臣，参与制定《蜀科》，长于经济。',
    stats: [28, 20, 84, 84, 70],
  }),
  P('xiang-lang', '向朗', '蜀', '文臣', undefined, 247, {
    courtesy: '巨达', tags: ['藏书', '治学'],
    summary: '蜀汉文臣，以藏书治学闻名。',
    stats: [30, 22, 76, 80, 74],
  }),

  P('gan-furen', '甘夫人', '蜀', '女性', undefined, 209, {
    tags: ['昭烈皇后', '刘禅生母'],
    summary: '刘备夫人，刘禅生母。',
    stats: [12, 6, 62, 56, 84],
  }),
  P('mi-furen', '糜夫人', '蜀', '女性', undefined, 208, {
    tags: ['糜竺之妹', '长坂坡'],
    summary: '刘备夫人，长坂坡之战中投井而亡。',
    stats: [12, 6, 60, 54, 82],
  }),
  P('huang-yueying', '黄月英', '蜀', '女性', undefined, undefined, {
    tags: ['诸葛亮之妻', '才女', '木牛流马传说'],
    summary: '诸葛亮之妻，相传多才多艺。',
    stats: [18, 8, 88, 64, 76],
    approximate: true,
  }),
  P('zhurong-furen', '祝融夫人', '蜀', '女性', undefined, undefined, {
    tags: ['孟获之妻', '南中女将'],
    summary: '孟获之妻，传说为南中女将。',
    stats: [40, 78, 45, 30, 78],
    approximate: true,
  }),
  P('guan-yinping', '关银屏', '蜀', '女性', undefined, undefined, {
    parentId: 'guan-yu', relation: '父女',
    tags: ['关羽之女', '民间传说'],
    summary: '关羽之女，多见于民间故事与戏曲。',
    stats: [32, 58, 52, 38, 76],
    approximate: true,
  }),

  P('zhou-qun', '周群', '蜀', '方技', undefined, undefined, {
    courtesy: '仲直', tags: ['占候', '天象'],
    summary: '蜀汉方士，精于天文占候。',
    stats: [16, 10, 88, 50, 70],
  }),
  P('du-wei', '杜微', '蜀', '方技', undefined, undefined, {
    courtesy: '国辅', tags: ['隐士', '诸葛亮征召'],
    summary: '益州隐士，诸葛亮曾礼请出仕。',
    stats: [12, 8, 82, 62, 74],
  }),
  P('zhang-yu', '张裕', '蜀', '方技', undefined, 218, {
    tags: ['占卜', '触怒刘备'],
    summary: '蜀汉方士，因预言触怒刘备被杀。',
    stats: [14, 10, 80, 48, 64],
  }),

  /* ============================ 吴 ============================ */
  P('sun-jian', '孙坚', '吴', '君主', 155, 191, {
    courtesy: '文台', peakYear: 190, tags: ['江东猛虎', '讨董联军'],
    summary: '东吴奠基者，讨董联军先锋，后攻刘表中箭身亡。',
    stats: [86, 88, 68, 52, 84],
  }),
  P('sun-ce', '孙策', '吴', '君主', 175, 200, {
    courtesy: '伯符', peakYear: 197, parentId: 'sun-jian', relation: '父子/继承',
    tags: ['小霸王', '平定江东'],
    summary: '孙坚长子，以玉玺借兵平定江东，后被刺客所伤。',
    stats: [88, 92, 70, 55, 90],
  }),
  P('sun-quan', '孙权', '吴', '君主', 182, 252, {
    courtesy: '仲谋', peakYear: 229, parentId: 'sun-jian', relation: '父子/继承',
    tags: ['吴大帝', '赤壁之战', '夷陵之战'],
    summary: '东吴开国皇帝，任贤用能，与曹刘鼎足而立。',
    stats: [80, 66, 82, 86, 88],
  }),
  P('sun-liang', '孙亮', '吴', '君主', 243, 260, {
    courtesy: '子明', peakYear: 252, parentId: 'sun-quan', relation: '父子/继承',
    tags: ['吴少帝', '被废'],
    summary: '孙权幼子，东吴少帝，后被权臣废黜。',
    stats: [40, 25, 65, 55, 62],
  }),
  P('sun-xiu', '孙休', '吴', '君主', 235, 264, {
    courtesy: '子烈', peakYear: 258, parentId: 'sun-liang', relation: '继任',
    tags: ['吴景帝', '除孙綝'],
    summary: '孙权第六子，继位后诛除孙綝。',
    stats: [52, 30, 68, 66, 70],
  }),
  P('sun-hao', '孙皓', '吴', '君主', 242, 284, {
    courtesy: '元宗', peakYear: 264, parentId: 'sun-xiu', relation: '继任',
    tags: ['吴末帝', '暴君', '三家归晋'],
    summary: '东吴末代皇帝，在位后期暴虐，吴亡于晋。',
    stats: [42, 35, 58, 48, 55],
  }),

  P('sun-jing', '孙静', '吴', '宗室', undefined, undefined, {
    courtesy: '幼台', tags: ['孙坚之弟', '宗室元老'],
    summary: '孙坚之弟，孙氏宗室元老。',
    stats: [55, 50, 58, 52, 68],
  }),
  P('sun-ben', '孙贲', '吴', '宗室', undefined, undefined, {
    courtesy: '伯阳', tags: ['孙氏宗室', '豫章'],
    summary: '孙坚之侄，东吴宗室将领。',
    stats: [62, 60, 55, 48, 68],
  }),
  P('sun-fu', '孙辅', '吴', '宗室', undefined, undefined, {
    courtesy: '国仪', tags: ['孙氏宗室', '通曹被囚'],
    summary: '孙贲之弟，因暗通曹操被孙权幽禁。',
    stats: [58, 56, 48, 42, 60],
  }),
  P('sun-jiao', '孙皎', '吴', '宗室', undefined, 219, {
    courtesy: '叔朗', tags: ['孙氏宗室', '荆州'],
    summary: '孙静之子，东吴宗室将领。',
    stats: [66, 64, 60, 50, 70],
  }),
  P('sun-huan', '孙桓', '吴', '宗室', 198, 222, {
    courtesy: '叔武', tags: ['夷陵之战', '断刘备归路'],
    summary: '东吴宗室将领，夷陵之战断刘备后路。',
    stats: [62, 66, 58, 42, 72],
  }),
  P('sun-jun', '孙峻', '吴', '宗室', 219, 256, {
    courtesy: '子远', tags: ['权臣', '除诸葛恪'],
    summary: '东吴宗室权臣，诛杀诸葛恪后掌权。',
    stats: [58, 45, 62, 60, 55],
  }),
  P('sun-chen', '孙綝', '吴', '宗室', 231, 259, {
    courtesy: '子通', tags: ['权臣', '废孙亮'],
    summary: '孙峻从弟，废黜孙亮，后被孙休诛杀。',
    stats: [54, 42, 58, 56, 50],
  }),
  P('sun-he', '孙和', '吴', '宗室', 224, 253, {
    courtesy: '子孝', parentId: 'sun-quan', relation: '父子',
    tags: ['太子', '二宫之争'],
    summary: '孙权第三子，太子，二宫之争后被废。',
    stats: [44, 28, 66, 62, 72],
  }),
  P('sun-ba', '孙霸', '吴', '宗室', undefined, 250, {
    courtesy: '子威', parentId: 'sun-quan', relation: '父子',
    tags: ['鲁王', '二宫之争'],
    summary: '孙权第四子，与孙和争储，被赐死。',
    stats: [42, 30, 58, 56, 60],
  }),
  P('sun-deng', '孙登', '吴', '宗室', 209, 241, {
    courtesy: '子高', parentId: 'sun-quan', relation: '父子',
    tags: ['太子', '贤德'],
    summary: '孙权长子，太子，以贤德著称，早逝。',
    stats: [48, 30, 72, 74, 82],
  }),

  P('taishi-ci', '太史慈', '吴', '武将', 166, 206, {
    courtesy: '子义', peakYear: 198, tags: ['江东名将', '神亭酣战', '信义'],
    summary: '东吴名将，神亭岭与孙策酣战，以信义闻名。',
    stats: [82, 93, 66, 48, 84],
  }),
  P('gan-ning', '甘宁', '吴', '武将', undefined, 220, {
    courtesy: '兴霸', peakYear: 208, tags: ['锦帆贼', '百骑劫营'],
    summary: '东吴猛将，百骑劫曹营，为孙权所重。',
    stats: [80, 94, 58, 36, 76],
  }),
  P('zhou-tai', '周泰', '吴', '武将', undefined, undefined, {
    courtesy: '幼平', tags: ['孙权护卫', '身被数十创'],
    summary: '东吴猛将，多次以身为孙权挡箭。',
    stats: [70, 88, 48, 32, 78],
  }),
  P('ling-tong', '凌统', '吴', '武将', 189, 237, {
    courtesy: '公绩', tags: ['逍遥津', '护孙权'],
    summary: '东吴将领，逍遥津之战拼死护卫孙权。',
    stats: [72, 82, 56, 40, 76],
  }),
  P('cheng-pu', '程普', '吴', '武将', undefined, undefined, {
    courtesy: '德谋', tags: ['东吴宿将', '赤壁之战'],
    summary: '东吴三世老将，赤壁之战任副都督。',
    stats: [76, 74, 62, 46, 78],
  }),
  P('huang-gai', '黄盖', '吴', '武将', undefined, undefined, {
    courtesy: '公覆', tags: ['苦肉计', '赤壁火攻'],
    summary: '东吴宿将，赤壁之战献火攻诈降之策。',
    stats: [74, 78, 68, 44, 76],
  }),
  P('han-dang', '韩当', '吴', '武将', undefined, 227, {
    courtesy: '义公', tags: ['东吴宿将', '水战'],
    summary: '东吴三世老将，长于水战。',
    stats: [72, 76, 54, 38, 72],
  }),
  P('jiang-qin', '蒋钦', '吴', '武将', undefined, 220, {
    courtesy: '公奕', tags: ['东吴将领', '水军'],
    summary: '东吴将领，随孙氏征战。',
    stats: [70, 74, 52, 36, 72],
  }),
  P('chen-wu', '陈武', '吴', '武将', undefined, 215, {
    courtesy: '子烈', tags: ['东吴猛将', '合肥战死'],
    summary: '东吴猛将，合肥之战战死。',
    stats: [68, 80, 42, 30, 72],
  }),
  P('dong-xi', '董袭', '吴', '武将', undefined, 213, {
    courtesy: '元代', tags: ['东吴猛将', '水战'],
    summary: '东吴猛将，濡须口战死。',
    stats: [66, 78, 44, 30, 70],
  }),
  P('xu-sheng', '徐盛', '吴', '武将', undefined, undefined, {
    courtesy: '文向', tags: ['东吴名将', '疑城退曹丕'],
    summary: '东吴名将，以少敌多，巧设疑城退曹丕。',
    stats: [76, 76, 64, 42, 74],
  }),
  P('pan-zhang', '潘璋', '吴', '武将', undefined, 234, {
    courtesy: '文珪', tags: ['擒关羽', '麦城'],
    summary: '东吴将领，麦城之战擒获关羽。',
    stats: [70, 78, 52, 34, 66],
  }),
  P('ding-feng', '丁奉', '吴', '武将', undefined, 271, {
    courtesy: '承渊', tags: ['东吴后期名将', '雪中奋短兵'],
    summary: '东吴后期名将，历仕四朝。',
    stats: [78, 82, 62, 48, 72],
  }),
  P('zhu-ran', '朱然', '吴', '武将', 182, 249, {
    courtesy: '义封', tags: ['江陵之战', '善守'],
    summary: '东吴名将，江陵之战坚守六百里退曹魏。',
    stats: [80, 74, 70, 52, 76],
  }),
  P('zhu-huan', '朱桓', '吴', '武将', 177, 238, {
    courtesy: '休穆', tags: ['濡须口', '刚直'],
    summary: '东吴名将，濡须口大破曹仁。',
    stats: [78, 76, 64, 46, 70],
  }),
  P('quan-cong', '全琮', '吴', '武将', 198, 249, {
    courtesy: '子璜', tags: ['东吴名将', '淮南'],
    summary: '东吴将领，孙权女婿，多次北征。',
    stats: [72, 68, 66, 54, 72],
  }),
  P('lv-fan', '吕范', '吴', '武将', undefined, 228, {
    courtesy: '子衡', tags: ['孙吴元老', '洞玄'],
    summary: '孙吴元老，孙权心腹。',
    stats: [66, 62, 64, 58, 74],
  }),
  P('he-qi', '贺齐', '吴', '武将', undefined, 227, {
    courtesy: '公苗', tags: ['平山越', '江东'],
    summary: '东吴名将，平定山越。',
    stats: [72, 70, 58, 46, 72],
  }),
  P('liu-zan', '留赞', '吴', '武将', 183, 255, {
    courtesy: '正明', tags: ['东吴后期', '老将'],
    summary: '东吴后期老将，作战勇猛。',
    stats: [66, 78, 50, 36, 70],
  }),
  P('sun-shao', '孙韶', '吴', '武将', 188, 241, {
    courtesy: '公礼', tags: ['孙氏宗亲', '镇守北边'],
    summary: '孙氏宗亲将领，镇守京口。',
    stats: [68, 70, 58, 44, 72],
  }),
  P('lu-kang', '陆抗', '吴', '武将', 226, 274, {
    courtesy: '幼节', parentId: 'lu-xun', relation: '父子',
    tags: ['东吴最后名将', '西陵之战'],
    summary: '陆逊之子，东吴后期柱石，西陵之战大破晋军。',
    stats: [88, 72, 84, 66, 80],
  }),
  P('zhuge-ke', '诸葛恪', '吴', '武将', 203, 253, {
    courtesy: '元逊', parentId: 'zhuge-jin', relation: '父子',
    tags: ['诸葛瑾之子', '东兴之战', '权臣'],
    summary: '诸葛瑾之子，东吴权臣，东兴之战大胜后专权被杀。',
    stats: [70, 55, 80, 72, 68],
  }),
  P('wu-yan', '吾彦', '吴', '武将', undefined, undefined, {
    courtesy: '士则', tags: ['东吴后期', '铁锁横江'],
    summary: '东吴后期将领，铁锁横江阻晋军。',
    stats: [66, 68, 58, 46, 70],
  }),

  P('zhou-yu', '周瑜', '吴', '谋士', 175, 210, {
    courtesy: '公瑾', peakYear: 208, tags: ['四大都督', '赤壁之战', '曲有误周郎顾'],
    summary: '东吴大都督，赤壁之战火烧曹军，奠定三分天下。',
    stats: [96, 72, 95, 76, 92],
  }),
  P('lu-su', '鲁肃', '吴', '谋士', 172, 217, {
    courtesy: '子敬', peakYear: 208, tags: ['四大都督', '榻上策', '联刘抗曹'],
    summary: '东吴战略家，力主孙刘联盟。',
    stats: [74, 52, 92, 84, 88],
  }),
  P('lv-meng', '吕蒙', '吴', '谋士', 178, 220, {
    courtesy: '子明', peakYear: 219, tags: ['四大都督', '白衣渡江', '士别三日'],
    summary: '东吴大都督，白衣渡江袭取荆州，擒杀关羽。',
    stats: [90, 80, 86, 68, 80],
  }),
  P('lu-xun', '陆逊', '吴', '谋士', 183, 245, {
    courtesy: '伯言', peakYear: 222, tags: ['四大都督', '夷陵之战', '社稷之臣'],
    summary: '东吴大都督，夷陵之战火烧连营大破刘备。',
    stats: [95, 68, 94, 82, 86],
  }),
  P('zhang-hong', '张纮', '吴', '谋士', 153, 212, {
    courtesy: '子纲', tags: ['二张', '战略家'],
    summary: '东吴谋臣，与张昭并称二张。',
    stats: [42, 28, 86, 82, 80],
  }),
  P('xue-zong', '薛综', '吴', '谋士', undefined, 243, {
    courtesy: '敬文', tags: ['名儒', '外交'],
    summary: '东吴名儒，曾出使蜀汉。',
    stats: [30, 22, 84, 80, 76],
  }),
  P('lu-ji', '陆绩', '吴', '谋士', 188, 219, {
    courtesy: '公纪', tags: ['怀橘遗亲', '学者'],
    summary: '东吴学者，以孝行与天文历法闻名。',
    stats: [24, 16, 86, 70, 80],
  }),
  P('zhuge-jin', '诸葛瑾', '吴', '文臣', 174, 241, {
    courtesy: '子瑜', tags: ['诸葛亮之兄', '东吴重臣'],
    summary: '诸葛亮之兄，东吴重臣，孙权心腹。',
    stats: [52, 40, 80, 84, 84],
  }),
  P('kan-ze', '阚泽', '吴', '文臣', undefined, 243, {
    courtesy: '德润', tags: ['学者', '诈降书'],
    summary: '东吴学者，演义中为黄盖献诈降书。',
    stats: [30, 22, 84, 76, 78],
  }),
  P('wei-zhao', '韦昭', '吴', '文臣', 204, 273, {
    courtesy: '弘嗣', tags: ['史学家', '吴书'],
    summary: '东吴史学家，因直笔被孙皓所杀。',
    stats: [20, 14, 86, 74, 76],
  }),
  P('hua-he', '华覈', '吴', '文臣', undefined, 278, {
    courtesy: '永先', tags: ['东吴后期', '直谏'],
    summary: '东吴后期文臣，多次直谏孙皓。',
    stats: [24, 16, 78, 80, 76],
  }),
  P('pu-yangxing', '濮阳兴', '吴', '文臣', undefined, 264, {
    courtesy: '子元', tags: ['东吴后期', '丞相'],
    summary: '东吴后期丞相，后被孙皓所杀。',
    stats: [30, 20, 68, 72, 62],
  }),
  P('zhang-ti', '张悌', '吴', '文臣', undefined, 280, {
    courtesy: '巨先', tags: ['东吴末相', '殉国'],
    summary: '东吴末代丞相，晋灭吴时战死。',
    stats: [48, 42, 72, 74, 82],
  }),
  P('zhao-zi', '赵咨', '吴', '文臣', undefined, undefined, {
    courtesy: '德度', tags: ['外交', '出使曹魏'],
    summary: '东吴外交家，出使曹魏不辱使命。',
    stats: [28, 24, 80, 78, 80],
  }),
  P('yan-jun', '严畯', '吴', '文臣', undefined, undefined, {
    courtesy: '曼才', tags: ['名儒', '推辞都督'],
    summary: '东吴名儒，曾推辞接任都督。',
    stats: [22, 16, 80, 76, 74],
  }),
  P('cheng-bing', '程秉', '吴', '文臣', undefined, undefined, {
    courtesy: '德枢', tags: ['名儒', '经学'],
    summary: '东吴名儒，长于经学。',
    stats: [20, 14, 80, 74, 74],
  }),
  P('zhang-zhao', '张昭', '吴', '文臣', 156, 236, {
    courtesy: '子布', tags: ['二张', '托孤重臣', '刚直'],
    summary: '东吴重臣，孙策托孤重臣，以刚直敢谏著称。',
    stats: [44, 24, 84, 92, 82],
  }),
  P('gu-yong', '顾雍', '吴', '文臣', 168, 243, {
    courtesy: '元叹', tags: ['丞相', '东吴名相'],
    summary: '东吴丞相，任相十九年，沉稳持重。',
    stats: [42, 20, 84, 94, 84],
  }),
  P('bu-zhi', '步骘', '吴', '文臣', undefined, 247, {
    courtesy: '子山', tags: ['丞相', '平交州'],
    summary: '东吴重臣，平定交州，官至丞相。',
    stats: [56, 42, 78, 86, 80],
  }),
  P('yu-fan', '虞翻', '吴', '文臣', 164, 233, {
    courtesy: '仲翔', tags: ['狂直', '易学家'],
    summary: '东吴名士，以狂直与易学闻名。',
    stats: [34, 30, 88, 72, 68],
  }),

  P('da-qiao', '大乔', '吴', '女性', undefined, undefined, {
    tags: ['孙策之妻', '江东二乔'],
    summary: '孙策之妻，与妹妹小乔并称江东二乔。',
    stats: [10, 5, 66, 52, 92],
    approximate: true,
  }),
  P('xiao-qiao', '小乔', '吴', '女性', undefined, undefined, {
    tags: ['周瑜之妻', '江东二乔'],
    summary: '周瑜之妻，与姐姐大乔并称江东二乔。',
    stats: [10, 5, 68, 54, 92],
    approximate: true,
  }),
  P('sun-shangxiang', '孙尚香', '吴', '女性', undefined, undefined, {
    tags: ['刘备之妻', '弓腰姬'],
    summary: '孙权之妹，刘备之妻，史称孙夫人。',
    stats: [42, 76, 58, 40, 84],
    approximate: true,
  }),
  P('wu-guotai', '吴国太', '吴', '女性', undefined, undefined, {
    tags: ['孙坚之妻', '演义人物'],
    summary: '孙坚夫人，演义中在甘露寺相看刘备。',
    stats: [12, 8, 70, 62, 82],
    approximate: true,
  }),
  P('bu-lianshi', '步练师', '吴', '女性', undefined, 238, {
    tags: ['孙权宠妃', '追封皇后'],
    summary: '孙权宠妃，步骘同族，死后追封皇后。',
    stats: [10, 6, 66, 56, 86],
  }),
  P('sun-luban', '孙鲁班', '吴', '女性', undefined, undefined, {
    tags: ['孙权长女', '二宫之争'],
    summary: '孙权长女，卷入二宫之争。',
    stats: [18, 14, 72, 66, 78],
  }),

  P('zhao-da', '赵达', '吴', '方技', undefined, undefined, {
    tags: ['术数', '九宫'],
    summary: '东吴方士，精于术数。',
    stats: [14, 10, 86, 46, 68],
  }),
  P('liu-dun', '刘惇', '吴', '方技', undefined, undefined, {
    courtesy: '子仁', tags: ['天象', '占星'],
    summary: '东吴方士，精于天文占星。',
    stats: [12, 8, 84, 48, 68],
  }),
  P('wu-fan', '吴范', '吴', '方技', undefined, 226, {
    courtesy: '文则', tags: ['术数', '预言'],
    summary: '东吴方士，以预言著称。',
    stats: [14, 10, 86, 50, 70],
  }),

  /* ============================ 群雄 / 汉末 ============================ */
  P('liu-xie', '刘协', '群雄', '君主', 181, 234, {
    courtesy: '伯和', peakYear: 196, tags: ['汉献帝', '末代汉帝', '衣带诏'],
    summary: '东汉末代皇帝，先后被董卓、曹操控制，后禅位曹丕。',
    stats: [32, 18, 68, 66, 74],
  }),
  P('liu-bian', '刘辩', '群雄', '君主', 176, 190, {
    tags: ['汉少帝', '被废'],
    summary: '汉灵帝之子，被董卓废黜后遇害。',
    stats: [18, 10, 45, 40, 55],
  }),
  P('dong-zhuo', '董卓', '群雄', '君主', undefined, 192, {
    courtesy: '仲颖', peakYear: 189, tags: ['西凉军阀', '废立皇帝', '迁都长安'],
    summary: '汉末权臣，带兵入京把持朝政，后为王允设计所杀。',
    stats: [74, 82, 58, 48, 45],
  }),
  P('yuan-shao', '袁绍', '群雄', '君主', undefined, 202, {
    courtesy: '本初', peakYear: 199, tags: ['四世三公', '河北霸主', '官渡之战'],
    summary: '汉末最强诸侯，官渡之战败于曹操。',
    stats: [80, 66, 72, 76, 82],
  }),
  P('yuan-shu', '袁术', '群雄', '君主', undefined, 199, {
    courtesy: '公路', peakYear: 197, tags: ['四世三公', '僭号称帝'],
    summary: '袁绍之弟，据淮南僭号称帝，后众叛亲离而死。',
    stats: [58, 52, 58, 62, 48],
  }),
  P('lv-bu', '吕布', '群雄', '君主', undefined, 199, {
    courtesy: '奉先', peakYear: 194, tags: ['飞将', '辕门射戟', '三姓家奴'],
    summary: '汉末第一猛将，反复无常，终为曹操所擒杀。',
    stats: [74, 100, 42, 30, 72],
  }),
  P('gongsun-zan', '公孙瓒', '群雄', '君主', undefined, 199, {
    courtesy: '伯珪', peakYear: 192, tags: ['白马义从', '幽州'],
    summary: '幽州军阀，以白马义从闻名，后败于袁绍自焚。',
    stats: [76, 80, 55, 44, 66],
  }),
  P('ma-teng', '马腾', '群雄', '君主', undefined, 212, {
    courtesy: '寿成', tags: ['西凉军阀', '马超之父'],
    summary: '西凉军阀，马超之父，后被曹操所杀。',
    stats: [72, 76, 52, 46, 70],
  }),
  P('han-sui', '韩遂', '群雄', '君主', undefined, 215, {
    courtesy: '文约', tags: ['西凉军阀', '渭水之战'],
    summary: '西凉军阀，与马超联军反曹。',
    stats: [74, 70, 66, 58, 64],
  }),
  P('liu-biao', '刘表', '群雄', '君主', 142, 208, {
    courtesy: '景升', peakYear: 200, tags: ['荆州牧', '八骏'],
    summary: '汉室宗亲，荆州牧，坐拥荆襄而无意进取。',
    stats: [58, 40, 70, 82, 76],
  }),
  P('liu-yan', '刘焉', '群雄', '君主', undefined, 194, {
    courtesy: '君郎', tags: ['益州牧', '汉室宗亲'],
    summary: '汉室宗亲，请任益州牧，为蜀地割据奠基。',
    stats: [56, 38, 72, 80, 68],
  }),
  P('liu-zhang', '刘璋', '群雄', '君主', undefined, 219, {
    courtesy: '季玉', tags: ['益州牧', '引刘备入蜀'],
    summary: '刘焉之子，益州牧，引刘备入蜀后投降。',
    stats: [38, 20, 52, 58, 62],
  }),
  P('tao-qian', '陶谦', '群雄', '君主', 132, 194, {
    courtesy: '恭祖', tags: ['徐州牧', '让徐州'],
    summary: '徐州牧，演义中三让徐州与刘备。',
    stats: [52, 38, 62, 74, 74],
  }),
  P('zhang-lu', '张鲁', '群雄', '君主', undefined, 216, {
    courtesy: '公祺', tags: ['五斗米道', '汉中'],
    summary: '五斗米道教主，割据汉中，后降曹操。',
    stats: [50, 36, 68, 72, 70],
  }),
  P('gongsun-du', '公孙度', '群雄', '君主', undefined, 204, {
    courtesy: '升济', tags: ['辽东太守', '割据'],
    summary: '辽东太守，公孙氏割据辽东之始。',
    stats: [60, 52, 64, 68, 62],
  }),
  P('shi-xie', '士燮', '群雄', '君主', 137, 226, {
    courtesy: '威彦', tags: ['交州太守', '岭南'],
    summary: '交州太守，保境安民，后归附东吴。',
    stats: [54, 36, 76, 84, 80],
  }),
  P('zhang-xiu', '张绣', '群雄', '君主', undefined, 207, {
    tags: ['宛城之战', '北地枪王'],
    summary: '张济之侄，宛城之战重创曹操，后降曹。',
    stats: [68, 76, 52, 38, 68],
  }),

  P('hua-xiong', '华雄', '群雄', '武将', undefined, 191, {
    tags: ['董卓部将', '温酒斩华雄'],
    summary: '董卓部将，演义中被关羽温酒斩华雄。',
    stats: [60, 86, 40, 28, 62],
  }),
  P('yan-liang', '颜良', '群雄', '武将', undefined, 200, {
    tags: ['袁绍部将', '白马之战'],
    summary: '袁绍麾下猛将，白马之战被关羽斩杀。',
    stats: [72, 92, 38, 25, 68],
  }),
  P('wen-chou', '文丑', '群雄', '武将', undefined, 200, {
    tags: ['袁绍部将', '延津之战'],
    summary: '袁绍麾下猛将，延津之战兵败身亡。',
    stats: [70, 90, 40, 26, 66],
  }),
  P('gao-shun', '高顺', '群雄', '武将', undefined, 199, {
    tags: ['陷阵营', '吕布部将', '忠义'],
    summary: '吕布部将，统领精锐陷阵营，被俘后不屈而死。',
    stats: [78, 82, 58, 40, 84],
  }),
  P('zhang-ren', '张任', '群雄', '武将', undefined, 214, {
    tags: ['刘璋部将', '射杀庞统'],
    summary: '刘璋部将，雒城之战射杀庞统，被俘后不屈。',
    stats: [74, 80, 62, 42, 76],
  }),
  P('xu-rong', '徐荣', '群雄', '武将', undefined, 192, {
    tags: ['董卓部将', '击败曹操孙坚'],
    summary: '董卓部将，曾击败曹操与孙坚。',
    stats: [76, 78, 58, 40, 66],
  }),
  P('qu-yi', '麴义', '群雄', '武将', undefined, undefined, {
    tags: ['袁绍部将', '先登死士'],
    summary: '袁绍部将，界桥之战大破公孙瓒白马义从。',
    stats: [72, 76, 56, 36, 64],
  }),
  P('ji-ling', '纪灵', '群雄', '武将', undefined, undefined, {
    tags: ['袁术部将', '辕门射戟'],
    summary: '袁术部将，演义中与关羽战平。',
    stats: [62, 80, 44, 30, 64],
  }),
  P('huang-zu', '黄祖', '群雄', '武将', undefined, 208, {
    tags: ['江夏太守', '射杀孙坚'],
    summary: '刘表部将，江夏太守，部下射杀孙坚。',
    stats: [60, 70, 48, 40, 60],
  }),
  P('zang-hong', '臧洪', '群雄', '武将', 160, 195, {
    courtesy: '子源', tags: ['忠义', '讨董'],
    summary: '汉末义士，讨董联军盟誓者之一，后因故被袁绍所杀。',
    stats: [52, 55, 66, 68, 82],
  }),
  P('li-jue', '李傕', '群雄', '武将', undefined, 198, {
    courtesy: '稚然', tags: ['董卓旧部', '把持朝政'],
    summary: '董卓旧部，董卓死后与郭汜把持朝政。',
    stats: [68, 74, 50, 38, 45],
  }),
  P('guo-si', '郭汜', '群雄', '武将', undefined, 198, {
    tags: ['董卓旧部', '把持朝政'],
    summary: '董卓旧部，与李傕内斗。',
    stats: [66, 72, 46, 36, 44],
  }),
  P('zhang-ji-qun', '张济', '群雄', '武将', undefined, 196, {
    tags: ['董卓旧部', '宛城'],
    summary: '董卓旧部，张绣之叔，据宛城。',
    stats: [64, 70, 44, 34, 58],
  }),
  P('fan-chou', '樊稠', '群雄', '武将', undefined, 195, {
    tags: ['董卓旧部'],
    summary: '董卓旧部，后被李傕所杀。',
    stats: [62, 70, 42, 32, 55],
  }),
  P('niu-fu', '牛辅', '群雄', '武将', undefined, 192, {
    tags: ['董卓女婿', '西凉'],
    summary: '董卓女婿，董卓死后兵败逃亡。',
    stats: [58, 66, 38, 30, 50],
  }),

  P('chen-gong', '陈宫', '群雄', '谋士', undefined, 199, {
    courtesy: '公台', tags: ['吕布谋主', '捉放曹'],
    summary: '先随曹操，后辅吕布，被俘后宁死不降。',
    stats: [62, 45, 88, 68, 78],
  }),
  P('shen-pei', '审配', '群雄', '谋士', undefined, 204, {
    courtesy: '正南', tags: ['袁绍谋臣', '守邺城'],
    summary: '袁绍谋臣，坚守邺城，被俘后不屈而死。',
    stats: [56, 48, 80, 70, 76],
  }),
  P('ju-shou', '沮授', '群雄', '谋士', undefined, undefined, {
    tags: ['袁绍谋臣', '官渡之战', '忠言不被纳'],
    summary: '袁绍重要谋臣，屡献良策不被采纳，被俘后欲逃被杀。',
    stats: [58, 38, 90, 78, 80],
  }),
  P('tian-feng', '田丰', '群雄', '谋士', undefined, 200, {
    courtesy: '元皓', tags: ['袁绍谋臣', '直言被囚'],
    summary: '袁绍谋臣，官渡前力谏，兵败后被袁绍所杀。',
    stats: [52, 30, 88, 76, 78],
  }),
  P('li-ru', '李儒', '群雄', '谋士', undefined, undefined, {
    tags: ['董卓谋主', '毒杀刘辩'],
    summary: '董卓谋主，多出毒计。',
    stats: [48, 30, 84, 64, 50],
  }),
  P('xu-you', '许攸', '群雄', '谋士', undefined, 204, {
    courtesy: '子远', tags: ['袁绍谋臣', '火烧乌巢', '后归曹操'],
    summary: '先随袁绍，后投曹操献火烧乌巢之策，因居功被杀。',
    stats: [42, 25, 86, 62, 55],
  }),
  P('guo-tu', '郭图', '群雄', '谋士', undefined, 205, {
    courtesy: '公则', tags: ['袁绍谋臣', '谗言'],
    summary: '袁绍谋臣，屡进谗言。',
    stats: [40, 24, 72, 58, 48],
  }),
  P('feng-ji', '逢纪', '群雄', '谋士', undefined, 202, {
    courtesy: '元图', tags: ['袁绍谋臣'],
    summary: '袁绍谋臣，与审配不和。',
    stats: [40, 26, 74, 60, 50],
  }),
  P('xun-chen', '荀谌', '群雄', '谋士', undefined, undefined, {
    courtesy: '友若', tags: ['荀彧之兄', '说韩馥让冀州'],
    summary: '荀氏族人，袁绍谋臣，曾说服韩馥让出冀州。',
    stats: [42, 24, 82, 66, 72],
  }),
  P('kuai-liang', '蒯良', '群雄', '谋士', undefined, undefined, {
    courtesy: '子柔', tags: ['刘表谋臣'],
    summary: '刘表重要谋臣。',
    stats: [38, 22, 82, 74, 72],
  }),
  P('kuai-yue', '蒯越', '群雄', '谋士', undefined, 214, {
    courtesy: '异度', tags: ['刘表谋臣', '后归曹操'],
    summary: '刘表谋臣，后随刘琮降曹。',
    stats: [48, 36, 86, 76, 74],
  }),
  P('yan-pu', '阎圃', '群雄', '谋士', undefined, undefined, {
    tags: ['张鲁谋臣', '劝降'],
    summary: '张鲁谋臣，劝张鲁降曹。',
    stats: [36, 22, 80, 72, 72],
  }),
  P('zhang-song', '张松', '群雄', '谋士', undefined, 213, {
    courtesy: '子乔', tags: ['刘璋别驾', '献西川地图'],
    summary: '刘璋别驾，暗助刘备入蜀，事泄被杀。',
    stats: [32, 20, 82, 70, 58],
  }),
  P('chen-deng', '陈登', '群雄', '谋士', 163, 201, {
    courtesy: '元龙', tags: ['徐州名士', '破吕布'],
    summary: '徐州名士，助曹操破吕布。',
    stats: [56, 42, 82, 80, 76],
  }),
  P('chen-gui', '陈珪', '群雄', '谋士', undefined, undefined, {
    courtesy: '汉瑜', tags: ['陈登之父', '徐州士族'],
    summary: '陈登之父，徐州士族，暗助曹操。',
    stats: [32, 20, 78, 76, 74],
  }),

  P('wang-yun', '王允', '群雄', '文臣', 137, 192, {
    courtesy: '子师', peakYear: 192, tags: ['司徒', '连环计', '除董卓'],
    summary: '东汉司徒，设计除掉董卓，后长安之乱被杀。',
    stats: [40, 22, 84, 86, 80],
  }),
  P('cai-yong', '蔡邕', '群雄', '文臣', 133, 192, {
    courtesy: '伯喈', tags: ['文学家', '书法家', '蔡文姬之父'],
    summary: '东汉文学家、书法家，蔡文姬之父。',
    stats: [18, 12, 88, 74, 82],
  }),
  P('kong-rong', '孔融', '群雄', '文臣', 153, 208, {
    courtesy: '文举', tags: ['建安七子', '孔融让梨', '名士'],
    summary: '孔子之后，建安七子之一，后被曹操所杀。',
    stats: [24, 16, 82, 72, 84],
  }),
  P('mi-heng', '祢衡', '群雄', '文臣', 173, 198, {
    courtesy: '正平', tags: ['击鼓骂曹', '狂士'],
    summary: '汉末狂士，击鼓骂曹，后被黄祖所杀。',
    stats: [16, 14, 82, 48, 60],
  }),
  P('liu-fu', '刘馥', '群雄', '文臣', undefined, 208, {
    courtesy: '元颖', tags: ['扬州刺史', '兴修水利'],
    summary: '汉末扬州刺史，兴修水利。',
    stats: [36, 24, 72, 86, 74],
  }),
  P('xu-jing', '许靖', '群雄', '文臣', undefined, 222, {
    courtesy: '文休', tags: ['名士', '后仕蜀汉'],
    summary: '汉末名士，后入蜀为刘备重臣。',
    stats: [28, 18, 76, 80, 78],
  }),
  P('han-song', '韩嵩', '群雄', '文臣', undefined, undefined, {
    courtesy: '德高', tags: ['刘表臣属', '后归曹操'],
    summary: '刘表臣属，劝刘表归曹，后入魏。',
    stats: [30, 20, 76, 78, 74],
  }),
  P('fu-xun', '傅巽', '群雄', '文臣', undefined, undefined, {
    courtesy: '公悌', tags: ['刘表臣属', '劝刘琮降曹'],
    summary: '刘表臣属，劝刘琮降曹。',
    stats: [28, 18, 78, 76, 70],
  }),
  P('wang-lei', '王累', '群雄', '文臣', undefined, 211, {
    tags: ['刘璋臣属', '死谏'],
    summary: '刘璋臣属，自悬城门死谏阻止刘备入蜀。',
    stats: [20, 16, 72, 74, 82],
  }),
  P('diaochan', '貂蝉', '群雄', '女性', undefined, undefined, {
    tags: ['连环计', '四大美女', '演义人物'],
    summary: '王允养女，演义中巧施连环计离间董卓与吕布。',
    stats: [12, 8, 82, 56, 96],
    approximate: true,
  }),
  P('cai-wenji', '蔡文姬', '群雄', '女性', 177, undefined, {
    tags: ['蔡邕之女', '才女', '胡笳十八拍'],
    summary: '蔡邕之女，汉末才女，著有《胡笳十八拍》。',
    stats: [10, 6, 90, 62, 88],
  }),
  P('zou-furen', '邹氏', '群雄', '女性', undefined, undefined, {
    tags: ['张济之妻', '宛城之战'],
    summary: '张济之妻，演义中曹操因纳邹氏激起宛城之变。',
    stats: [8, 5, 62, 48, 88],
    approximate: true,
  }),
  P('dong-bai', '董白', '群雄', '女性', undefined, 192, {
    tags: ['董卓孙女'],
    summary: '董卓孙女，董卓败亡后被处死。',
    stats: [8, 5, 50, 40, 68],
  }),
  P('he-taihou', '何太后', '群雄', '女性', undefined, 189, {
    tags: ['汉灵帝皇后', '何进之妹'],
    summary: '汉灵帝皇后，何进之妹，董卓入京后被废杀。',
    stats: [10, 6, 56, 60, 64],
  }),
  P('tang-ji', '唐姬', '群雄', '女性', undefined, undefined, {
    tags: ['汉少帝妃'],
    summary: '汉少帝刘辩之妃，刘辩遇害后守节。',
    stats: [8, 5, 60, 52, 78],
  }),

  P('hua-tuo', '华佗', '群雄', '方技', 145, 208, {
    courtesy: '元化', peakYear: 200, tags: ['神医', '麻沸散', '五禽戏'],
    summary: '汉末神医，创麻沸散与五禽戏，后被曹操所杀。',
    stats: [12, 14, 92, 48, 82],
  }),
  P('zhang-zhongjing', '张仲景', '群雄', '方技', 150, 219, {
    tags: ['医圣', '伤寒杂病论'],
    summary: '名机，字仲景。汉末医学家，著《伤寒杂病论》，被尊为医圣。',
    stats: [14, 12, 94, 58, 84],
  }),
  P('zuo-ci', '左慈', '群雄', '方技', undefined, undefined, {
    courtesy: '元放', tags: ['方士', '戏曹操'],
    summary: '汉末方士，演义中多次戏弄曹操。',
    stats: [20, 18, 92, 40, 74],
    approximate: true,
  }),
  P('yu-ji', '于吉', '群雄', '方技', undefined, 200, {
    tags: ['道士', '太平道', '被孙策所杀'],
    summary: '汉末道士，在江东传道，被孙策所杀。',
    stats: [16, 12, 84, 44, 76],
    approximate: true,
  }),
  P('sima-hui', '司马徽', '群雄', '方技', undefined, 208, {
    courtesy: '德操', tags: ['水镜先生', '推荐卧龙凤雏'],
    summary: '汉末名士，向刘备推荐卧龙凤雏。',
    stats: [18, 10, 92, 58, 82],
    approximate: true,
  }),
  P('xu-shao', '许劭', '群雄', '方技', 150, 195, {
    courtesy: '子将', tags: ['月旦评', '识曹操'],
    summary: '汉末名士，以月旦评品评人物，称曹操“治世之能臣，乱世之奸雄”。',
    stats: [14, 10, 88, 62, 80],
  }),
  P('huang-chengyan', '黄承彦', '群雄', '方技', undefined, undefined, {
    tags: ['诸葛亮岳父', '名士'],
    summary: '诸葛亮岳父，荆州名士。',
    stats: [16, 12, 82, 58, 74],
    approximate: true,
  }),
  P('pang-degong', '庞德公', '群雄', '方技', undefined, undefined, {
    tags: ['庞统之叔', '隐士'],
    summary: '荆州隐士，庞统从叔，与司马徽交好。',
    stats: [16, 12, 84, 60, 78],
    approximate: true,
  }),
]
