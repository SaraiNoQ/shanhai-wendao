import type { BattleContent, BuildId, BuildPreset, CardDefinition, CardId, EnemyDefinition, EnemyId, SpiritDefinition, SpiritId, TechniqueId, WeaponId } from '../game/types'

function card(id: CardId, name: string, cost: number, kind: CardDefinition['kind'], tags: CardDefinition['tags'], effectId: CardDefinition['effectId'], description: string, params: Partial<CardDefinition> = {}, targetRule: CardDefinition['targetRule'] = 'current_enemy'): CardDefinition {
  return { id, name, cost, kind, tags, effectId, description, targetRule, ...params }
}

const cards = {
  guiding_edge: card('guiding_edge', '引锋式', 1, '剑式', ['sword'], 'sword_strike', '造成 80% 攻势伤害，获得 2 点剑意。', { powerPercent: 80, swordIntent: 2, artKey: 'card_guiding_edge' }),
  hidden_edge: card('hidden_edge', '藏锋', 1, '心法', ['sword'], 'prime_sword_intent', '获得 22 点护盾；下一次获得剑意时额外获得 1 点。', { shield: 22 }),
  returning_wind: card('returning_wind', '回风剑', 2, '剑式', ['sword'], 'sword_multi_hit', '攻击两次；本场用过的不同剑式会强化第二击。', { powerPercent: 70, hits: 2 }),
  flowing_cloud_slashes: card('flowing_cloud_slashes', '流云三斩', 3, '剑式', ['sword'], 'sword_multi_hit', '攻击三次，每次命中伤害提高。', { powerPercent: 55, hits: 3 }),
  armor_piercing_star: card('armor_piercing_star', '破甲点星', 2, '剑式', ['sword'], 'armor_break_strike', '造成 90% 攻势伤害，施加 2 层破甲。', { powerPercent: 90, armorBreak: 2 }),
  sheathe_sword: card('sheathe_sword', '御剑归鞘', 2, '剑式', ['sword'], 'sword_refund', '造成伤害；剑意不少于 6 时返还 1 点灵力。', { powerPercent: 100 }),
  ten_thousand_blades: card('ten_thousand_blades', '万剑成势', 4, '剑式', ['sword'], 'sword_intent_barrage', '按当前剑意造成多段伤害，但不消耗剑意。', { powerPercent: 40 }),
  mountain_splitter: card('mountain_splitter', '一剑开山', 5, '剑式', ['sword'], 'sword_finisher', '消耗全部剑意，造成终结伤害。', { powerPercent: 160, artKey: 'card_mountain_splitter' }),
  fire_talisman: card('fire_talisman', '贴火符', 1, '符箓', ['talisman'], 'apply_marks_and_burn', '施加 2 层符印和 1 层灼烧。', { marks: 2, burn: 1, artKey: 'card_fire_talisman' }),
  mountain_seal: card('mountain_seal', '镇岳符', 2, '符箓', ['talisman'], 'shield_and_mark', '获得 24 点护盾，并施加 1 层符印。', { shield: 24, marks: 1 }),
  thunder_talisman: card('thunder_talisman', '引雷符', 2, '符箓', ['talisman'], 'mark_scaled_strike', '造成伤害；每层符印使伤害提高。', { powerPercent: 80 }),
  shadow_binding_talisman: card('shadow_binding_talisman', '缚影符', 2, '符箓', ['talisman'], 'bind_shadow', '施加 2 层符印，并延后敌人下一次攻击。', { marks: 2, delayMs: 1_250 }),
  life_talisman: card('life_talisman', '续命符', 3, '符箓', ['talisman'], 'life_from_mark', '治疗最低生元友方；消耗 1 层符印时额外治疗。', { heal: 28 }),
  linked_talisman_script: card('linked_talisman_script', '符阵连书', 2, '符箓', ['talisman'], 'prime_talisman_discount', '接下来两张符法牌各少消耗 1 点灵力。', {}, 'none'),
  urgent_edict: card('urgent_edict', '敕令·急急如律', 1, '敕令', ['talisman'], 'detonate_marks', '消耗当前目标全部符印并造成引爆伤害。'),
  nine_heavens_edict: card('nine_heavens_edict', '九霄雷诏', 5, '敕令', ['talisman'], 'storm_edict', '对所有敌人造成伤害，分别引爆至多 3 层符印。', { powerPercent: 120, artKey: 'card_nine_heavens_edict' }, 'all_enemies'),
  call_true_name: card('call_true_name', '唤名', 1, '御灵', ['spirit'], 'gain_lowest_bond', '灵契最低的妖灵获得 1 点灵契。', { artKey: 'card_call_true_name' }, 'none'),
  share_spirit_breath: card('share_spirit_breath', '分食灵息', 2, '御灵', ['spirit'], 'share_spirit_breath', '两只妖灵恢复生元，主将恢复 1 点灵力。', { heal: 18 }, 'none'),
  fight_together: card('fight_together', '并肩', 2, '御灵', ['spirit'], 'spirit_basic_attacks', '两只妖灵立即发动一次普通攻击。', { powerPercent: 80 }),
  protect_master: card('protect_master', '护主', 2, '御灵', ['spirit'], 'protect_master', '指定一只妖灵为主将提供护盾，并获得 1 点灵契。', { shield: 20 }, 'chosen_spirit'),
  spirit_tide: card('spirit_tide', '兽潮', 3, '御灵', ['spirit'], 'spirit_tide', '两只妖灵依次攻击；目标有负面状态时伤害提高。', { powerPercent: 100 }),
  borrow_spirit: card('borrow_spirit', '借灵', 2, '御灵', ['spirit'], 'copy_spirit_combo', '复制下一次妖灵协击的附加效果，不复制伤害。', {}, 'none'),
  all_spirits_covenant: card('all_spirits_covenant', '万灵同契', 4, '御灵', ['spirit'], 'mass_spirit_bond', '两只妖灵各获得 2 点灵契，协击伤害本场提高。', {}, 'none'),
  night_of_hundred_beasts: card('night_of_hundred_beasts', '百兽夜行', 5, '御灵', ['spirit'], 'spirit_combo_finisher', '根据本场协击次数造成多段伤害，随后各补 1 点灵契。', { powerPercent: 45, artKey: 'card_night_of_hundred_beasts' }),
} satisfies Record<CardId, CardDefinition>

function spirit(id: SpiritId, name: string, title: string, maxHp: number, attack: number, defense: number, attackIntervalMs: number, tags: SpiritDefinition['tags'], artKey?: string): SpiritDefinition {
  return { id, name, title, maxHp, attack, defense, attackIntervalMs, tags, artKey }
}

const spirits = {
  blade_tail_fox: spirit('blade_tail_fox', '刃尾狐', '三式追击', 96, 17, 10, 4_500, ['sword'], 'spirit_blade_tail_fox'),
  iron_beak_crane: spirit('iron_beak_crane', '铁喙鹤', '重击破甲', 108, 21, 14, 5_500, ['sword'], 'spirit_iron_beak_crane'),
  paper_bride: spirit('paper_bride', '纸嫁娘', '纸衣镇魂', 94, 15, 11, 4_800, ['talisman'], 'spirit_paper_bride'),
  lantern_ghost: spirit('lantern_ghost', '灯笼鬼', '鬼火灼魂', 88, 18, 8, 4_200, ['talisman'], 'spirit_lantern_ghost'),
  mountain_child: spirit('mountain_child', '山童', '负石护主', 126, 14, 20, 5_200, ['spirit'], 'spirit_mountain_child'),
  dream_tapir: spirit('dream_tapir', '食梦貘', '吞梦回灵', 102, 16, 13, 4_600, ['spirit'], 'spirit_dream_tapir'),
} satisfies Record<SpiritId, SpiritDefinition>

function enemy(id: EnemyId, name: string, title: string, maxHp: number, attack: number, defense: number, attackIntervalMs: number, artKey?: string): EnemyDefinition {
  return { id, name, title, maxHp, attack, defense, attackIntervalMs, behaviorId: id, artKey }
}

const enemyDefinitions = {
  shadow_civet: enemy('shadow_civet', '影狸', '雾中窃影', 150, 17, 10, 3_100, 'enemy_shadow_civet'),
  withered_vine_spirit: enemy('withered_vine_spirit', '枯藤魅', '朽根缠生', 175, 14, 15, 3_700),
  paper_child: enemy('paper_child', '纸面童', '纸扎成群', 92, 13, 7, 2_900, 'enemy_paper_child'),
  corpse_lantern_moth: enemy('corpse_lantern_moth', '尸灯蛾', '尸火扑面', 135, 14, 9, 3_300),
  title_seeking_immortal: enemy('title_seeking_immortal', '讨封黄仙', '借口成人', 165, 14, 12, 3_200),
  clay_idol: enemy('clay_idol', '泥胎傀', '负土成形', 210, 17, 32, 3_200, 'enemy_clay_idol'),
  coin_corpse: enemy('coin_corpse', '铜钱尸', '钱眼通阴', 165, 16, 16, 3_500),
  night_wandering_thrall: enemy('night_wandering_thrall', '夜游伥', '逐灵而噬', 155, 18, 12, 3_000),
  grave_crow_flock: enemy('grave_crow_flock', '墓鸦群', '群喙叩骨', 145, 15, 10, 3_250),
  headless_woodcutter: enemy('headless_woodcutter', '无首樵夫', '伐根不止', 245, 24, 20, 6_000, 'enemy_headless_woodcutter'),
  borrowed_life_crone: enemy('borrowed_life_crone', '借命婆', '一盏换一命', 420, 20, 20, 4_000, 'enemy_borrowed_life_crone'),
  hundred_eyed_branch: enemy('hundred_eyed_branch', '百眼槐枝', '见法生壳', 560, 22, 24, 3_800, 'enemy_hundred_eyed_branch'),
  paper_armor_envoy: enemy('paper_armor_envoy', '纸甲巡使', '封关巡夜', 720, 25, 28, 3_600, 'enemy_paper_armor_envoy'),
  ancient_huai_matriarch: enemy('ancient_huai_matriarch', '千年槐姥', '槐根渡劫', 1_800, 32, 34, 4_200, 'boss_ancient_huai_matriarch'),
} satisfies Record<EnemyId, EnemyDefinition>

function build(id: BuildId, name: string, subtitle: string, weaponId: WeaponId, techniqueId: TechniqueId, spiritIds: BuildPreset['spiritIds'], cardIds: BuildPreset['cardIds']): BuildPreset {
  return { id, name, subtitle, weaponId, techniqueId, spiritIds, cardIds }
}

const builds = {
  pure_sword: build('pure_sword', '剑意', '连斩积势，一剑开山', 'azure_wind_sword', 'hidden_edge_art', ['blade_tail_fox', 'iron_beak_crane'], ['guiding_edge', 'hidden_edge', 'returning_wind', 'armor_piercing_star', 'ten_thousand_blades', 'mountain_splitter']),
  pure_talisman: build('pure_talisman', '符咒', '贴符蓄势，敕令引爆', 'cinnabar_brush', 'edict_talisman_codex', ['paper_bride', 'lantern_ghost'], ['fire_talisman', 'mountain_seal', 'thunder_talisman', 'shadow_binding_talisman', 'urgent_edict', 'nine_heavens_edict']),
  pure_spirit: build('pure_spirit', '御灵', '分配灵契，双妖协击', 'spirit_bell', 'hundred_spirit_codex', ['mountain_child', 'dream_tapir'], ['call_true_name', 'share_spirit_breath', 'fight_together', 'protect_master', 'all_spirits_covenant', 'night_of_hundred_beasts']),
  flying_sword_seal: build('flying_sword_seal', '飞剑镇符', '剑意终结引爆符印', 'azure_wind_sword', 'edict_talisman_codex', ['blade_tail_fox', 'paper_bride'], ['guiding_edge', 'armor_piercing_star', 'mountain_splitter', 'fire_talisman', 'thunder_talisman', 'urgent_edict']),
  spirit_edict: build('spirit_edict', '灵使敕令', '协击使命令减耗', 'cinnabar_brush', 'hundred_spirit_codex', ['paper_bride', 'dream_tapir'], ['fire_talisman', 'urgent_edict', 'call_true_name', 'fight_together', 'all_spirits_covenant', 'spirit_tide']),
  dual_spirit_sword: build('dual_spirit_sword', '双灵剑阵', '剑式与灵契彼此催动', 'spirit_bell', 'hidden_edge_art', ['blade_tail_fox', 'mountain_child'], ['guiding_edge', 'returning_wind', 'mountain_splitter', 'call_true_name', 'fight_together', 'all_spirits_covenant']),
} satisfies Record<BuildId, BuildPreset>

export const PROTOTYPE_CONTENT = {
  leader: { id: 'leader', name: '无名修士', maxHp: 190, attack: 25, defense: 18, artKey: 'portrait_leader_01' },
  spirits,
  enemies: [enemyDefinitions.clay_idol],
  enemyDefinitions,
  weapons: {
    azure_wind_sword: { id: 'azure_wind_sword', name: '青岚剑', tag: 'sword', attackIntervalMs: 1_850 },
    cinnabar_brush: { id: 'cinnabar_brush', name: '朱砂笔', tag: 'talisman', attackIntervalMs: 2_300 },
    spirit_bell: { id: 'spirit_bell', name: '唤灵铃', tag: 'spirit', attackIntervalMs: 2_800 },
  },
  techniques: {
    hidden_edge_art: { id: 'hidden_edge_art', name: '太虚藏锋诀', tag: 'sword' },
    edict_talisman_codex: { id: 'edict_talisman_codex', name: '上清敕符录', tag: 'talisman' },
    hundred_spirit_codex: { id: 'hundred_spirit_codex', name: '百灵归契篇', tag: 'spirit' },
  },
  cards,
  builds,
  defaultBuildId: 'pure_sword',
} satisfies BattleContent
