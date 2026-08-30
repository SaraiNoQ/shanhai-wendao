import { PROTOTYPE_CONTENT } from './prototype'
import type { Archetype, EnemyDefinition, EnemyId } from '../game/types'

export type RegionId = 'mist_road' | 'ruined_waystation' | 'huai_roots'

export interface StageDefinition {
  id: `stage_${string}`
  stageNumber: number
  name: string
  regionId: RegionId
  recommendedTags: Archetype[]
  waves: EnemyId[][]
  firstClearReward: { cultivation: number; spiritSand: number }
  repeatReward: { cultivation: number; spiritSand: number }
  unlockIds: string[]
  isRealmGate: boolean
  backgroundArtKey: string
}

const names = [
  '雾起岔道', '影离旧碑', '纸童问路', '尸灯扑火', '黄仙讨封', '泥祠初醒', '铜钱叩夜', '驿外红灯', '槐影追魂', '借命茶棚',
  '土傀拦道', '铜尸抬棺', '伥鬼觅灵', '群鸦蔽月', '樵斧无首', '纸铺关门', '枯藤缠驿', '山庙残钟', '墓火引路', '百眼窥心',
  '影狸成群', '黄仙拦轿', '尸灯成潮', '铜尸借势', '无首伐根', '深雾纸阵', '夜游索命', '百鸦归槐', '槐根门前', '纸甲封关',
]

const primaryEnemies: EnemyId[] = [
  'shadow_civet', 'withered_vine_spirit', 'paper_child', 'corpse_lantern_moth', 'title_seeking_immortal', 'clay_idol', 'coin_corpse', 'night_wandering_thrall', 'grave_crow_flock', 'borrowed_life_crone',
  'headless_woodcutter', 'clay_idol', 'night_wandering_thrall', 'grave_crow_flock', 'headless_woodcutter', 'paper_child', 'withered_vine_spirit', 'corpse_lantern_moth', 'coin_corpse', 'hundred_eyed_branch',
  'shadow_civet', 'title_seeking_immortal', 'corpse_lantern_moth', 'coin_corpse', 'headless_woodcutter', 'paper_child', 'night_wandering_thrall', 'grave_crow_flock', 'withered_vine_spirit', 'paper_armor_envoy',
]

const unlocks: string[][] = [
  ['flowing_cloud_slashes'],
  ['sheathe_sword', 'fire_talisman'],
  ['paper_bride', 'mountain_seal'],
  ['cinnabar_brush', 'thunder_talisman'],
  ['lantern_ghost', 'shadow_binding_talisman'],
  ['life_talisman', 'linked_talisman_script'],
  ['urgent_edict', 'nine_heavens_edict'],
  ['edict_talisman_codex', 'equipment_cinnabar_crown'],
  ['call_true_name', 'mountain_child'],
  ['spirit_bell', 'share_spirit_breath'],
  ['dream_tapir', 'fight_together'],
  ['protect_master', 'spirit_tide'],
  ['borrow_spirit', 'all_spirits_covenant'],
  ['night_of_hundred_beasts', 'hundred_spirit_codex'],
  ['equipment_hundred_beast_circlet', 'treasure_soul_summoning_banner'],
  ['equipment_talisman_silk_robe'], ['equipment_mountain_lord_pelt'], ['equipment_star_treading_shoes'], ['equipment_tracking_straw_sandals'], ['equipment_thunder_coin'], ['equipment_paired_bronze_bell'],
  ['treasure_demon_revealing_mirror'], ['treasure_primordial_gourd'], ['treasure_demon_binding_rope'], ['treasure_mountain_river_inkstone'],
  ['consumable_meridian_guard_pill'], ['consumable_evil_breaking_talisman'], ['consumable_armor_escape_talisman'], ['consumable_thunder_summoning_talisman'], [],
]

const earlyPool: EnemyId[] = ['shadow_civet', 'withered_vine_spirit', 'paper_child', 'corpse_lantern_moth', 'title_seeking_immortal']
const middlePool: EnemyId[] = ['clay_idol', 'coin_corpse', 'night_wandering_thrall', 'grave_crow_flock', 'headless_woodcutter']
const deepPool = [...earlyPool, ...middlePool]

function wavesFor(stageNumber: number) {
  const primary = primaryEnemies[stageNumber - 1]
  if (stageNumber <= 3) return [[primary]]
  const pool = stageNumber <= 10 ? earlyPool : stageNumber <= 20 ? middlePool : deepPool
  const other = (offset: number) => {
    const candidate = pool[(stageNumber + offset) % pool.length]
    return candidate === primary ? pool[(stageNumber + offset + 1) % pool.length] : candidate
  }
  if (stageNumber <= 20) return [[other(0)], stageNumber % 5 === 0 ? [primary] : [primary, other(2)]]
  if (stageNumber === 30) return [[other(0), other(2)], [other(3), other(5)], [primary]]
  return [[other(0)], [other(1), other(3)], [primary, other(5)]]
}

export const STAGES: StageDefinition[] = names.map((name, index) => {
  const stageNumber = index + 1
  const regionId: RegionId = stageNumber <= 10 ? 'mist_road' : stageNumber <= 20 ? 'ruined_waystation' : 'huai_roots'
  return {
    id: `stage_${String(stageNumber).padStart(3, '0')}`,
    stageNumber, name, regionId,
    recommendedTags: stageNumber <= 8 ? ['sword'] : stageNumber <= 14 ? ['talisman'] : ['spirit'],
    waves: wavesFor(stageNumber),
    firstClearReward: { cultivation: 20 + stageNumber * 5, spiritSand: 80 + stageNumber * 20 },
    repeatReward: { cultivation: 5 + stageNumber, spiritSand: 20 + stageNumber * 5 },
    unlockIds: unlocks[index], isRealmGate: stageNumber === 30,
    backgroundArtKey: regionId === 'mist_road' ? 'bg_huaiyin_road' : regionId === 'ruined_waystation' ? 'bg_huaiyin_waystation' : 'bg_huaiyin_roots',
  }
})

export function getStage(stageNumber: number) { return STAGES[Math.max(0, Math.min(29, stageNumber - 1))] }

export function getStageWaveEnemies(stage: StageDefinition, waveIndex: number): EnemyDefinition[] {
  const hpPercent = 100 + 8 * (stage.stageNumber - 1)
  const attackPercent = 100 + 5 * (stage.stageNumber - 1)
  const defenseBonus = 2 * Math.floor((stage.stageNumber - 1) / 3)
  return stage.waves[waveIndex].map((id) => {
    const base = PROTOTYPE_CONTENT.enemyDefinitions[id]
    return { ...base, maxHp: Math.floor(base.maxHp * hpPercent / 100), attack: Math.floor(base.attack * attackPercent / 100), defense: base.defense + defenseBonus }
  })
}
