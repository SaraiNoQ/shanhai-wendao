import { AFFIXES, COLLECTION_BY_ID, type CollectionCategory, type CollectibleDefinition, type EquipmentSlot } from '../content/collection'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import { battleContentFromSave } from './player-rules'
import type { PlayerSave } from './player'
import type { Archetype, BuildId, CardDefinition, ComboId, SpiritId } from '../game/types'

export type LoadoutSlotId =
  | 'weapon' | 'technique'
  | 'head' | 'robe' | 'feet' | 'charm'
  | 'spirit_0' | 'spirit_1'
  | 'treasure'
  | 'consumable_0' | 'consumable_1'
  | 'card_0' | 'card_1' | 'card_2' | 'card_3' | 'card_4' | 'card_5'

export interface LoadoutChangeResult {
  save: PlayerSave
  changed: boolean
  error?: string
}

const equipmentSlots: readonly EquipmentSlot[] = ['head', 'robe', 'feet', 'charm']
const cardSlots = ['card_0', 'card_1', 'card_2', 'card_3', 'card_4', 'card_5'] as const
const spiritSlots = ['spirit_0', 'spirit_1'] as const
const consumableSlots = ['consumable_0', 'consumable_1'] as const

function cloneLoadout(save: PlayerSave) {
  return {
    ...save.loadout,
    spiritIds: [...save.loadout.spiritIds] as PlayerSave['loadout']['spiritIds'],
    cardIds: [...save.loadout.cardIds] as PlayerSave['loadout']['cardIds'],
    equipmentIds: [...save.loadout.equipmentIds] as PlayerSave['loadout']['equipmentIds'],
    consumableIds: [...save.loadout.consumableIds] as PlayerSave['loadout']['consumableIds'],
    autoplayPriority: [...save.loadout.autoplayPriority],
  }
}

function slotValue(loadout: PlayerSave['loadout'], slot: LoadoutSlotId): string {
  if (slot === 'weapon') return loadout.weaponId
  if (slot === 'technique') return loadout.techniqueId
  if (equipmentSlots.includes(slot as EquipmentSlot)) return loadout.equipmentIds[equipmentSlots.indexOf(slot as EquipmentSlot)]
  if (slot === 'treasure') return loadout.treasureId
  if (slot.startsWith('spirit_')) return loadout.spiritIds[Number(slot.at(-1))]
  if (slot.startsWith('consumable_')) return loadout.consumableIds[Number(slot.at(-1))]
  return loadout.cardIds[Number(slot.at(-1))]
}

function slotCategory(slot: LoadoutSlotId): CollectionCategory {
  if (slot === 'weapon') return 'weapon'
  if (slot === 'technique') return 'technique'
  if (equipmentSlots.includes(slot as EquipmentSlot)) return 'equipment'
  if (slot === 'treasure') return 'treasure'
  if (slot.startsWith('spirit_')) return 'spirit'
  if (slot.startsWith('consumable_')) return 'consumable'
  return 'card'
}

function replaceSlot(loadout: PlayerSave['loadout'], slot: LoadoutSlotId, id: string) {
  if (slot === 'weapon') loadout.weaponId = id as PlayerSave['loadout']['weaponId']
  else if (slot === 'technique') loadout.techniqueId = id as PlayerSave['loadout']['techniqueId']
  else if (equipmentSlots.includes(slot as EquipmentSlot)) loadout.equipmentIds[equipmentSlots.indexOf(slot as EquipmentSlot)] = id
  else if (slot === 'treasure') loadout.treasureId = id
  else if (slot.startsWith('spirit_')) loadout.spiritIds[Number(slot.at(-1))] = id as SpiritId
  else if (slot.startsWith('consumable_')) loadout.consumableIds[Number(slot.at(-1))] = id
  else loadout.cardIds[Number(slot.at(-1))] = id as CardDefinition['id']
}

function placementError(save: PlayerSave, slot: LoadoutSlotId, id: string, loadout = save.loadout): string | undefined {
  const item = COLLECTION_BY_ID[id]
  if (!item) return '这件收藏尚未定义。'
  if (!save.ownedIds.includes(id)) return '尚未收录，不能装备。'
  const category = slotCategory(slot)
  if (item.category !== category) return `此处需要${categoryLabel(category)}，不能放入${categoryLabel(item.category)}。`
  if (category === 'equipment' && item.slot !== slot) return `这件装备只能放入${item.slot ? equipmentSlotLabel(item.slot) : '对应'}槽位。`
  if (category === 'card' && loadout.cardIds.some((current, index) => current === id && current !== slotValue(loadout, slot) && index !== Number(slot.at(-1)))) return '同一张牌不能放入两个起始牌槽。'
  if (category === 'spirit' && loadout.spiritIds.some((current, index) => current === id && index !== Number(slot.at(-1)))) return '同一只妖灵不能同时占用两个位置。'
  if (category === 'consumable' && loadout.consumableIds.some((current, index) => current === id && index !== Number(slot.at(-1)))) return '同一配方不能同时占用两个行用槽。'
  return undefined
}

function categoryLabel(category: CollectionCategory) {
  return ({ weapon: '武器', technique: '功法', equipment: '装备', card: '术法', treasure: '法宝', consumable: '配方', spirit: '妖灵' })[category]
}

function equipmentSlotLabel(slot: EquipmentSlot) {
  return ({ head: '头冠', robe: '法衣', feet: '足履', charm: '佩饰' })[slot]
}

function syncPriority(priority: readonly CardDefinition['id'][], oldId: string, newId: CardDefinition['id'], cards: readonly CardDefinition['id'][]) {
  const next = priority.map((id) => id === oldId ? newId : id).filter((id, index, values) => values.indexOf(id) === index)
  for (const id of cards) if (!next.includes(id)) next.push(id)
  return next.slice(0, cards.length)
}

function updateBuildId(save: PlayerSave, loadout: PlayerSave['loadout']) {
  const candidate = { ...save, loadout } as PlayerSave
  return getMatchedBuildId(candidate) ?? loadout.buildId
}

export function applyLoadoutChange(save: PlayerSave, slot: LoadoutSlotId, collectibleId: string): LoadoutChangeResult {
  const currentId = slotValue(save.loadout, slot)
  if (currentId === collectibleId) return { save, changed: false }
  const loadout = cloneLoadout(save)
  const error = placementError(save, slot, collectibleId, loadout)
  if (error) return { save, changed: false, error }
  replaceSlot(loadout, slot, collectibleId)
  if (slot.startsWith('card_')) loadout.autoplayPriority = syncPriority(loadout.autoplayPriority, currentId, collectibleId as CardDefinition['id'], loadout.cardIds)
  loadout.buildId = updateBuildId(save, loadout)
  return { save: { ...save, loadout }, changed: true }
}

export function swapLoadoutSlots(save: PlayerSave, sourceSlot: LoadoutSlotId, targetSlot: LoadoutSlotId): LoadoutChangeResult {
  if (sourceSlot === targetSlot) return { save, changed: false }
  const sourceCategory = slotCategory(sourceSlot)
  if (sourceCategory !== slotCategory(targetSlot) || sourceCategory === 'equipment') return { save, changed: false, error: '只能交换同类的卡牌、妖灵或配方槽位。' }
  const loadout = cloneLoadout(save)
  const sourceId = slotValue(loadout, sourceSlot)
  const targetId = slotValue(loadout, targetSlot)
  replaceSlot(loadout, sourceSlot, targetId)
  replaceSlot(loadout, targetSlot, sourceId)
  const sourceError = placementError(save, sourceSlot, targetId, loadout)
  const targetError = placementError(save, targetSlot, sourceId, loadout)
  if (sourceError || targetError) return { save, changed: false, error: sourceError ?? targetError }
  loadout.buildId = updateBuildId(save, loadout)
  return { save: { ...save, loadout }, changed: true }
}

export function reorderLoadoutPriority(save: PlayerSave, cardIds: readonly CardDefinition['id'][]): LoadoutChangeResult {
  const next = [...cardIds]
  if (next.length !== save.loadout.cardIds.length || new Set(next).size !== next.length || next.some((id) => !save.loadout.cardIds.includes(id))) return { save, changed: false, error: '自动优先级必须包含六张不重复的起始牌。' }
  const loadout = cloneLoadout(save)
  loadout.autoplayPriority = next
  loadout.buildId = updateBuildId(save, loadout)
  return { save: { ...save, loadout }, changed: true }
}

function sameValues(left: readonly string[], right: readonly string[]) { return left.length === right.length && left.every((value, index) => value === right[index]) }

export function getMatchedBuildId(save: PlayerSave): BuildId | undefined {
  const loadout = save.loadout
  for (const build of Object.values(PROTOTYPE_CONTENT.builds)) {
    if (build.weaponId !== loadout.weaponId || build.techniqueId !== loadout.techniqueId) continue
    if (!sameValues(build.spiritIds, loadout.spiritIds) || !sameValues(build.cardIds, loadout.cardIds)) continue
    if (!sameValues(build.autoplayPriority ?? build.cardIds, loadout.autoplayPriority)) continue
    return build.id
  }
  return undefined
}

export interface LoadoutSummary {
  buildId?: BuildId
  buildName: string
  tags: Archetype[]
  activeCombos: ComboId[]
  leader: { maxHp: number; attack: number; defense: number }
  weapon: { id: string; name: string; tag: Archetype; attackIntervalMs: number; level: number }
  technique: { id: string; name: string; tag: Archetype; level: number }
  spirits: Array<{ id: SpiritId; name: string; title: string; tags: Archetype[]; maxHp: number; attack: number; defense: number; attackIntervalMs: number; level: number }>
  cards: Array<{ id: CardDefinition['id']; name: string; cost: number; tags: Archetype[]; level: number }>
  equipment: Array<{ id: string; name: string; slot?: EquipmentSlot; affixes: string[]; level: number }>
  treasure: { id: string; name: string; level: number }
  consumables: Array<{ id: string; name: string; level: number }>
}

export function getLoadoutSummary(save: PlayerSave): LoadoutSummary {
  const content = battleContentFromSave(save)
  const weapon = content.weapons[save.loadout.weaponId]
  const technique = content.techniques[save.loadout.techniqueId]
  const spirits = save.loadout.spiritIds.map((id) => ({ ...content.spirits[id], level: save.levels[id] ?? 1 }))
  const cards = save.loadout.cardIds.map((id) => ({ ...content.cards[id], level: save.levels[id] ?? 1 }))
  const tags = [...new Set<Archetype>([weapon.tag, technique.tag, ...spirits.flatMap((spirit) => spirit.tags), ...cards.flatMap((card) => card.tags)])]
  const activeCombos: ComboId[] = []
  if (tags.includes('sword') && tags.includes('talisman')) activeCombos.push('flying_sword_seal')
  if (tags.includes('talisman') && tags.includes('spirit')) activeCombos.push('spirit_edict')
  if (tags.includes('spirit') && tags.includes('sword')) activeCombos.push('dual_spirit_sword')
  return {
    buildId: getMatchedBuildId(save), buildName: getMatchedBuildId(save) ? PROTOTYPE_CONTENT.builds[getMatchedBuildId(save)!].name : '自定阵', tags, activeCombos,
    leader: { maxHp: content.leader.maxHp, attack: content.leader.attack, defense: content.leader.defense },
    weapon: { ...weapon, level: save.levels[weapon.id] ?? 1 }, technique: { ...technique, level: save.levels[technique.id] ?? 1 },
    spirits, cards,
    equipment: save.loadout.equipmentIds.map((id) => { const item = COLLECTION_BY_ID[id]; return { id, name: item?.name ?? id, slot: item?.slot, affixes: (save.equipmentAffixes[id] ?? []).map((affix) => `${AFFIXES[affix].name} +${AFFIXES[affix].value}${AFFIXES[affix].suffix}`), level: save.levels[id] ?? 1 } }),
    treasure: { id: save.loadout.treasureId, name: COLLECTION_BY_ID[save.loadout.treasureId]?.name ?? save.loadout.treasureId, level: save.levels[save.loadout.treasureId] ?? 1 },
    consumables: save.loadout.consumableIds.map((id) => ({ id, name: COLLECTION_BY_ID[id]?.name ?? id, level: save.levels[id] ?? 1 })),
  }
}

export function compatibleSlotForItem(save: PlayerSave, id: string): LoadoutSlotId | undefined {
  const item = COLLECTION_BY_ID[id]
  if (!item || !save.ownedIds.includes(id)) return undefined
  if (item.category === 'weapon') return 'weapon'
  if (item.category === 'technique') return 'technique'
  if (item.category === 'equipment' && item.slot) return item.slot
  if (item.category === 'treasure') return 'treasure'
  if (item.category === 'spirit') return spiritSlots.find((slot) => slotValue(save.loadout, slot) !== id) ?? spiritSlots[0]
  if (item.category === 'consumable') return consumableSlots.find((slot) => slotValue(save.loadout, slot) !== id) ?? consumableSlots[0]
  return cardSlots.find((slot) => slotValue(save.loadout, slot) !== id) ?? cardSlots[0]
}

export function collectibleForSlot(save: PlayerSave, slot: LoadoutSlotId): CollectibleDefinition | undefined { return COLLECTION_BY_ID[slotValue(save.loadout, slot)] }
