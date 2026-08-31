import { AFFIXES, COLLECTION_BY_ID, type CollectionCategory, type CollectibleDefinition, type EquipmentSlot } from './collection'
import { COLLECTIBLE_EFFECTS, type EffectSpec } from './effects'
import { PROTOTYPE_CONTENT } from './prototype'
import { STAGES, getStage, getStageWaveEnemies } from './stages'
import { TRIAL_EVENTS_BY_ID, type TrialEventId } from './trial'
import { LORE_BY_ID } from './lore'
import { battleContentFromSave } from '../state/player-rules'
import type { PlayerSave } from '../state/player'
import type { Archetype, CardDefinition, EnemyDefinition, SpiritId } from '../game/types'
export type { EffectSpec } from './effects'

export interface EntityMechanic {
  label: string
  value: string
}

export interface EntityStat {
  label: string
  value: string
  delta?: string
}

export interface EntityDetail {
  id: string
  name: string
  category: string
  summary: string
  mechanics: EntityMechanic[]
  currentStats: EntityStat[]
  nextLevelStats?: EntityStat[]
  tags: string[]
  source: string
  artKey?: string
  level: number
  owned: boolean
  effect?: EffectSpec
}

const categoryNames: Record<CollectionCategory, string> = { weapon: '武器', equipment: '装备', technique: '功法', card: '术法', treasure: '法宝', consumable: '配方', spirit: '妖灵' }
const tagNames: Record<Archetype, string> = { sword: '剑意', talisman: '符咒', spirit: '御灵' }
const statLabels: Record<string, string> = {
  powerPercent: '伤害倍率', hits: '攻击段数', swordIntent: '剑意', armorBreak: '破甲层数', shield: '护盾', marks: '符印层数', burn: '灼烧层数', heal: '治疗', delayMs: '延后行动',
  attackIntervalMs: '行动间隔', maxHp: '最大生元', attack: '攻势', defense: '护体', cost: '灵力费用', cards: '触发牌数', spiritBond: '灵契', shieldPerMark: '每层护盾', discount: '减免费用', energy: '灵力', finisherPercent: '终结倍率', swordIntentCap: '剑意上限', burstPercent: '引爆倍率', burnPerOverflow: '溢出灼烧', leadMs: '提前行动', extendMs: '延长时间', basicAttackPowerPercent: '基础攻击倍率', attackEvery: '攻击次数', cardInterval: '每隔牌数', extraPowerPercent: '额外倍率', marksDetonated: '引爆层数', targets: '目标范围', triggerPercent: '触发生命比例', healPercent: '治疗比例', baseHp: '基础生元', baseAttack: '基础攻势', baseDefense: '基础护体', choices: '选项数', oncePerRun: '每局次数', stageNumber: '关卡编号', waves: '波次数', attackPerLevel: '每级攻势', defenseEveryLevels: '每几级护体', defensePerStep: '护体增量', hpPerLevel: '每级生元', firstComboBond: '首次协击灵契', bondThreshold: '协击阈值', detonateMarks: '引爆判定层数', finisherDiscount: '终结减费', maxDurationMs: '符印上限时间',
}

const enemyMechanics: Record<string, string> = {
  shadow_civet: '标准单体攻击，优先验证基础目标。',
  withered_vine_spirit: '每两次行动获得自身最大生元 18% 的护盾。',
  paper_child: '低生元单位，无额外机制；适合群体伤害。',
  corpse_lantern_moth: '攻击后给当前生元比例最低的友方施加 1 层灼烧。',
  title_seeking_immortal: '每次行动提高 10% 攻势，最多叠加 5 层。',
  clay_idol: '高护体单位，建议先施加破甲。',
  coin_corpse: '死亡时使所有存活敌人攻势提高 15%。',
  night_wandering_thrall: '优先攻击生元比例最低的存活妖灵，造成 110% 攻势伤害。',
  grave_crow_flock: '一次行动连续攻击三次，每次造成 45% 攻势伤害。',
  headless_woodcutter: '每 6 秒对主将造成 220% 攻势重击。',
  borrowed_life_crone: '玩家产生有效治疗时，自身恢复该治疗量的 50%。',
  hundred_eyed_branch: '玩家连续使用 3 张同标签牌时获得 25 点适应护盾。',
  paper_armor_envoy: '生元首次低于 60% 时召唤纸面童，并为其他敌人提供护盾。',
  ancient_huai_matriarch: '盘根、摄魄、槐劫三阶段各触发一次；阶段阈值为 66% 与 33%。',
}

function params(...entries: Array<[string, number | string | boolean | undefined]>) {
  return Object.fromEntries(entries.filter((entry): entry is [string, number | string | boolean] => entry[1] !== undefined))
}

const resourceLabels: Record<string, string> = { actionPoints: '行炁', artifactEssence: '器华', spiritSand: '灵砂', cultivation: '修为', runCurrency: '劫尘' }

const cardEffects: Record<string, EffectSpec> = Object.fromEntries(Object.values(PROTOTYPE_CONTENT.cards).map((card) => [card.id, {
  effectId: card.effectId,
  params: params(['cost', card.cost], ['targetRule', card.targetRule], ['powerPercent', card.powerPercent], ['hits', card.hits], ['swordIntent', card.swordIntent], ['armorBreak', card.armorBreak], ['shield', card.shield], ['marks', card.marks], ['burn', card.burn], ['heal', card.heal], ['delayMs', card.delayMs]),
  scalableParams: ['powerPercent', 'shield', 'heal'].filter((key) => card[key as keyof CardDefinition] !== undefined),
}]))

const unitEffects: Record<string, EffectSpec> = Object.fromEntries([
  ...Object.values(PROTOTYPE_CONTENT.weapons),
  ...Object.values(PROTOTYPE_CONTENT.techniques),
  ...Object.values(PROTOTYPE_CONTENT.spirits),
].filter((unit) => unit.effectId).map((unit) => [unit.id, { effectId: unit.effectId!, params: unit.effectParams ?? {} }]))

export const EFFECT_SPECS: Readonly<Record<string, EffectSpec>> = {
  ...cardEffects,
  ...COLLECTIBLE_EFFECTS,
  ...unitEffects,
}

function saveAtLevel(save: PlayerSave, id: string, level: number): PlayerSave {
  return { ...save, levels: { ...save.levels, [id]: level } }
}

function text(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return value >= 1_000 ? `${value / 1_000}s` : String(value)
  return String(value)
}

function valueText(key: string, value: unknown) {
  if (typeof value === 'number' && key.toLowerCase().includes('percent')) return `${value}%`
  if (typeof value === 'number' && key.toLowerCase().endsWith('ms')) return `${value}ms`
  return text(value)
}

function effectParamsAtLevel(effect: EffectSpec | undefined, level: number) {
  if (!effect) return {}
  const multiplier = 100 + Math.max(0, level - 1) * 5
  return Object.fromEntries(Object.entries(effect.params).map(([key, value]) => [key, typeof value === 'number' && effect.scalableParams?.includes(key) ? Math.floor(value * multiplier / 100) : value]))
}

function effectMechanics(effect: EffectSpec | undefined, level = 1): EntityMechanic[] {
  if (!effect) return []
  return Object.entries(effectParamsAtLevel(effect, level)).map(([key, value]) => ({ label: statLabels[key] ?? key, value: valueText(key, value) }))
}

function cardDetail(card: CardDefinition, save: PlayerSave): EntityDetail {
  const level = save.levels[card.id] ?? 1
  const currentContent = battleContentFromSave(save).cards[card.id]
  const nextContent = battleContentFromSave(saveAtLevel(save, card.id, Math.min(10, level + 1))).cards[card.id]
  const values: Array<keyof CardDefinition> = ['cost', 'powerPercent', 'hits', 'swordIntent', 'armorBreak', 'shield', 'marks', 'burn', 'heal', 'delayMs']
  const currentStats = values.filter((key) => currentContent[key] !== undefined).map((key) => ({ label: statLabels[key] ?? key, value: `${text(currentContent[key])}${key === 'powerPercent' ? '%' : key === 'delayMs' ? 'ms' : ''}` }))
  const nextLevelStats = level < 10 ? values.filter((key) => nextContent[key] !== undefined).map((key) => {
    const current = Number(currentContent[key])
    const next = Number(nextContent[key])
    const unit = key === 'powerPercent' ? '%' : key === 'delayMs' ? 'ms' : ''
    return { label: statLabels[key] ?? key, value: `${text(next)}${unit}`, delta: next === current ? '不变' : `+${next - current}${unit}` }
  }) : undefined
  const effect = EFFECT_SPECS[card.id]
  return { id: card.id, name: card.name, category: card.kind, summary: card.description, mechanics: [{ label: '目标', value: card.targetRule === 'none' ? '无目标' : card.targetRule === 'all_enemies' ? '全体敌人' : card.targetRule === 'chosen_spirit' ? '指定存活妖灵' : '当前敌人' }, ...effectMechanics(effect)], currentStats, nextLevelStats, tags: card.tags.map((tag) => tagNames[tag]), source: '游历关卡与劫境奖励', artKey: card.artKey, level, owned: save.ownedIds.includes(card.id), effect }
}

function weaponDetail(id: keyof typeof PROTOTYPE_CONTENT.weapons, save: PlayerSave): EntityDetail {
  const weapon = PROTOTYPE_CONTENT.weapons[id]
  const level = save.levels[id] ?? 1
  const atWeapon = { ...save, loadout: { ...save.loadout, weaponId: id } }
  const currentContent = battleContentFromSave(atWeapon)
  const nextContent = battleContentFromSave(saveAtLevel(atWeapon, id, Math.min(10, level + 1)))
  const baseContent = battleContentFromSave(saveAtLevel(atWeapon, id, 1))
  const currentBonus = currentContent.leader.attack - baseContent.leader.attack
  const nextBonus = nextContent.leader.attack - baseContent.leader.attack
  const effect = weapon.effectId ? { effectId: weapon.effectId, params: weapon.effectParams ?? {} } : undefined
  return { id, name: weapon.name, category: '武器', summary: '决定主将的基础攻击间隔与流派标签。', mechanics: [{ label: '攻击间隔', value: `${weapon.attackIntervalMs}ms` }, { label: '成长', value: '每级主将攻势 +2' }, ...effectMechanics(effect)], currentStats: [{ label: '流派', value: tagNames[weapon.tag] }, { label: '攻击间隔', value: `${weapon.attackIntervalMs}ms` }, { label: '主将攻势加成', value: `+${currentBonus}` }], nextLevelStats: level < 10 ? [{ label: '主将攻势加成', value: `+${nextBonus}`, delta: `+${nextBonus - currentBonus}` }] : undefined, tags: [tagNames[weapon.tag]], source: '炼气试演初始构筑或第 4/10 关解锁', artKey: COLLECTION_BY_ID[id]?.artKey, level, owned: save.ownedIds.includes(id), effect }
}

function techniqueDetail(id: keyof typeof PROTOTYPE_CONTENT.techniques, save: PlayerSave): EntityDetail {
  const technique = PROTOTYPE_CONTENT.techniques[id]
  const level = save.levels[id] ?? 1
  const atTechnique = { ...save, loadout: { ...save.loadout, techniqueId: id } }
  const currentContent = battleContentFromSave(atTechnique)
  const nextContent = battleContentFromSave(saveAtLevel(atTechnique, id, Math.min(10, level + 1)))
  const baseContent = battleContentFromSave(saveAtLevel(atTechnique, id, 1))
  const currentBonus = currentContent.leader.defense - baseContent.leader.defense
  const nextBonus = nextContent.leader.defense - baseContent.leader.defense
  const effect = technique.effectId ? { effectId: technique.effectId, params: technique.effectParams ?? {} } : undefined
  return { id, name: technique.name, category: '功法', summary: '决定主将的核心被动与流派资源。', mechanics: [{ label: '修行成长', value: '每 2 级主将护体 +1' }, { label: '流派', value: tagNames[technique.tag] }, ...effectMechanics(effect)], currentStats: [{ label: '流派', value: tagNames[technique.tag] }, { label: '主将护体加成', value: `+${currentBonus}` }], nextLevelStats: level < 10 ? [{ label: '主将护体加成', value: `+${nextBonus}`, delta: `${nextBonus - currentBonus >= 0 ? '+' : ''}${nextBonus - currentBonus}` }] : undefined, tags: [tagNames[technique.tag]], source: '游历关卡固定解锁', artKey: COLLECTION_BY_ID[id]?.artKey, level, owned: save.ownedIds.includes(id), effect }
}

function spiritDetail(id: SpiritId, save: PlayerSave): EntityDetail {
  const level = save.levels[id] ?? 1
  const current = battleContentFromSave(save).spirits[id]
  const next = battleContentFromSave(saveAtLevel(save, id, Math.min(10, level + 1))).spirits[id]
  const fields: Array<keyof typeof current> = ['maxHp', 'attack', 'defense', 'attackIntervalMs']
  const currentStats = fields.map((key) => ({ label: statLabels[key] ?? key, value: `${current[key]}${key === 'attackIntervalMs' ? 'ms' : ''}` }))
  const nextLevelStats = level < 10 ? fields.map((key) => ({ label: statLabels[key] ?? key, value: `${next[key]}${key === 'attackIntervalMs' ? 'ms' : ''}`, delta: next[key] === current[key] ? '不变' : `+${Number(next[key]) - Number(current[key])}` })) : undefined
  const effect = current.effectId ? { effectId: current.effectId, params: current.effectParams ?? {} } : undefined
  return { id, name: current.name, category: '妖灵', summary: `${current.title}，可参与自动行动与灵契协击。`, mechanics: [{ label: '行动方式', value: '自动攻击；灵契满 3 点触发协击' }, { label: '标签', value: current.tags.map((tag) => tagNames[tag]).join('、') }, ...effectMechanics(effect)], currentStats, nextLevelStats, tags: current.tags.map((tag) => tagNames[tag]), source: '槐阴古道固定节点与劫境', artKey: current.artKey, level, owned: save.ownedIds.includes(id), effect }
}

function collectibleDetail(item: CollectibleDefinition, save: PlayerSave): EntityDetail {
  const level = save.levels[item.id] ?? 1
  const effect = EFFECT_SPECS[item.id]
  const currentEffect = effectParamsAtLevel(effect, level)
  const nextEffect = effectParamsAtLevel(effect, Math.min(10, level + 1))
  const currentStats: EntityStat[] = [{ label: '稀有度', value: ({ common: '凡品', uncommon: '珍品', rare: '秘品', legacy: '传承' })[item.rarity] }, { label: '等级', value: `${level} / 10` }]
  if (item.slot) currentStats.push({ label: '装备槽', value: ({ head: '头冠', robe: '法衣', feet: '足履', charm: '佩饰' } as Record<EquipmentSlot, string>)[item.slot] })
  if (item.category === 'equipment') currentStats.push(...(save.equipmentAffixes[item.id] ?? []).map((id) => ({ label: '附加词条', value: `${AFFIXES[id].name} +${AFFIXES[id].value}${AFFIXES[id].suffix}` })))
  currentStats.push(...effectMechanics(effect, level).map((entry) => ({ label: entry.label, value: entry.value })))
  const nextLevelStats = level < 10 ? [{ label: '等级', value: `${level + 1} / 10`, delta: '+1' }, ...effectMechanics(effect, level + 1).map((entry, index) => { const key = Object.keys(nextEffect)[index]; const previous = currentEffect[key]; const next = nextEffect[key]; const delta = typeof previous === 'number' && typeof next === 'number' && next !== previous ? `${next - previous >= 0 ? '+' : ''}${next - previous}` : '不变'; return { label: entry.label, value: entry.value, delta } })] : undefined
  return { id: item.id, name: item.name, category: categoryNames[item.category], summary: item.summary, mechanics: [{ label: '规则', value: item.summary }, ...effectMechanics(effect, level)], currentStats, nextLevelStats, tags: item.tags.map((tag) => tagNames[tag as Archetype] ?? tag), source: item.unlockSource, artKey: item.artKey, level, owned: save.ownedIds.includes(item.id), effect }
}

function enemyDetail(enemy: EnemyDefinition, save: PlayerSave, stageNumber?: number): EntityDetail {
  const level = stageNumber ?? 0
  const scaled = stageNumber
    ? getStage(stageNumber).waves.flatMap((_, index) => getStageWaveEnemies(getStage(stageNumber), index)).find((value) => value.id === enemy.id) ?? enemy
    : enemy
  const lore = LORE_BY_ID[enemy.id]
  return { id: enemy.id, name: enemy.name, category: enemy.id === 'ancient_huai_matriarch' ? '首领' : enemy.id === 'borrowed_life_crone' || enemy.id === 'hundred_eyed_branch' || enemy.id === 'paper_armor_envoy' ? '精英' : '敌人', summary: lore?.summary ?? enemy.title, mechanics: [{ label: '行为', value: enemy.title }, { label: '机制', value: enemyMechanics[enemy.id] ?? '标准单体攻击。' }, { label: '行动间隔', value: `${scaled.attackIntervalMs}ms` }], currentStats: [{ label: '生元', value: String(scaled.maxHp) }, { label: '攻势', value: String(scaled.attack) }, { label: '护体', value: String(scaled.defense) }, { label: '关卡缩放', value: stageNumber ? `第 ${stageNumber} 关` : '基础' }], tags: [], source: '槐阴古道关卡与劫境', artKey: enemy.artKey, level, owned: save.discoveredLoreIds.includes(enemy.id), effect: { effectId: enemy.behaviorId, params: { baseHp: enemy.maxHp, baseAttack: enemy.attack, baseDefense: enemy.defense, attackIntervalMs: enemy.attackIntervalMs } } }
}

function eventDetail(id: TrialEventId, save: PlayerSave): EntityDetail {
  const event = TRIAL_EVENTS_BY_ID[id]
  return { id, name: event.title, category: '怪谈', summary: event.body, mechanics: event.choices.map((choice) => ({ label: choice.label, value: `${choice.description}${choice.requirements.length ? `；条件：${choice.requirements.map((requirement) => requirement.kind === 'tag' ? `标签${tagNames[requirement.tag!]}` : requirement.kind === 'action_points' ? `${requirement.minimum ?? 0} 行炁` : `${requirement.minimum ?? 0} ${resourceLabels[requirement.resource] ?? requirement.resource}`).join('、')}` : ''}${choice.costs.length ? `；成本：${choice.costs.map((cost) => `${cost.amount} ${resourceLabels[cost.resource] ?? cost.resource}`).join('、')}` : ''}；结果：${choice.outcomes.map((outcome) => outcome.text).join(' ')}` })), currentStats: [{ label: '选项数', value: String(event.choices.length) }, { label: '每局次数', value: event.oncePerRun ? '1 次' : '不限' }], tags: [], source: '槐阴劫境', level: 0, owned: save.discoveredLoreIds.includes(id), effect: { effectId: 'trial_event', params: { choices: event.choices.length, oncePerRun: event.oncePerRun } } }
}

export function getEntityDetail(id: string, save: PlayerSave, context: { stageNumber?: number } = {}): EntityDetail | undefined {
  const item = COLLECTION_BY_ID[id]
  if (item) {
    if (item.category === 'card') return cardDetail(PROTOTYPE_CONTENT.cards[id as CardDefinition['id']], save)
    if (item.category === 'weapon') return weaponDetail(id as keyof typeof PROTOTYPE_CONTENT.weapons, save)
    if (item.category === 'technique') return techniqueDetail(id as keyof typeof PROTOTYPE_CONTENT.techniques, save)
    if (item.category === 'spirit') return spiritDetail(id as SpiritId, save)
    return collectibleDetail(item, save)
  }
  const enemy = PROTOTYPE_CONTENT.enemyDefinitions[id as keyof typeof PROTOTYPE_CONTENT.enemyDefinitions]
  if (enemy) return enemyDetail(enemy, save, context.stageNumber)
  if (id in TRIAL_EVENTS_BY_ID) return eventDetail(id as TrialEventId, save)
  const stage = STAGES.find((value) => value.id === id)
  if (stage) {
    const waveDetails = stage.waves.map((_, index) => getStageWaveEnemies(stage, index).map((enemy) => `${enemy.name}（${enemy.maxHp}/${enemy.attack}/${enemy.defense}，${enemy.attackIntervalMs}ms）`).join('、'))
    return {
      id: stage.id,
      name: stage.name,
      category: '关卡',
      summary: `${stage.waves.length} 波战斗，推荐${stage.recommendedTags.map((tag) => tagNames[tag]).join('、')}。`,
      mechanics: [
        { label: '敌方波次', value: waveDetails.map((wave, index) => `第${index + 1}波：${wave}`).join('；') },
        { label: '首通奖励', value: `${stage.firstClearReward.cultivation} 修为 / ${stage.firstClearReward.spiritSand} 灵砂` },
        { label: '稳定奖励', value: `${stage.repeatReward.cultivation} 修为 / ${stage.repeatReward.spiritSand} 灵砂` },
      ],
      currentStats: [
        { label: '波次', value: String(stage.waves.length) },
        { label: '推荐标签', value: stage.recommendedTags.map((tag) => tagNames[tag]).join('、') },
        { label: '固定解锁', value: stage.unlockIds.length ? stage.unlockIds.join('、') : '无' },
      ],
      tags: stage.recommendedTags.map((tag) => tagNames[tag]),
      source: stage.regionId,
      level: stage.stageNumber,
      owned: save.campaign.highestClearedStage >= stage.stageNumber,
      effect: { effectId: 'campaign_stage', params: { stageNumber: stage.stageNumber, waves: stage.waves.length } },
    }
  }
  return undefined
}

export const DETAIL_ENTITY_IDS = [...Object.keys(COLLECTION_BY_ID), ...Object.keys(PROTOTYPE_CONTENT.enemyDefinitions), ...Object.keys(TRIAL_EVENTS_BY_ID), ...STAGES.map((stage) => stage.id)]
