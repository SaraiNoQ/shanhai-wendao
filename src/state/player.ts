import { z } from 'zod'
import { AFFIXES, COLLECTION_BY_ID, EQUIPMENT, type AffixId, type CollectibleDefinition, type EssenceType, type EquipmentSlot } from '../content/collection'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import type { BattleContent, BuildId, CardId, SpiritId, TechniqueId, WeaponId } from '../game/types'
import type { BattleReport, CampaignProgress, PendingOfflineSettlement } from '../game/campaign'

export const SAVE_KEY = 'shanhai_wendao_save'
export const BACKUP_SAVE_KEY = `${SAVE_KEY}_invalid_backup`
export const SAVE_VERSION = 2
const LEVEL_CAP = 10
const REROLL_COST = 40
const affixIds = Object.keys(AFFIXES) as AffixId[]

export interface PlayerSave {
  saveVersion: 2
  resources: { cultivation: number; spiritSand: number; daoEssence: number; spiritEssence: number; artifactEssence: number }
  ownedIds: string[]
  levels: Record<string, number>
  loadout: {
    buildId: BuildId; weaponId: WeaponId; techniqueId: TechniqueId; spiritIds: [SpiritId, SpiritId]; cardIds: [CardId, CardId, CardId, CardId, CardId, CardId]
    equipmentIds: [string, string, string, string]; treasureId: string; consumableIds: [string, string]; autoplayPriority: CardId[]
  }
  equipmentAffixes: Record<string, AffixId[]>
  pendingReroll?: { equipmentId: string; affixes: AffixId[] }
  rerollCount: number
  campaign: CampaignProgress
}

type LegacyPlayerSave = Omit<PlayerSave, 'saveVersion' | 'campaign'> & { saveVersion: 1 }

const buildIds = Object.keys(PROTOTYPE_CONTENT.builds) as [BuildId, ...BuildId[]]
const weaponIds = Object.keys(PROTOTYPE_CONTENT.weapons) as [WeaponId, ...WeaponId[]]
const techniqueIds = Object.keys(PROTOTYPE_CONTENT.techniques) as [TechniqueId, ...TechniqueId[]]
const spiritIds = Object.keys(PROTOTYPE_CONTENT.spirits) as [SpiritId, ...SpiritId[]]
const cardIds = Object.keys(PROTOTYPE_CONTENT.cards) as [CardId, ...CardId[]]

const resourcesSchema = z.object({ cultivation: z.number().int().nonnegative(), spiritSand: z.number().int().nonnegative(), daoEssence: z.number().int().nonnegative(), spiritEssence: z.number().int().nonnegative(), artifactEssence: z.number().int().nonnegative() })
const loadoutSchema = z.object({
  buildId: z.enum(buildIds), weaponId: z.enum(weaponIds), techniqueId: z.enum(techniqueIds),
  spiritIds: z.tuple([z.enum(spiritIds), z.enum(spiritIds)]), cardIds: z.tuple([z.enum(cardIds), z.enum(cardIds), z.enum(cardIds), z.enum(cardIds), z.enum(cardIds), z.enum(cardIds)]),
  equipmentIds: z.tuple([z.string(), z.string(), z.string(), z.string()]), treasureId: z.string(), consumableIds: z.tuple([z.string(), z.string()]), autoplayPriority: z.array(z.enum(cardIds)).length(6),
})
const reportSchema: z.ZodType<BattleReport> = z.object({ result: z.enum(['victory', 'defeat']), durationMs: z.number().int().nonnegative(), damageBySource: z.record(z.string(), z.number()), healingBySource: z.record(z.string(), z.number()), shieldBySource: z.record(z.string(), z.number()), actionsByUnit: z.record(z.string(), z.number()), comboCounts: z.record(z.string(), z.number()).optional().transform((value) => value ?? {}), failureReason: z.string().optional() }) as z.ZodType<BattleReport>
const pendingSchema: z.ZodType<PendingOfflineSettlement> = z.object({
  reportId: z.string(), durationMs: z.number().int().nonnegative(), battles: z.number().int().nonnegative(), clearedStages: z.array(z.number().int().min(1).max(30)), failedStage: z.number().int().min(1).max(30).optional(), firstFailureReason: z.string().optional(),
  resourceDelta: resourcesSchema, newOwnedIds: z.array(z.string()),
  result: z.object({ highestClearedStage: z.number().int().min(0).max(30), stableStage: z.number().int().min(0).max(30), mode: z.enum(['advance', 'farm', 'paused']), battleSequence: z.number().int().nonnegative(), duplicateDropStreak: z.number().int().nonnegative(), trialUnlocked: z.boolean() }),
  rewardSourceIds: z.array(z.string()), contribution: reportSchema,
})
const campaignSchema: z.ZodType<CampaignProgress> = z.object({
  highestClearedStage: z.number().int().min(0).max(30), stableStage: z.number().int().min(0).max(30), mode: z.enum(['advance', 'farm', 'paused']), campaignSeed: z.number().int(), battleSequence: z.number().int().nonnegative(), duplicateDropStreak: z.number().int().nonnegative(), trialUnlocked: z.boolean(), lastActiveAtMs: z.number().int().nonnegative(), settledRewardSourceIds: z.array(z.string()), latestReport: reportSchema.optional(), pendingOfflineSettlement: pendingSchema.optional(),
})

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

function validatePlayerShape(save: LegacyPlayerSave | PlayerSave, context: z.RefinementCtx) {
  const owns = (id: string) => save.ownedIds.includes(id)
  const validEquipment = save.loadout.equipmentIds.every((id, index) => COLLECTION_BY_ID[id]?.slot === (['head', 'robe', 'feet', 'charm'] as EquipmentSlot[])[index] && owns(id))
  const validLoadout = validEquipment && COLLECTION_BY_ID[save.loadout.treasureId]?.category === 'treasure' && owns(save.loadout.treasureId)
    && save.loadout.consumableIds.every((id) => COLLECTION_BY_ID[id]?.category === 'consumable' && owns(id))
    && [save.loadout.weaponId, save.loadout.techniqueId, ...save.loadout.spiritIds, ...save.loadout.cardIds].every(owns)
  if (!validLoadout || new Set(save.loadout.equipmentIds).size !== 4 || new Set(save.loadout.consumableIds).size !== 2) context.addIssue({ code: 'custom', message: '配装包含未拥有、重复或错误类别的收藏' })
  if (Object.keys(save.levels).some((id) => !COLLECTION_BY_ID[id]) || Object.keys(save.equipmentAffixes).some((id) => COLLECTION_BY_ID[id]?.category !== 'equipment')) context.addIssue({ code: 'custom', message: '存档包含未知收藏' })
}

const validatedLegacySaveSchema = legacySaveSchema.superRefine(validatePlayerShape)
const saveSchema = legacySaveSchema.extend({ saveVersion: z.literal(2), campaign: campaignSchema }).superRefine(validatePlayerShape)

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
    equipmentAffixes: initialAffixes(), rerollCount: 0, campaign: createCampaign(nowMs),
  }
}

export function migrateSaveV1(save: LegacyPlayerSave, nowMs: number): PlayerSave {
  return { ...save, saveVersion: 2, campaign: createCampaign(nowMs) }
}

export function parseSave(text: string, nowMs = 0) {
  try {
    const raw = JSON.parse(text)
    const current = saveSchema.safeParse(raw)
    if (current.success) return current
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
  if (!item || level >= LEVEL_CAP) return save
  const cost = upgradeCost(item, level)
  if (save.resources.spiritSand < cost.spiritSand || save.resources[cost.essenceType] < cost.essence) return save
  return { ...save, resources: { ...save.resources, spiritSand: save.resources.spiritSand - cost.spiritSand, [cost.essenceType]: save.resources[cost.essenceType] - cost.essence }, levels: { ...save.levels, [id]: level + 1 } }
}

export function resetLevel(save: PlayerSave, id: string): PlayerSave {
  const item = COLLECTION_BY_ID[id]
  const level = save.levels[id] ?? 1
  if (!item || level === 1) return save
  let spiritSand = 0
  let essence = 0
  for (let paidAt = 1; paidAt < level; paidAt += 1) { spiritSand += paidAt * 100; essence += paidAt * 10 }
  return { ...save, resources: { ...save.resources, spiritSand: save.resources.spiritSand + spiritSand, [item.essenceType]: save.resources[item.essenceType] + essence }, levels: { ...save.levels, [id]: 1 } }
}

export function receiveCollectible(save: PlayerSave, id: string): PlayerSave {
  const item = COLLECTION_BY_ID[id]
  if (!item) return save
  if (!save.ownedIds.includes(id)) return { ...save, ownedIds: [...save.ownedIds, id], levels: { ...save.levels, [id]: 1 } }
  return { ...save, resources: { ...save.resources, [item.essenceType]: save.resources[item.essenceType] + item.duplicateEssence } }
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

export function battleContentFromSave(save: PlayerSave): BattleContent {
  const loadout = save.loadout
  const equipment = loadout.equipmentIds.map((id) => COLLECTION_BY_ID[id])
  const equippedAffixes = loadout.equipmentIds.flatMap((id) => save.equipmentAffixes[id] ?? [])
  const equipmentLevels = equipment.reduce((total, value) => total + (save.levels[value.id] ?? 1) - 1, 0)
  const maxHp = equippedAffixes.filter((id) => id === 'max_hp').length * AFFIXES.max_hp.value + equipmentLevels * 2
  const attack = equippedAffixes.filter((id) => id === 'attack').length * AFFIXES.attack.value + ((save.levels[loadout.weaponId] ?? 1) - 1) * 2
  const defense = equippedAffixes.filter((id) => id === 'defense').length * AFFIXES.defense.value + equipmentLevels + Math.floor(((save.levels[loadout.techniqueId] ?? 1) - 1) / 2)
  const spirits = { ...PROTOTYPE_CONTENT.spirits }
  loadout.spiritIds.forEach((id) => {
    const level = save.levels[id] ?? 1
    const base = spirits[id]
    spirits[id] = { ...base, maxHp: base.maxHp + (level - 1) * 4, attack: base.attack + (level - 1) * 2, defense: base.defense + level - 1 }
  })
  const cards = Object.fromEntries(Object.entries(PROTOTYPE_CONTENT.cards).map(([id, card]) => {
    const multiplier = 100 + ((save.levels[id] ?? 1) - 1) * 5
    const scaled = (value: number | undefined) => value === undefined ? undefined : Math.floor(value * multiplier / 100)
    return [id, { ...card, powerPercent: scaled(card.powerPercent), shield: scaled(card.shield), heal: scaled(card.heal) }]
  })) as BattleContent['cards']
  return {
    ...PROTOTYPE_CONTENT,
    leader: { ...PROTOTYPE_CONTENT.leader, maxHp: PROTOTYPE_CONTENT.leader.maxHp + maxHp, attack: PROTOTYPE_CONTENT.leader.attack + attack, defense: PROTOTYPE_CONTENT.leader.defense + defense },
    spirits,
    cards,
    builds: { ...PROTOTYPE_CONTENT.builds, [loadout.buildId]: { ...PROTOTYPE_CONTENT.builds[loadout.buildId], weaponId: loadout.weaponId, techniqueId: loadout.techniqueId, spiritIds: loadout.spiritIds, cardIds: loadout.cardIds, autoplayPriority: loadout.autoplayPriority } },
  }
}

export function attachOfflineSettlement(save: PlayerSave, settlement: PendingOfflineSettlement, nowMs: number): PlayerSave {
  return { ...save, campaign: { ...save.campaign, lastActiveAtMs: nowMs, pendingOfflineSettlement: settlement } }
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
    campaign: { ...save.campaign, ...pending.result, lastActiveAtMs: nowMs, latestReport: pending.contribution, settledRewardSourceIds: [...new Set([...save.campaign.settledRewardSourceIds, ...pending.rewardSourceIds, pending.reportId])], pendingOfflineSettlement: undefined },
  }
}

export function markActive(save: PlayerSave, nowMs: number): PlayerSave { return { ...save, campaign: { ...save.campaign, lastActiveAtMs: Math.max(save.campaign.lastActiveAtMs, nowMs) } } }

export const ESSENCE_NAMES: Record<EssenceType, string> = { daoEssence: '道法精华', spiritEssence: '万灵精华', artifactEssence: '器华' }
export const REROLL_ESSENCE_COST = REROLL_COST
