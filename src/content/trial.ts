import type { Archetype, EnemyId } from '../game/types'

export const TRIAL_GRID_SIZE = 7
export const TRIAL_TILE_COUNT = 26
export const TRIAL_INITIAL_ACTION_POINTS = 18
export const TRIAL_MAX_ACTION_POINTS = 22
export const TRIAL_REQUIRED_SEALS = 2
export const TRIAL_TEMPORARY_DECK_LIMIT = 12
export const TRIAL_BACKGROUND_ART_KEY = 'bg_huaiyin_trial_map'

export const TRIAL_TILE_KINDS = ['combat', 'elite', 'event', 'training', 'merchant', 'chest', 'camp', 'boss'] as const
export type TrialTileKind = typeof TRIAL_TILE_KINDS[number]

export const TRIAL_TILE_DEFINITIONS: Readonly<Record<TrialTileKind, { name: string; description: string }>> = {
  combat: { name: '普通战斗', description: '击败一组槐阴古道妖物，获得临时构筑选择。' },
  elite: { name: '精英战斗', description: '挑战更强的精怪，固定获得一枚劫印。' },
  event: { name: '怪谈事件', description: '在短怪谈中作出选择，承担代价换取机缘。' },
  training: { name: '修炼', description: '升级或移除一张本局临时牌。' },
  merchant: { name: '商人', description: '使用本局灵砂购买牌、恢复或地图情报。' },
  chest: { name: '宝箱', description: '获得法宝充能、临时强化或永久材料。' },
  camp: { name: '营地', description: '在恢复生元与恢复行炁之间择一。' },
  boss: { name: '首领', description: '集齐劫印后开启槐姥试炼。' },
}

/** 25 个非起点格配额；加上固定起点后共 26 格。 */
export const TRIAL_TILE_DISTRIBUTION = {
  combat: 9,
  elite: 2,
  event: 6,
  training: 2,
  merchant: 1,
  chest: 2,
  camp: 2,
  boss: 1,
} as const satisfies Record<TrialTileKind, number>

export const TRIAL_TILE_RANGES = {
  combat: { min: 7, max: 9 },
  elite: { min: 2, max: 3 },
  event: { min: 4, max: 6 },
  training: { min: 2, max: 2 },
  merchant: { min: 1, max: 1 },
  chest: { min: 2, max: 3 },
  camp: { min: 2, max: 2 },
  boss: { min: 1, max: 1 },
} as const satisfies Record<TrialTileKind, { min: number; max: number }>

export type TrialEventId =
  | 'event_roadside_red_sedan'
  | 'event_talking_stele'
  | 'event_borrowed_umbrella'
  | 'event_moon_in_well'
  | 'event_title_seeking_immortal'
  | 'event_empty_paper_shop'
  | 'event_lost_woodcutter'
  | 'event_ruined_mountain_shrine'

export type TrialResourceId = 'actionPoints' | 'runCurrency' | 'spiritSand' | 'artifactEssence'
export type TrialEventRequirement =
  | { kind: 'action_points'; minimum: number }
  | { kind: 'resource'; resource: Exclude<TrialResourceId, 'actionPoints'>; minimum: number }
  | { kind: 'tag'; tag: Archetype }

export interface TrialEventCost {
  resource: TrialResourceId
  amount: number
}

export type TrialEventOutcomeKind =
  | 'action_points'
  | 'run_currency'
  | 'damage_leader'
  | 'heal_leader'
  | 'reveal_tiles'
  | 'temporary_card'
  | 'copy_temporary_card'
  | 'upgrade_temporary_card'
  | 'encounter'
  | 'grant_seal'
  | 'treasure_charge'
  | 'enemy_attack_bonus'
  | 'lore'

export interface TrialEventOutcome {
  kind: TrialEventOutcomeKind
  text: string
  amount?: number
  id?: string
  exhaust?: boolean
}

export interface TrialEventChoice {
  id: string
  label: string
  description: string
  requirements: readonly TrialEventRequirement[]
  costs: readonly TrialEventCost[]
  outcomes: readonly TrialEventOutcome[]
  loreUnlock?: string
}

export interface TrialEventDefinition {
  id: TrialEventId
  title: string
  bodyKey: string
  body: string
  choices: readonly TrialEventChoice[]
  loreUnlock: string
  oncePerRun: boolean
}

export const TRIAL_EVENTS = [
  {
    id: 'event_roadside_red_sedan', title: '路边红轿', bodyKey: 'trial_event_roadside_red_sedan',
    body: '浓雾里停着一顶没有脚印的红轿，轿帘随风向内招手。', loreUnlock: 'event_roadside_red_sedan', oncePerRun: true,
    choices: [
      { id: 'lift_curtain', label: '掀帘', description: '看看轿中究竟坐着谁。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'damage_leader', amount: 30, text: '轿中阴气缠身，主将损失约 15% 生元。' }, { kind: 'run_currency', amount: 30, text: '从空轿中拾得一串旧冥钱。' }], loreUnlock: 'event_roadside_red_sedan' },
      { id: 'walk_around', label: '绕行', description: '不惊动轿中之物，沿雾边离开。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'action_points', amount: 1, text: '绕行熟悉了雾路，返还一点行炁。' }] },
      { id: 'send_spirit', label: '让妖灵探查', description: '让一只妖灵靠近轿门，替你听一听里面的动静。', requirements: [{ kind: 'tag', tag: 'spirit' }], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'reveal_tiles', amount: 2, text: '妖灵认出轿后的旧路，揭开两格迷雾。' }, { kind: 'lore', text: '记下红轿的来历。' }], loreUnlock: 'event_roadside_red_sedan' },
    ],
  },
  {
    id: 'event_talking_stele', title: '会说话的石碑', bodyKey: 'trial_event_talking_stele',
    body: '残碑从土里露出半面，碑文不见字迹，却在问你：无根之木，如何过冬？', loreUnlock: 'event_talking_stele', oncePerRun: true,
    choices: [
      { id: 'answer_riddle', label: '回答谜句', description: '以山川常理回答石碑。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'reveal_tiles', amount: 3, text: '石碑让出一缕山风，揭开三格迷雾。' }] },
      { id: 'make_rubbing', label: '以器华拓印', description: '用器华换取残碑上的旧刻。', requirements: [{ kind: 'resource', resource: 'artifactEssence', minimum: 20 }], costs: [{ resource: 'artifactEssence', amount: 20 }], outcomes: [{ kind: 'upgrade_temporary_card', text: '拓印强化一张本局牌。' }, { kind: 'lore', text: '获得石碑残文。' }], loreUnlock: 'event_talking_stele' },
      { id: 'leave_stele', label: '不作回答', description: '绕开石碑，免得与它立下口舌因果。', requirements: [], costs: [], outcomes: [{ kind: 'lore', text: '沉默离开，雾气记下了你的背影。' }] },
    ],
  },
  {
    id: 'event_borrowed_umbrella', title: '雨夜借伞', bodyKey: 'trial_event_borrowed_umbrella',
    body: '雨幕里站着一个没有影子的人，向你借一把伞，说要去槐树下还愿。', loreUnlock: 'event_borrowed_umbrella', oncePerRun: true,
    choices: [
      { id: 'lend_umbrella', label: '借伞', description: '把伞递给无影之人，接下它留下的因果。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'encounter', id: 'borrowed_life_crone', text: '雨声引来借命婆，下一场战斗变为高风险遭遇。' }, { kind: 'enemy_attack_bonus', amount: 15, text: '因果加重，下一场敌人攻势提高 15%。' }], loreUnlock: 'event_borrowed_umbrella' },
      { id: 'refuse_umbrella', label: '拒绝', description: '告诉它槐阴古道不替陌生人遮雨。', requirements: [], costs: [], outcomes: [{ kind: 'run_currency', amount: 8, text: '无影之人留下几枚湿冷的冥钱。' }] },
      { id: 'ask_for_name', label: '先问姓名', description: '不接伞，只追问它要去见谁。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'reveal_tiles', amount: 1, text: '它指向槐根深处，揭开一格首领路线。' }, { kind: 'lore', text: '记下无影之人的称呼。' }], loreUnlock: 'event_borrowed_umbrella' },
    ],
  },
  {
    id: 'event_moon_in_well', title: '井中月', bodyKey: 'trial_event_moon_in_well',
    body: '废井里映着一轮不属于今夜的月亮，水面下似有一张牌被月光托起。', loreUnlock: 'event_moon_in_well', oncePerRun: true,
    choices: [
      { id: 'fish_reflection', label: '打捞倒影', description: '伸手捞出井中那张不知来处的牌。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'copy_temporary_card', text: '复制一张当前临时牌；牌组上限仍为 12 张。' }] },
      { id: 'offer_spirit_sand', label: '投入灵砂', description: '以灵砂买下井中月的一次照见。', requirements: [{ kind: 'resource', resource: 'spiritSand', minimum: 60 }], costs: [{ resource: 'spiritSand', amount: 60 }], outcomes: [{ kind: 'upgrade_temporary_card', text: '选择一张临时牌，获得本局强化。' }] },
      { id: 'seal_the_well', label: '封井', description: '以符纸压住井口，不让月影上岸。', requirements: [], costs: [], outcomes: [{ kind: 'run_currency', amount: 12, text: '井中月退去，留下少量灵砂。' }] },
    ],
  },
  {
    id: 'event_title_seeking_immortal', title: '黄仙讨封', bodyKey: 'trial_event_title_seeking_immortal',
    body: '黄皮子拦路作揖，问你它像不像一位得道仙家。它身后的尾巴已经数不清了。', loreUnlock: 'event_title_seeking_immortal', oncePerRun: true,
    choices: [
      { id: 'acknowledge_immortal', label: '认可', description: '顺着它的心愿，称它一声仙家。', requirements: [], costs: [], outcomes: [{ kind: 'run_currency', amount: 35, text: '黄仙大喜，送出一袋冥钱。' }, { kind: 'encounter', id: 'title_seeking_immortal', text: '它请同族试法，下一场普通战斗加入讨封黄仙。' }, { kind: 'enemy_attack_bonus', amount: 15, text: '下一场敌人攻势提高 15%。' }], loreUnlock: 'event_title_seeking_immortal' },
      { id: 'deny_immortal', label: '否认', description: '直说它只是拦路的黄鼠狼。', requirements: [], costs: [], outcomes: [{ kind: 'encounter', id: 'title_seeking_immortal', text: '黄仙恼怒，下一场遭遇的敌人获得额外攻势。' }, { kind: 'enemy_attack_bonus', amount: 15, text: '下一场敌人攻势提高 15%。' }] },
      { id: 'stay_silent', label: '沉默', description: '不替它讨封，也不与它结怨。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'reveal_tiles', amount: 2, text: '黄仙自讨没趣，临走前指了两条雾路。' }] },
    ],
  },
  {
    id: 'event_empty_paper_shop', title: '无人纸铺', bodyKey: 'trial_event_empty_paper_shop',
    body: '废驿旁的纸铺没有掌柜，柜台上的符箓却自己翻页，像在等人挑选。', loreUnlock: 'event_empty_paper_shop', oncePerRun: true,
    choices: [
      { id: 'buy_unknown_talisman', label: '买下未知符箓', description: '付出劫尘，带走一张可能反噬的耗用符牌。', requirements: [{ kind: 'resource', resource: 'runCurrency', minimum: 20 }], costs: [{ resource: 'runCurrency', amount: 20 }], outcomes: [{ kind: 'temporary_card', id: 'fire_talisman', exhaust: true, text: '获得一张本战斗耗用的临时贴火符。' }] },
      { id: 'inspect_paper_figures', label: '检查纸人', description: '翻看纸扎人的关节和背面。', requirements: [{ kind: 'tag', tag: 'talisman' }], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'reveal_tiles', amount: 2, text: '你发现纸人守着一条安全近路。' }, { kind: 'lore', text: '记下无人纸铺的规矩。' }], loreUnlock: 'event_empty_paper_shop' },
      { id: 'leave_paper_shop', label: '离开', description: '不碰无人看守的纸符。', requirements: [], costs: [], outcomes: [{ kind: 'lore', text: '离开纸铺时，身后多了一串纸脚印。' }] },
    ],
  },
  {
    id: 'event_lost_woodcutter', title: '迷路樵夫', bodyKey: 'trial_event_lost_woodcutter',
    body: '一个背着空柴篓的樵夫在雾中打转，问你山下的路是否还在。', loreUnlock: 'event_lost_woodcutter', oncePerRun: true,
    choices: [
      { id: 'guide_woodcutter', label: '替他指路', description: '按记忆指向不会被槐根吞掉的方向。', requirements: [], costs: [], outcomes: [{ kind: 'action_points', amount: 2, text: '樵夫回赠两点行炁。' }, { kind: 'reveal_tiles', amount: 1, text: '他替你指出一格安全路线。' }] },
      { id: 'follow_woodcutter', label: '跟随', description: '跟在樵夫身后，看他如何辨认古道。', requirements: [], costs: [{ resource: 'actionPoints', amount: 2 }], outcomes: [{ kind: 'reveal_tiles', amount: 3, text: '樵夫走过的路暂时不受迷雾遮蔽。' }] },
      { id: 'question_woodcutter', label: '质问', description: '问他为何只有空柴篓，却没有影子。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'encounter', id: 'headless_woodcutter', text: '樵夫抡斧回答，立即进入无首樵夫遭遇。' }, { kind: 'grant_seal', amount: 1, text: '若胜出，可额外取得一枚劫印。' }] },
    ],
  },
  {
    id: 'event_ruined_mountain_shrine', title: '山神残庙', bodyKey: 'trial_event_ruined_mountain_shrine',
    body: '残庙的山神像只剩半张脸，供桌上却有一盏刚点燃的灯，灯芯朝你轻轻弯腰。', loreUnlock: 'event_ruined_mountain_shrine', oncePerRun: true,
    choices: [
      { id: 'repair_shrine', label: '修缮', description: '用随身材料扶正神像，补上断裂的香案。', requirements: [{ kind: 'resource', resource: 'spiritSand', minimum: 30 }], costs: [{ resource: 'spiritSand', amount: 30 }], outcomes: [{ kind: 'heal_leader', amount: 57, text: '山风回暖，主将恢复约 30% 生元。' }, { kind: 'action_points', amount: 1, text: '香火为你补回一点行炁。' }] },
      { id: 'take_offering', label: '取走供品', description: '拿走供桌上未腐的果酒和香火钱。', requirements: [], costs: [], outcomes: [{ kind: 'run_currency', amount: 30, text: '获得一笔本局货币。' }, { kind: 'encounter', id: 'hundred_eyed_branch', text: '庙后槐枝睁眼，下一场遭遇变为百眼槐枝。' }, { kind: 'enemy_attack_bonus', amount: 15, text: '下一场敌人攻势提高 15%。' }] },
      { id: 'stay_overnight', label: '留宿', description: '在残庙里守到天亮，赌一盏灯的善意。', requirements: [], costs: [{ resource: 'actionPoints', amount: 1 }], outcomes: [{ kind: 'treasure_charge', amount: 1, text: '法宝获得一次额外充能。' }, { kind: 'heal_leader', amount: 15, text: '主将恢复少量生元。' }], loreUnlock: 'event_ruined_mountain_shrine' },
    ],
  },
] as const satisfies readonly TrialEventDefinition[]

export const TRIAL_EVENTS_BY_ID = Object.fromEntries(TRIAL_EVENTS.map((event) => [event.id, event])) as unknown as Record<TrialEventId, TrialEventDefinition>

export type TrialEncounterId = EnemyId | 'ancient_huai_matriarch'

export const TRIAL_COMMON_ENCOUNTER_POOL = [
  'shadow_civet', 'withered_vine_spirit', 'paper_child', 'corpse_lantern_moth', 'title_seeking_immortal',
  'clay_idol', 'coin_corpse', 'night_wandering_thrall', 'grave_crow_flock', 'headless_woodcutter',
] as const satisfies readonly EnemyId[]

export const TRIAL_ELITE_ENCOUNTER_POOL = [
  'borrowed_life_crone', 'hundred_eyed_branch', 'paper_armor_envoy',
] as const satisfies readonly EnemyId[]

export const HUAI_MATRIARCH_ID = 'ancient_huai_matriarch' as const

export const TRIAL_ENCOUNTER_POOLS = {
  common: TRIAL_COMMON_ENCOUNTER_POOL,
  elite: TRIAL_ELITE_ENCOUNTER_POOL,
  boss: [HUAI_MATRIARCH_ID],
} as const satisfies Readonly<Record<'common' | 'elite' | 'boss', readonly TrialEncounterId[]>>

export interface TrialBossPhase {
  id: 'rooted' | 'reflection' | 'huai_trial'
  name: string
  description: string
}

export const HUAI_MATRIARCH_CONTENT = {
  id: HUAI_MATRIARCH_ID,
  name: '千年槐姥',
  title: '槐根渡劫',
  artKey: 'boss_ancient_huai_matriarch',
  loreId: HUAI_MATRIARCH_ID,
  baseStats: { maxHp: 1_800, attack: 32, defense: 34, attackIntervalMs: 4_200 },
  phases: [
    { id: 'rooted', name: '盘根', description: '高护体并周期性生成槐根护盾，检验破甲与持续输出。' },
    { id: 'reflection', name: '摄魄', description: '标记一只妖灵并复制其下一次自动技能，检验协击时机。' },
    { id: 'huai_trial', name: '槐劫', description: '根据本场使用最多的流派标签施加对应反制，仍保留跨流派突破口。' },
  ] as const satisfies readonly TrialBossPhase[],
} as const

export const TRIAL_BOSS_CONTENT = HUAI_MATRIARCH_CONTENT
