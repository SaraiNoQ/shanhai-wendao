import { PROTOTYPE_CONTENT } from './prototype'
import type { Archetype, EnemyDefinition, EnemyId } from '../game/types'

export type ChapterId = 'mist_road' | 'ruined_waystation' | 'huai_roots'
export type RegionId = ChapterId

export interface ChapterDefinition {
  id: ChapterId
  name: string
  subtitle: string
  startStage: number
  endStage: number
  unlockAfterStage: number
  mapArtKey: string
}

export interface MapRouteSegment {
  fromStage: number
  toStage: number
  from: { x: number; y: number }
  to: { x: number; y: number }
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  { id: 'mist_road', name: '雾路', subtitle: '雾中寻迹', startStage: 1, endStage: 10, unlockAfterStage: 0, mapArtKey: 'map_mist_road' },
  { id: 'ruined_waystation', name: '废驿', subtitle: '残灯问魂', startStage: 11, endStage: 20, unlockAfterStage: 10, mapArtKey: 'map_ruined_waystation' },
  { id: 'huai_roots', name: '槐根深处', subtitle: '根下见真', startStage: 21, endStage: 30, unlockAfterStage: 20, mapArtKey: 'map_huai_roots' },
]

const CHAPTER_MAP_POSITIONS: Record<ChapterId, readonly { x: number; y: number }[]> = {
  mist_road: [
    { x: 8, y: 78 }, { x: 18, y: 67 }, { x: 29, y: 73 }, { x: 39, y: 58 }, { x: 50, y: 64 },
    { x: 60, y: 49 }, { x: 69, y: 54 }, { x: 78, y: 37 }, { x: 88, y: 43 }, { x: 92, y: 20 },
  ],
  ruined_waystation: [
    { x: 7, y: 55 }, { x: 17, y: 43 }, { x: 28, y: 50 }, { x: 37, y: 33 }, { x: 47, y: 41 },
    { x: 58, y: 26 }, { x: 67, y: 37 }, { x: 77, y: 24 }, { x: 86, y: 33 }, { x: 94, y: 16 },
  ],
  huai_roots: [
    { x: 8, y: 22 }, { x: 18, y: 34 }, { x: 29, y: 27 }, { x: 39, y: 44 }, { x: 50, y: 37 },
    { x: 60, y: 55 }, { x: 70, y: 48 }, { x: 79, y: 65 }, { x: 88, y: 58 }, { x: 94, y: 79 },
  ],
}

export function getChapter(chapterId: ChapterId) {
  return CHAPTERS.find((chapter) => chapter.id === chapterId) ?? CHAPTERS[0]
}

export function getChapterForStage(stageNumber: number) {
  return CHAPTERS.find((chapter) => stageNumber >= chapter.startStage && stageNumber <= chapter.endStage) ?? CHAPTERS[0]
}

export function getUnlockedChapters(campaign: { highestClearedStage: number }) {
  return CHAPTERS.filter((chapter) => campaign.highestClearedStage >= chapter.unlockAfterStage)
}

export function getChapterRouteSegments(chapter: ChapterDefinition): MapRouteSegment[] {
  const stages = STAGES.filter((stage) => stage.regionId === chapter.id)
  return stages.slice(1).map((stage, index) => ({
    fromStage: stages[index].stageNumber,
    toStage: stage.stageNumber,
    from: { ...stages[index].mapPosition },
    to: { ...stage.mapPosition },
  }))
}

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
  mapPosition: { x: number; y: number }
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
  if (stageNumber <= 20) return [[other(0)], stageNumber % 5 === 0 || stageNumber === 4 || stageNumber === 6 ? [primary] : [primary, other(2)]]
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
    mapPosition: { ...CHAPTER_MAP_POSITIONS[regionId][index % 10] },
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
