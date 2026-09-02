import { AFFIXES, COLLECTION_BY_ID } from '../content/collection'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import type { BattleContent } from '../game/types'
import type { PlayerSave } from './player'
import { getForgeTier, getTieredEffectParams } from './forging'

/** Pure player-to-battle projection used by both the page and the offline worker. */
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
  const weapons = Object.fromEntries(Object.entries(PROTOTYPE_CONTENT.weapons).map(([id, weapon]) => [id, { ...weapon, effectParams: getTieredEffectParams(id, weapon.effectParams, getForgeTier(save, id)) }])) as BattleContent['weapons']
  return {
    ...PROTOTYPE_CONTENT,
    leader: { ...PROTOTYPE_CONTENT.leader, maxHp: PROTOTYPE_CONTENT.leader.maxHp + maxHp, attack: PROTOTYPE_CONTENT.leader.attack + attack, defense: PROTOTYPE_CONTENT.leader.defense + defense },
    spirits,
    weapons,
    cards,
    modifiers: { equipmentIds: [...loadout.equipmentIds], affixIds: equippedAffixes, treasureId: loadout.treasureId, consumableIds: [...loadout.consumableIds], collectibleLevels: { ...save.levels }, forgeTiers: { ...save.forgeTiers } },
    builds: { ...PROTOTYPE_CONTENT.builds, [loadout.buildId]: { ...PROTOTYPE_CONTENT.builds[loadout.buildId], weaponId: loadout.weaponId, techniqueId: loadout.techniqueId, spiritIds: loadout.spiritIds, cardIds: loadout.cardIds, autoplayPriority: loadout.autoplayPriority } },
  }
}

export function receiveCollectible(save: PlayerSave, id: string): PlayerSave {
  const item = COLLECTION_BY_ID[id]
  if (!item) return save
  if (!save.ownedIds.includes(id)) return { ...save, ownedIds: [...save.ownedIds, id], levels: { ...save.levels, [id]: 1 } }
  return { ...save, resources: { ...save.resources, [item.essenceType]: save.resources[item.essenceType] + item.duplicateEssence } }
}
