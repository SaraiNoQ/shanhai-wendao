import type { ForgeTier } from '../game/types'

export type { ForgeTier } from '../game/types'

export type ForgeableCategory = 'weapon' | 'equipment'

export interface ForgeNodeDefinition {
  id: string
  category: ForgeableCategory
  params: Readonly<Record<string, number | string | boolean>>
  description: string
}

/** The single source of truth for every second-tier effect. */
export const FORGE_NODES = {
  azure_wind_sword: { id: 'azure_wind_sword', category: 'weapon', params: { attackEvery: 3 }, description: '基础攻击每 3 次获得剑意。' },
  cinnabar_brush: { id: 'cinnabar_brush', category: 'weapon', params: { extendMs: 1_500 }, description: '符印命中延长 1.5 秒。' },
  spirit_bell: { id: 'spirit_bell', category: 'weapon', params: { openingSpiritBond: 1 }, description: '两只妖灵开场各获得 1 点灵契。' },
  equipment_green_bamboo_crown: { id: 'equipment_green_bamboo_crown', category: 'equipment', params: { cards: 2 }, description: '每 2 张剑式牌获得 1 点剑意。' },
  equipment_cinnabar_crown: { id: 'equipment_cinnabar_crown', category: 'equipment', params: { marks: 2 }, description: '首次贴符额外增加 2 层符印。' },
  equipment_hundred_beast_circlet: { id: 'equipment_hundred_beast_circlet', category: 'equipment', params: { firstComboPowerPercent: 20 }, description: '每只妖灵首次协击伤害提高 20%。' },
  equipment_wandering_cloud_robe: { id: 'equipment_wandering_cloud_robe', category: 'equipment', params: { shield: 16 }, description: '首张牌基础护盾提高至 16。' },
  equipment_talisman_silk_robe: { id: 'equipment_talisman_silk_robe', category: 'equipment', params: { shieldPerMark: 3 }, description: '每层引爆符印的护盾提高至 3。' },
  equipment_mountain_lord_pelt: { id: 'equipment_mountain_lord_pelt', category: 'equipment', params: { shield: 12 }, description: '协击后的基础护盾提高至 12。' },
  equipment_wind_chasing_shoes: { id: 'equipment_wind_chasing_shoes', category: 'equipment', params: { discount: 2 }, description: '首张同标签牌减费提高至 2。' },
  equipment_star_treading_shoes: { id: 'equipment_star_treading_shoes', category: 'equipment', params: { cards: 2 }, description: '连续 2 张符法牌后恢复灵力。' },
  equipment_tracking_straw_sandals: { id: 'equipment_tracking_straw_sandals', category: 'equipment', params: { powerPercent: 40 }, description: '妖灵轮流行动追加伤害提高至 40%。' },
  equipment_hidden_edge_jade: { id: 'equipment_hidden_edge_jade', category: 'equipment', params: { swordIntentCap: 14, finisherPercent: 115 }, description: '剑意上限提高至 14，终结倍率增幅提高至 115%。' },
  equipment_thunder_coin: { id: 'equipment_thunder_coin', category: 'equipment', params: { burstPercent: 115, burnPerOverflow: 2 }, description: '引爆倍率提高至 115%，每层过量符印转化 2 层灼烧。' },
  equipment_paired_bronze_bell: { id: 'equipment_paired_bronze_bell', category: 'equipment', params: { windowMs: 6_000 }, description: '妖灵轮流行动判定窗口延长至 6 秒。' },
} satisfies Record<string, ForgeNodeDefinition>

/** Explicit aliases keep content consumers on the same shared definition. */
export const FORGE_NODE_DEFINITIONS = FORGE_NODES
export const FORGING_CONTENT = FORGE_NODES

export const FORGEABLE_IDS = Object.freeze(Object.keys(FORGE_NODES))
export const FORGE_TIER_CAPS: Record<ForgeTier, 10 | 20> = { 1: 10, 2: 20 }

export const WEAPON_BREAKTHROUGH_COST = Object.freeze({ spiritSand: 1_000, artifactEssence: 100 })
export const EQUIPMENT_BREAKTHROUGH_COSTS = Object.freeze({ common: { spiritSand: 600, artifactEssence: 60 }, uncommon: { spiritSand: 800, artifactEssence: 80 }, rare: { spiritSand: 1_000, artifactEssence: 100 }, legacy: { spiritSand: 1_200, artifactEssence: 120 } })

export function getTieredEffectParams(id: string, baseParams: Readonly<Record<string, number | string | boolean>> = {}, tier: ForgeTier = 1) {
  const node = (FORGE_NODES as Record<string, { params: Readonly<Record<string, number | string | boolean>> }>)[id]
  return tier === 2 && node ? { ...baseParams, ...node.params } : { ...baseParams }
}
