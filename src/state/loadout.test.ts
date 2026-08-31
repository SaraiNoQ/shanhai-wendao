import { describe, expect, it } from 'vitest'
import { COLLECTION, COLLECTION_BY_ID } from '../content/collection'
import { DETAIL_ENTITY_IDS, getEntityDetail } from '../content/details'
import { createPlayerSave } from './player'
import { applyLoadoutChange, getLoadoutSummary, getMatchedBuildId, reorderLoadoutPriority, swapLoadoutSlots } from './loadout'

describe('loadout rules', () => {
  it('recognises a preset and reports its active combo tags', () => {
    const save = createPlayerSave(0)
    expect(getMatchedBuildId(save)).toBe('pure_sword')
    const summary = getLoadoutSummary(save)
    expect(summary.buildName).toBe('剑意')
    expect(summary.activeCombos).toEqual([])
    expect(summary.tags).toContain('sword')
  })

  it('rejects unowned, wrong-slot and duplicate placements with reasons', () => {
    const save = createPlayerSave(0)
    expect(applyLoadoutChange(save, 'weapon', 'equipment_green_bamboo_crown').error).toContain('武器')
    expect(applyLoadoutChange(save, 'card_0', 'nine_heavens_edict').error).toContain('尚未收录')
    expect(applyLoadoutChange(save, 'head', 'equipment_wandering_cloud_robe').error).toContain('法衣')
    expect(applyLoadoutChange(save, 'card_0', save.loadout.cardIds[1]).error).toContain('两个起始牌槽')
    expect(applyLoadoutChange(save, 'spirit_0', save.loadout.spiritIds[1]).error).toContain('两个位置')
    expect(applyLoadoutChange(save, 'consumable_0', save.loadout.consumableIds[1]).error).toContain('两个行用槽')
  })

  it('replaces a card and keeps autoplay priority in sync', () => {
    const save = createPlayerSave(0)
    const next = { ...save, ownedIds: [...save.ownedIds, 'flowing_cloud_slashes'], levels: { ...save.levels, flowing_cloud_slashes: 1 } }
    const result = applyLoadoutChange(next, 'card_0', 'flowing_cloud_slashes')
    expect(result.changed).toBe(true)
    expect(result.save.loadout.cardIds[0]).toBe('flowing_cloud_slashes')
    expect(result.save.loadout.autoplayPriority).toContain('flowing_cloud_slashes')
    expect(result.save.loadout.autoplayPriority).not.toContain('guiding_edge')
    expect(getMatchedBuildId(result.save)).toBeUndefined()
  })

  it('swaps same-kind slots and refuses unrelated swaps', () => {
    const save = createPlayerSave(0)
    const cards = swapLoadoutSlots(save, 'card_0', 'card_1')
    expect(cards.changed).toBe(true)
    expect(cards.save.loadout.cardIds.slice(0, 2)).toEqual([save.loadout.cardIds[1], save.loadout.cardIds[0]])
    expect(swapLoadoutSlots(save, 'head', 'robe').error).toContain('同类')
    const order = reorderLoadoutPriority(save, [...save.loadout.autoplayPriority].reverse())
    expect(order.changed).toBe(true)
    expect(getMatchedBuildId(order.save)).toBeUndefined()
  })
})

describe('entity details', () => {
  it('covers every defined collection, enemy, event and stage detail', () => {
    const save = createPlayerSave(0)
    expect(COLLECTION.length).toBe(60)
    expect(DETAIL_ENTITY_IDS).toHaveLength(112)
    for (const id of DETAIL_ENTITY_IDS) {
      const detail = getEntityDetail(id, save)
      expect(detail, id).toBeDefined()
      expect(detail?.name, id).toBeTruthy()
      expect(detail?.summary, id).toBeTruthy()
      expect(detail?.currentStats.length, id).toBeGreaterThan(0)
      expect(detail?.mechanics.length, id).toBeGreaterThan(0)
    }
  })

  it('uses integer level scaling for cards and spirits', () => {
    let save = createPlayerSave(0)
    save = { ...save, levels: { ...save.levels, guiding_edge: 1, blade_tail_fox: 1 } }
    const card = getEntityDetail('guiding_edge', save)
    expect(card?.currentStats.find((stat) => stat.label === '伤害倍率')?.value).toBe('80%')
    expect(card?.nextLevelStats?.find((stat) => stat.label === '伤害倍率')?.value).toBe('84%')
    const spirit = getEntityDetail('blade_tail_fox', save)
    expect(spirit?.currentStats.find((stat) => stat.label === '最大生元')?.value).toBe('96')
    expect(spirit?.nextLevelStats?.find((stat) => stat.label === '最大生元')?.value).toBe('100')
    expect(COLLECTION_BY_ID.guiding_edge?.category).toBe('card')
  })

  it('exposes shared effect data for collectible details', () => {
    for (const item of COLLECTION) expect(item.effectId, item.id).toBeTruthy()
    const robe = getEntityDetail('equipment_wandering_cloud_robe', createPlayerSave(0))
    expect(robe?.currentStats.find((stat) => stat.label === '护盾')?.value).toBe('12')
    expect(robe?.nextLevelStats?.find((stat) => stat.label === '护盾')?.value).toBe('12')
    const save = { ...createPlayerSave(0), levels: { ...createPlayerSave(0).levels, treasure_crescent_sword_case: 9 } }
    const caseDetail = getEntityDetail('treasure_crescent_sword_case', save)
    expect(caseDetail?.currentStats.find((stat) => stat.label === '伤害倍率')?.value).toBe('112%')
  })

  it('exposes scaled stage enemies and complete event choices', () => {
    const save = createPlayerSave(0)
    const stage = getEntityDetail('stage_016', save)
    expect(stage?.mechanics.find((entry) => entry.label === '敌方波次')?.value).toContain('铜钱尸')
    expect(stage?.mechanics.find((entry) => entry.label === '敌方波次')?.value).toContain('3500ms')
    const event = getEntityDetail('event_roadside_red_sedan', save)
    expect(event?.mechanics).toHaveLength(3)
    expect(event?.mechanics[0].value).toContain('行炁')
  })
})
