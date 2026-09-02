import { z } from 'zod'
import { AFFIXES, COLLECTION_BY_ID, EQUIPMENT, type AffixId, type CollectibleDefinition, type EssenceType, type EquipmentSlot } from '../content/collection'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import type { BuildId, CardId, ForgeTier, SpiritId, TechniqueId, WeaponId } from '../game/types'
import type { BattleReport, CampaignFailure, CampaignProgress, PendingOfflineSettlement } from '../game/campaign'
import type { TrialRun, TrialSettlement } from '../game/trial'
import { TRIAL_TILE_KINDS } from '../content/trial'
import { refineForgeItem, resetForgeItem } from './forging'
export { battleContentFromSave, receiveCollectible } from './player-rules'
export { breakthroughForgeItem, getForgeStatus, getForgeTier, isForgeReadOnly, refineForgeItem, resetForgeItem, type ForgeActionResult, type ForgeCost, type ForgeStatus } from './forging'
export type { ForgeTier } from '../game/types'

export const SAVE_KEY = 'shanhai_wendao_save'
export const BACKUP_SAVE_KEY = `${SAVE_KEY}_invalid_backup`
export const SAVE_VERSION = 5
const LEVEL_CAP = 10
const REROLL_COST = 40
const affixIds = Object.keys(AFFIXES) as AffixId[]

export interface PlayerSave {
  saveVersion: 5
  resources: { cultivation: number; spiritSand: number; daoEssence: number; spiritEssence: number; artifactEssence: number }
  ownedIds: string[]
  levels: Record<string, number>
  loadout: {
    buildId: BuildId; weaponId: WeaponId; techniqueId: TechniqueId; spiritIds: [SpiritId, SpiritId]; cardIds: [CardId, CardId, CardId, CardId, CardId, CardId]
    equipmentIds: [string, string, string, string]; treasureId: string; consumableIds: [string, string]; autoplayPriority: CardId[]
  }
  equipmentAffixes: Record<string, AffixId[]>
  forgeTiers: Partial<Record<string, ForgeTier>>
  pendingReroll?: { equipmentId: string; affixes: AffixId[] }
  rerollCount: number
  campaign: CampaignProgress
  realmId: 'qi_refining' | 'foundation_established'
  trialRun?: TrialRun
  pendingTrialSettlement?: TrialSettlement
  settledTrialSourceIds: string[]
  discoveredLoreIds: string[]
  readLoreIds: string[]
}

type LegacyPlayerSave = Omit<PlayerSave, 'saveVersion' | 'campaign' | 'realmId' | 'trialRun' | 'pendingTrialSettlement' | 'settledTrialSourceIds' | 'discoveredLoreIds' | 'readLoreIds' | 'forgeTiers'> & { saveVersion: 1 }
type V2PlayerSave = Omit<PlayerSave, 'saveVersion' | 'realmId' | 'trialRun' | 'pendingTrialSettlement' | 'settledTrialSourceIds' | 'discoveredLoreIds' | 'readLoreIds' | 'forgeTiers'> & { saveVersion: 2 }
type V3PlayerSave = Omit<PlayerSave, 'saveVersion' | 'realmId' | 'trialRun' | 'pendingTrialSettlement' | 'settledTrialSourceIds' | 'discoveredLoreIds' | 'readLoreIds' | 'forgeTiers'> & { saveVersion: 3 }
type V4PlayerSave = Omit<PlayerSave, 'saveVersion' | 'forgeTiers'> & { saveVersion: 4 }

const buildIds = Object.keys(PROTOTYPE_CONTENT.builds) as [BuildId, ...BuildId[]]
const weaponIds = Object.keys(PROTOTYPE_CONTENT.weapons) as [WeaponId, ...WeaponId[]]
const techniqueIds = Object.keys(PROTOTYPE_CONTENT.techniques) as [TechniqueId, ...TechniqueId[]]
const spiritIds = Object.keys(PROTOTYPE_CONTENT.spirits) as [SpiritId, ...SpiritId[]]
const cardIds = Object.keys(PROTOTYPE_CONTENT.cards) as [CardId, ...CardId[]]

const resourcesSchema = z.object({ cultivation: z.number().int().nonnegative(), spiritSand: z.number().int().nonnegative(), daoEssence: z.number().int().nonnegative(), spiritEssence: z.number().int().nonnegative(), artifactEssence: z.number().int().nonnegative() })
const forgeTiersSchema = z.record(z.string(), z.union([z.literal(1), z.literal(2)]))
const loadoutSchema = z.object({
  buildId: z.enum(buildIds), weaponId: z.enum(weaponIds), techniqueId: z.enum(techniqueIds),
  spiritIds: z.tuple([z.enum(spiritIds), z.enum(spiritIds)]), cardIds: z.tuple([z.enum(cardIds), z.enum(cardIds), z.enum(cardIds), z.enum(cardIds), z.enum(cardIds), z.enum(cardIds)]),
  equipmentIds: z.tuple([z.string(), z.string(), z.string(), z.string()]), treasureId: z.string(), consumableIds: z.tuple([z.string(), z.string()]), autoplayPriority: z.array(z.enum(cardIds)).length(6),
})
const reportSchema: z.ZodType<BattleReport> = z.object({ result: z.enum(['victory', 'defeat']), durationMs: z.number().int().nonnegative(), damageBySource: z.record(z.string(), z.number()), healingBySource: z.record(z.string(), z.number()), shieldBySource: z.record(z.string(), z.number()), actionsByUnit: z.record(z.string(), z.number()), comboCounts: z.record(z.string(), z.number()).optional().transform((value) => value ?? {}), failureReason: z.string().optional() }) as z.ZodType<BattleReport>
const campaignFailureSchema: z.ZodType<CampaignFailure> = z.object({ stageNumber: z.number().int().min(1).max(30), fallbackStage: z.number().int().min(0).max(30), reason: z.string(), battleSequence: z.number().int().nonnegative() })
const pendingSchema: z.ZodType<PendingOfflineSettlement> = z.object({
  reportId: z.string(), durationMs: z.number().int().nonnegative(), battles: z.number().int().nonnegative(), clearedStages: z.array(z.number().int().min(1).max(30)), failedStage: z.number().int().min(1).max(30).optional(), firstFailureReason: z.string().optional(),
  resourceDelta: resourcesSchema, newOwnedIds: z.array(z.string()),
  result: z.object({ highestClearedStage: z.number().int().min(0).max(30), stableStage: z.number().int().min(0).max(30), mode: z.enum(['advance', 'farm', 'paused']), battleSequence: z.number().int().nonnegative(), duplicateDropStreak: z.number().int().nonnegative(), trialUnlocked: z.boolean(), lastFailure: campaignFailureSchema.optional() }),
  rewardSourceIds: z.array(z.string()), contribution: reportSchema,
})
const campaignSchema: z.ZodType<CampaignProgress> = z.object({
  highestClearedStage: z.number().int().min(0).max(30), stableStage: z.number().int().min(0).max(30), mode: z.enum(['advance', 'farm', 'paused']), campaignSeed: z.number().int(), battleSequence: z.number().int().nonnegative(), duplicateDropStreak: z.number().int().nonnegative(), trialUnlocked: z.boolean(), lastActiveAtMs: z.number().int().nonnegative(), settledRewardSourceIds: z.array(z.string()), lastFailure: campaignFailureSchema.optional(), latestReport: reportSchema.optional(), pendingOfflineSettlement: pendingSchema.optional(),
})

const trialRunSchema = z.custom<TrialRun>((value) => {
  if (!value || typeof value !== 'object') return false
  const run = value as TrialRun
  if (!Array.isArray(run.grid) || !Array.isArray(run.cardInstances)) return false
  const cardCounts = new Map<string, number>()
  for (const card of run.cardInstances) cardCounts.set(card.cardId, (cardCounts.get(card.cardId) ?? 0) + 1)
  return run.grid.length === 26 && run.grid.every((tile) => tile.x >= 0 && tile.x < 7 && tile.y >= 0 && tile.y < 7 && (tile.kind === 'start' || TRIAL_TILE_KINDS.includes(tile.kind)))
    && new Set(run.grid.map((tile) => tile.id)).size === run.grid.length && run.grid.some((tile) => tile.id === run.positionTileId)
    && run.actionPoints >= 0 && run.actionPoints <= 22 && run.cardInstances.length >= 6 && run.cardInstances.length <= 12
    && [...cardCounts.values()].every((count) => count <= 2)
}, { message: '劫境存档结构无效' }).optional()
const trialSettlementSchema = z.custom<TrialSettlement>((value) => Boolean(value && typeof value === 'object' && typeof (value as TrialSettlement).sourceId === 'string' && Array.isArray((value as TrialSettlement).rewards) && Array.isArray((value as TrialSettlement).discoveredLoreIds)), { message: '劫境结算无效' }).optional()

const legacySaveSchema = z.object({
  saveVersion: z.literal(1),
  resources: resourcesSchema,
  ownedIds: z.array(z.string()).refine((ids) => ids.every((id) => id in COLLECTION_BY_ID)),
  levels: z.record(z.string(), z.number().int().min(1).max(LEVEL_CAP)),
  loadout: loadoutSchema,
  equipmentAffixes: z.record(z.string(), z.array(z.enum(affixIds as [AffixId, ...AffixId[]])).max(2)),
  pendingReroll: z.object({ equipmentId: z.string(), affixes: z.array(z.enum(affixIds as [AffixId, ...AffixId[]])).min(1).max(2) }).optional(),
  rerollCount: z.number().int().nonnegative(),
})

function validatePlayerShape(save: LegacyPlayerSave | V2PlayerSave | V3PlayerSave | V4PlayerSave | PlayerSave, context: z.RefinementCtx) {
  const owns = (id: string) => save.ownedIds.includes(id)
  const validEquipment = save.loadout.equipmentIds.every((id, index) => COLLECTION_BY_ID[id]?.slot === (['head', 'robe', 'feet', 'charm'] as EquipmentSlot[])[index] && owns(id))
  const validLoadout = validEquipment && COLLECTION_BY_ID[save.loadout.treasureId]?.category === 'treasure' && owns(save.loadout.treasureId)
    && save.loadout.consumableIds.every((id) => COLLECTION_BY_ID[id]?.category === 'consumable' && owns(id))
    && [save.loadout.weaponId, save.loadout.techniqueId, ...save.loadout.spiritIds, ...save.loadout.cardIds].every(owns)
  if (!validLoadout || new Set(save.loadout.equipmentIds).size !== 4 || new Set(save.loadout.consumableIds).size !== 2) context.addIssue({ code: 'custom', message: '配装包含未拥有、重复或错误类别的收藏' })
  if (Object.keys(save.levels).some((id) => !COLLECTION_BY_ID[id]) || Object.keys(save.equipmentAffixes).some((id) => COLLECTION_BY_ID[id]?.category !== 'equipment')) context.addIssue({ code: 'custom', message: '存档包含未知收藏' })
  const forgeTiers = 'forgeTiers' in save ? save.forgeTiers ?? {} : {}
  for (const [id, tier] of Object.entries(forgeTiers)) {
    const item = COLLECTION_BY_ID[id]
    const level = save.levels[id] ?? 1
    if (!item || (item.category !== 'weapon' && item.category !== 'equipment')) {
      context.addIssue({ code: 'custom', message: '熔炼记录包含未知或不可熔炼器物' })
      continue
    }
    if (!owns(id)) context.addIssue({ code: 'custom', message: '熔炼记录包含未拥有器物' })
    if (tier === 1 && level > 10) context.addIssue({ code: 'custom', message: '一阶器物等级越级' })
    if (tier === 2 && (level < 10 || level > 20)) context.addIssue({ code: 'custom', message: '二阶器物等级越级' })
  }
  for (const [id, level] of Object.entries(save.levels)) {
    const item = COLLECTION_BY_ID[id]
    const tier = forgeTiers[id] === 2 ? 2 : 1
    if (item && (item.category === 'weapon' || item.category === 'equipment') && level > (tier === 2 ? 20 : 10)) context.addIssue({ code: 'custom', message: '器物等级超过当前品阶上限' })
    if (item && item.category !== 'weapon' && item.category !== 'equipment' && level > 10) context.addIssue({ code: 'custom', message: '收藏等级超过上限' })
  }
}

const validatedLegacySaveSchema = legacySaveSchema.superRefine(validatePlayerShape)
const validatedV2SaveSchema = legacySaveSchema.extend({ saveVersion: z.literal(2), campaign: campaignSchema }).superRefine(validatePlayerShape)
const validatedV3SaveSchema = legacySaveSchema.extend({ saveVersion: z.literal(3), campaign: campaignSchema }).superRefine(validatePlayerShape)
const validatedV4SaveSchema = legacySaveSchema.extend({ saveVersion: z.literal(4), campaign: campaignSchema, realmId: z.enum(['qi_refining', 'foundation_established']), trialRun: trialRunSchema, pendingTrialSettlement: trialSettlementSchema, settledTrialSourceIds: z.array(z.string()), discoveredLoreIds: z.array(z.string()), readLoreIds: z.array(z.string()) }).superRefine(validatePlayerShape)
const saveSchema = legacySaveSchema.extend({ saveVersion: z.literal(5), levels: z.record(z.string(), z.number().int().min(1).max(20)), forgeTiers: forgeTiersSchema.default({}), campaign: campaignSchema, realmId: z.enum(['qi_refining', 'foundation_established']), trialRun: trialRunSchema, pendingTrialSettlement: trialSettlementSchema, settledTrialSourceIds: z.array(z.string()), discoveredLoreIds: z.array(z.string()), readLoreIds: z.array(z.string()) }).superRefine(validatePlayerShape)

function initialAffixes() {
  return Object.fromEntries(EQUIPMENT.map((equipment, index) => [equipment.id, affixIds.slice(index % 3, index % 3 + (equipment.affixSlots ?? 1))])) as Record<string, AffixId[]>
}

const starterIds = [
  'azure_wind_sword', 'hidden_edge_art', 'blade_tail_fox', 'iron_beak_crane',
  'guiding_edge', 'hidden_edge', 'returning_wind', 'armor_piercing_star', 'ten_thousand_blades', 'mountain_splitter',
  'equipment_green_bamboo_crown', 'equipment_wandering_cloud_robe', 'equipment_wind_chasing_shoes', 'equipment_hidden_edge_jade',
  'treasure_crescent_sword_case', 'consumable_spring_return_pill', 'consumable_spirit_gathering_pill',
]

function createCampaign(nowMs: number): CampaignProgress {
  return { highestClearedStage: 0, stableStage: 0, mode: 'advance', campaignSeed: 20_260_830, battleSequence: 0, duplicateDropStreak: 0, trialUnlocked: false, lastActiveAtMs: nowMs, settledRewardSourceIds: [] }
}

export function createPlayerSave(nowMs = 0): PlayerSave {
  const build = PROTOTYPE_CONTENT.builds[PROTOTYPE_CONTENT.defaultBuildId]
  return {
    saveVersion: SAVE_VERSION,
    resources: { cultivation: 0, spiritSand: 500, daoEssence: 30, spiritEssence: 20, artifactEssence: 30 },
    ownedIds: starterIds, levels: Object.fromEntries(starterIds.map((id) => [id, 1])),
    loadout: {
      buildId: build.id, weaponId: build.weaponId, techniqueId: build.techniqueId, spiritIds: [...build.spiritIds], cardIds: [...build.cardIds],
      equipmentIds: ['equipment_green_bamboo_crown', 'equipment_wandering_cloud_robe', 'equipment_wind_chasing_shoes', 'equipment_hidden_edge_jade'], treasureId: 'treasure_crescent_sword_case',
      consumableIds: ['consumable_spring_return_pill', 'consumable_spirit_gathering_pill'], autoplayPriority: [...build.cardIds],
    },
    equipmentAffixes: initialAffixes(), forgeTiers: {}, rerollCount: 0, campaign: createCampaign(nowMs), realmId: 'qi_refining', settledTrialSourceIds: [], discoveredLoreIds: [], readLoreIds: [],
  }
}

export function migrateSaveV1(save: LegacyPlayerSave, nowMs: number): PlayerSave {
  return { ...save, saveVersion: 5, forgeTiers: {}, campaign: createCampaign(nowMs), realmId: 'qi_refining', settledTrialSourceIds: [], discoveredLoreIds: [], readLoreIds: [] }
}

export function migrateSaveV2(save: V2PlayerSave): PlayerSave {
  return { ...save, saveVersion: 5, forgeTiers: {}, realmId: 'qi_refining', settledTrialSourceIds: [], discoveredLoreIds: [], readLoreIds: [] }
}

export function migrateSaveV3(save: V3PlayerSave): PlayerSave {
  return { ...save, saveVersion: 5, forgeTiers: {}, realmId: 'qi_refining', settledTrialSourceIds: [], discoveredLoreIds: [], readLoreIds: [] }
}

export function migrateSaveV4(save: V4PlayerSave): PlayerSave {
  return { ...save, saveVersion: 5, forgeTiers: {} }
}

export function parseSave(text: string, nowMs = 0) {
  try {
    const raw = JSON.parse(text)
    const current = saveSchema.safeParse(raw)
    if (current.success) return current
    const v4 = validatedV4SaveSchema.safeParse(raw)
    if (v4.success) return saveSchema.safeParse(migrateSaveV4(v4.data))
    const v3 = validatedV3SaveSchema.safeParse(raw)
    if (v3.success) return saveSchema.safeParse(migrateSaveV3(v3.data))
    const v2 = validatedV2SaveSchema.safeParse(raw)
    if (v2.success) return saveSchema.safeParse(migrateSaveV2(v2.data))
    const legacy = validatedLegacySaveSchema.safeParse(raw)
    return legacy.success ? saveSchema.safeParse(migrateSaveV1(legacy.data, nowMs)) : current
  } catch { return saveSchema.safeParse(undefined) }
}

export function loadPlayerSave(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage, nowMs = Date.now()): PlayerSave {
  const raw = storage.getItem(SAVE_KEY)
  if (!raw) return createPlayerSave(nowMs)
  const parsed = parseSave(raw, nowMs)
  if (parsed.success) return parsed.data
  storage.setItem(BACKUP_SAVE_KEY, raw)
  return createPlayerSave(nowMs)
}

export function storePlayerSave(save: PlayerSave, storage: Pick<Storage, 'setItem'> = localStorage) { storage.setItem(SAVE_KEY, JSON.stringify(save)) }

export function upgradeCost(item: CollectibleDefinition, level: number) {
  return { spiritSand: level * 100, essenceType: item.essenceType, essence: level * 10 }
}

export function upgrade(save: PlayerSave, id: string): PlayerSave {
  const item = COLLECTION_BY_ID[id]
  const level = save.levels[id] ?? 1
  if (!item) return save
  if (item.category === 'weapon' || item.category === 'equipment') return refineForgeItem(save, id).save
  if (level >= LEVEL_CAP) return save
  const cost = upgradeCost(item, level)
  if (save.resources.spiritSand < cost.spiritSand || save.resources[cost.essenceType] < cost.essence) return save
  return { ...save, resources: { ...save.resources, spiritSand: save.resources.spiritSand - cost.spiritSand, [cost.essenceType]: save.resources[cost.essenceType] - cost.essence }, levels: { ...save.levels, [id]: level + 1 } }
}

export function resetLevel(save: PlayerSave, id: string): PlayerSave {
  const item = COLLECTION_BY_ID[id]
  const level = save.levels[id] ?? 1
  if (!item) return save
  if (item.category === 'weapon' || item.category === 'equipment') return resetForgeItem(save, id).save
  if (level === 1) return save
  let spiritSand = 0
  let essence = 0
  for (let paidAt = 1; paidAt < level; paidAt += 1) { spiritSand += paidAt * 100; essence += paidAt * 10 }
  return { ...save, resources: { ...save.resources, spiritSand: save.resources.spiritSand + spiritSand, [item.essenceType]: save.resources[item.essenceType] + essence }, levels: { ...save.levels, [id]: 1 } }
}

export function equipBuild(save: PlayerSave, buildId: BuildId): PlayerSave {
  const build = PROTOTYPE_CONTENT.builds[buildId]
  if (!canEquipBuild(save, buildId)) return save
  return { ...save, loadout: { ...save.loadout, buildId, weaponId: build.weaponId, techniqueId: build.techniqueId, spiritIds: [...build.spiritIds], cardIds: [...build.cardIds], autoplayPriority: [...build.cardIds] } }
}

export function canEquipBuild(save: PlayerSave, buildId: BuildId) {
  const build = PROTOTYPE_CONTENT.builds[buildId]
  return [build.weaponId, build.techniqueId, ...build.spiritIds, ...build.cardIds].every((id) => save.ownedIds.includes(id))
}

export function equipItem(save: PlayerSave, slot: EquipmentSlot | 'treasure' | 'consumable_0' | 'consumable_1', id: string): PlayerSave {
  if (!save.ownedIds.includes(id)) return save
  const loadout = { ...save.loadout, equipmentIds: [...save.loadout.equipmentIds] as PlayerSave['loadout']['equipmentIds'], consumableIds: [...save.loadout.consumableIds] as PlayerSave['loadout']['consumableIds'] }
  if (slot === 'treasure') loadout.treasureId = id
  else if (slot.startsWith('consumable_')) loadout.consumableIds[Number(slot.at(-1))] = id
  else loadout.equipmentIds[{ head: 0, robe: 1, feet: 2, charm: 3 }[slot as EquipmentSlot]] = id
  return { ...save, loadout }
}

export function previewReroll(save: PlayerSave, equipmentId: string): PlayerSave {
  const item = COLLECTION_BY_ID[equipmentId]
  if (!item?.affixSlots || save.resources.artifactEssence < REROLL_COST) return save
  const affixes: AffixId[] = []
  for (let index = 0; index < item.affixSlots; index += 1) {
    let candidate = affixIds[(save.rerollCount * 3 + index * 5 + equipmentId.length) % affixIds.length]
    while (affixes.includes(candidate)) candidate = affixIds[(affixIds.indexOf(candidate) + 1) % affixIds.length]
    affixes.push(candidate)
  }
  return { ...save, resources: { ...save.resources, artifactEssence: save.resources.artifactEssence - REROLL_COST }, pendingReroll: { equipmentId, affixes }, rerollCount: save.rerollCount + 1 }
}

export function resolveReroll(save: PlayerSave, accept: boolean): PlayerSave {
  if (!save.pendingReroll) return save
  const next = accept ? { ...save.equipmentAffixes, [save.pendingReroll.equipmentId]: [...save.pendingReroll.affixes] } : save.equipmentAffixes
  const { pendingReroll: _ignored, ...rest } = save
  return { ...rest, equipmentAffixes: next }
}

export function attachOfflineSettlement(save: PlayerSave, settlement: PendingOfflineSettlement, nowMs: number): PlayerSave {
  return { ...save, campaign: { ...save.campaign, lastActiveAtMs: nowMs, pendingOfflineSettlement: settlement } }
}

export function attachTrialRun(save: PlayerSave, trialRun: TrialRun): PlayerSave {
  return { ...save, trialRun, campaign: { ...save.campaign, mode: 'paused' } }
}

export function attachTrialSettlement(save: PlayerSave, settlement: TrialSettlement): PlayerSave {
  return { ...save, pendingTrialSettlement: settlement, trialRun: undefined, campaign: { ...save.campaign, mode: 'paused' } }
}

export function claimTrialSettlement(save: PlayerSave, nowMs = Date.now()): PlayerSave {
  const settlement = save.pendingTrialSettlement
  if (!settlement || save.settledTrialSourceIds.includes(settlement.sourceId)) return save
  let resources = { ...save.resources, spiritSand: Math.max(0, save.resources.spiritSand - settlement.resourceSpent.spiritSand), artifactEssence: Math.max(0, save.resources.artifactEssence - settlement.resourceSpent.artifactEssence) }
  const ownedIds = new Set(save.ownedIds)
  const discoveredLoreIds = new Set(save.discoveredLoreIds)
  for (const id of settlement.discoveredLoreIds) discoveredLoreIds.add(id)
  for (const reward of settlement.rewards) {
    if (reward.resource === 'cultivation') resources.cultivation += reward.amount ?? 0
    if (reward.resource === 'spiritSand') resources.spiritSand += reward.amount ?? 0
    if (reward.resource === 'artifactEssence') resources.artifactEssence += reward.amount ?? 0
    if (reward.kind === 'lore' && reward.loreId) discoveredLoreIds.add(reward.loreId)
    if (reward.kind === 'card' && reward.cardId && COLLECTION_BY_ID[reward.cardId]) ownedIds.add(reward.cardId)
  }
  return { ...save, resources, ownedIds: [...ownedIds], discoveredLoreIds: [...discoveredLoreIds], pendingTrialSettlement: undefined, trialRun: undefined, realmId: settlement.result === 'success' ? 'foundation_established' : save.realmId, settledTrialSourceIds: [...save.settledTrialSourceIds, settlement.sourceId], campaign: { ...save.campaign, mode: 'paused', lastActiveAtMs: nowMs } }
}

export function markLoreRead(save: PlayerSave, loreId: string): PlayerSave {
  if (!save.discoveredLoreIds.includes(loreId) || save.readLoreIds.includes(loreId)) return save
  return { ...save, readLoreIds: [...save.readLoreIds, loreId] }
}

export function claimOfflineSettlement(save: PlayerSave, nowMs: number): PlayerSave {
  const pending = save.campaign.pendingOfflineSettlement
  if (!pending || save.campaign.settledRewardSourceIds.includes(pending.reportId)) return save
  const levels = { ...save.levels }
  for (const id of pending.newOwnedIds) levels[id] ??= 1
  return {
    ...save,
    ownedIds: [...new Set([...save.ownedIds, ...pending.newOwnedIds])], levels,
    resources: {
      cultivation: save.resources.cultivation + pending.resourceDelta.cultivation,
      spiritSand: save.resources.spiritSand + pending.resourceDelta.spiritSand,
      daoEssence: save.resources.daoEssence + pending.resourceDelta.daoEssence,
      spiritEssence: save.resources.spiritEssence + pending.resourceDelta.spiritEssence,
      artifactEssence: save.resources.artifactEssence + pending.resourceDelta.artifactEssence,
    },
    campaign: { ...save.campaign, ...pending.result, lastFailure: pending.result.lastFailure, lastActiveAtMs: nowMs, latestReport: pending.contribution, settledRewardSourceIds: [...new Set([...save.campaign.settledRewardSourceIds, ...pending.rewardSourceIds, pending.reportId])], pendingOfflineSettlement: undefined },
  }
}

export function markActive(save: PlayerSave, nowMs: number): PlayerSave { return { ...save, campaign: { ...save.campaign, lastActiveAtMs: Math.max(save.campaign.lastActiveAtMs, nowMs) } } }

export const ESSENCE_NAMES: Record<EssenceType, string> = { daoEssence: '道法精华', spiritEssence: '万灵精华', artifactEssence: '器华' }
export const REROLL_ESSENCE_COST = REROLL_COST
