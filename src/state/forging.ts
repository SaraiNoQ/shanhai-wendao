import { EQUIPMENT_BREAKTHROUGH_COSTS, FORGE_TIER_CAPS, WEAPON_BREAKTHROUGH_COST, getTieredEffectParams } from '../content/forging'
import { COLLECTION_BY_ID } from '../content/collection'
import type { ForgeTier } from '../game/types'
import type { PlayerSave } from './player'

export type ForgeCost = { spiritSand: number; artifactEssence: number }

export interface ForgeActionResult {
  save: PlayerSave
  changed: boolean
  error?: string
}

export interface ForgeStatus {
  tier: ForgeTier
  level: number
  levelCap: 10 | 20
  refineCost?: ForgeCost
  breakthroughCost?: ForgeCost
  canRefine: boolean
  canBreakthrough: boolean
  reason?: string
}

const FORGEABLE_CATEGORIES = new Set(['weapon', 'equipment'])

export function getForgeTier(save: PlayerSave, id: string): ForgeTier {
  return isForgeable(id) && save.forgeTiers?.[id] === 2 ? 2 : 1
}

export function isForgeReadOnly(save: PlayerSave) {
  return Boolean(save.trialRun || save.pendingTrialSettlement || save.campaign.pendingOfflineSettlement)
}

export const isPlayerSaveReadOnly = isForgeReadOnly

function isForgeable(id: string) {
  const item = COLLECTION_BY_ID[id]
  return item && FORGEABLE_CATEGORIES.has(item.category)
}

function breakthroughCost(id: string): ForgeCost | undefined {
  const item = COLLECTION_BY_ID[id]
  if (!item || !FORGEABLE_CATEGORIES.has(item.category)) return undefined
  if (item.category === 'weapon') return { ...WEAPON_BREAKTHROUGH_COST }
  return { ...(EQUIPMENT_BREAKTHROUGH_COSTS[item.rarity] ?? EQUIPMENT_BREAKTHROUGH_COSTS.common) }
}

function refineCost(level: number): ForgeCost {
  return { spiritSand: level * 100, artifactEssence: level * 10 }
}

function hasCost(save: PlayerSave, cost: ForgeCost) {
  return save.resources.spiritSand >= cost.spiritSand && save.resources.artifactEssence >= cost.artifactEssence
}

export function getForgeStatus(save: PlayerSave, id: string): ForgeStatus {
  const tier = getForgeTier(save, id)
  const item = COLLECTION_BY_ID[id]
  const level = save.levels[id] ?? 1
  const levelCap = FORGE_TIER_CAPS[tier]
  const nextRefineCost = level < levelCap ? refineCost(level) : undefined
  const itemBreakthroughCost = breakthroughCost(id)
  const nextBreakthroughCost = tier === 1 ? itemBreakthroughCost : undefined
  let canRefine = false
  let canBreakthrough = false
  let reason: string | undefined

  if (!item || !FORGEABLE_CATEGORIES.has(item.category)) reason = '只有武器和装备可以熔炼。'
  else if (!save.ownedIds.includes(id)) reason = '尚未拥有该器物。'
  else if (isForgeReadOnly(save)) reason = '当前状态只读，结束劫境并领取结算后可操作。'
  else if (tier === 2) {
    canRefine = Boolean(nextRefineCost && hasCost(save, nextRefineCost))
    if (!nextRefineCost) reason = '已达二阶等级上限。'
    else if (!canRefine) reason = '精炼材料不足。'
  } else {
    canRefine = Boolean(nextRefineCost && hasCost(save, nextRefineCost))
    if (level >= 10) {
      canBreakthrough = Boolean(nextBreakthroughCost && save.realmId === 'foundation_established' && hasCost(save, nextBreakthroughCost))
      if (save.realmId !== 'foundation_established') reason = '突破需要先完成筑基。'
      else if (!canBreakthrough) reason = '突破材料不足。'
    } else if (!canRefine) reason = '精炼材料不足。'
  }

  return { tier, level, levelCap, refineCost: nextRefineCost, breakthroughCost: itemBreakthroughCost, canRefine, canBreakthrough, reason }
}

function failed(save: PlayerSave, status: ForgeStatus, fallback: string): ForgeActionResult {
  return { save, changed: false, error: status.reason ?? fallback }
}

export function refineForgeItem(save: PlayerSave, id: string): ForgeActionResult {
  const status = getForgeStatus(save, id)
  if (!status.canRefine || !status.refineCost) return failed(save, status, '当前无法精炼。')
  const cost = status.refineCost
  return {
    save: {
      ...save,
      resources: { ...save.resources, spiritSand: save.resources.spiritSand - cost.spiritSand, artifactEssence: save.resources.artifactEssence - cost.artifactEssence },
      levels: { ...save.levels, [id]: status.level + 1 },
    },
    changed: true,
  }
}

export function breakthroughForgeItem(save: PlayerSave, id: string): ForgeActionResult {
  const status = getForgeStatus(save, id)
  if (!status.canBreakthrough || !status.breakthroughCost) return failed(save, status, '当前无法突破。')
  const cost = status.breakthroughCost
  return {
    save: {
      ...save,
      resources: { ...save.resources, spiritSand: save.resources.spiritSand - cost.spiritSand, artifactEssence: save.resources.artifactEssence - cost.artifactEssence },
      forgeTiers: { ...save.forgeTiers, [id]: 2 },
    },
    changed: true,
  }
}

export function resetForgeItem(save: PlayerSave, id: string): ForgeActionResult {
  const status = getForgeStatus(save, id)
  if (!isForgeable(id)) return failed(save, status, '只有武器和装备可以熔炼。')
  if (!save.ownedIds.includes(id)) return failed(save, status, '尚未拥有该器物。')
  if (isForgeReadOnly(save)) return failed(save, status, '当前状态只读，结束劫境并领取结算后可操作。')
  if (status.level === 1 && status.tier === 1) return { save, changed: false, error: '当前已是凡器 Lv.1。' }

  let refund = { spiritSand: 0, artifactEssence: 0 }
  for (let level = 1; level < status.level; level += 1) {
    refund.spiritSand += level * 100
    refund.artifactEssence += level * 10
  }
  if (status.tier === 2) {
    const cost = status.breakthroughCost ?? breakthroughCost(id)!
    refund.spiritSand += cost.spiritSand
    refund.artifactEssence += cost.artifactEssence
  }
  return {
    save: {
      ...save,
      resources: { ...save.resources, spiritSand: save.resources.spiritSand + refund.spiritSand, artifactEssence: save.resources.artifactEssence + refund.artifactEssence },
      levels: { ...save.levels, [id]: 1 },
      forgeTiers: { ...save.forgeTiers, [id]: 1 },
    },
    changed: true,
  }
}

// Keep the content-facing type available from the state module too.
export { getTieredEffectParams }
export type { ForgeTier }
