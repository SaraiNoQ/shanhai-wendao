import { describe, expect, it } from 'vitest'
import { BACKUP_SAVE_KEY, SAVE_KEY, battleContentFromSave, createPlayerSave, loadPlayerSave, parseSave, previewReroll, receiveCollectible, resetLevel, resolveReroll, upgrade } from './player'

describe('player progression', () => {
  it('upgrades, fully refunds, and converts duplicates', () => {
    const initial = createPlayerSave()
    const upgraded = upgrade(upgrade(initial, 'guiding_edge'), 'guiding_edge')
    expect(upgraded.levels.guiding_edge).toBe(3)
    expect(resetLevel(upgraded, 'guiding_edge').resources).toEqual(initial.resources)
    expect(receiveCollectible(initial, 'guiding_edge').resources.daoEssence).toBe(initial.resources.daoEssence + 12)
  })

  it('keeps rerolls pending until confirmed', () => {
    const initial = createPlayerSave()
    initial.resources.artifactEssence = 100
    const preview = previewReroll(initial, 'equipment_hidden_edge_jade')
    expect(preview.equipmentAffixes.equipment_hidden_edge_jade).toEqual(initial.equipmentAffixes.equipment_hidden_edge_jade)
    expect(resolveReroll(preview, false).equipmentAffixes.equipment_hidden_edge_jade).toEqual(initial.equipmentAffixes.equipment_hidden_edge_jade)
    expect(resolveReroll(preview, true).equipmentAffixes.equipment_hidden_edge_jade).toEqual(preview.pendingReroll?.affixes)
  })

  it('rejects malformed imports without producing a save', () => {
    expect(parseSave('{bad json').success).toBe(false)
    expect(parseSave(JSON.stringify({ saveVersion: 999 })).success).toBe(false)
    expect(parseSave(JSON.stringify(createPlayerSave())).success).toBe(true)
  })

  it('migrates v1 to v3 while preserving collection progress', () => {
    const current = createPlayerSave(100)
    const { campaign: _campaign, ...legacy } = current
    const parsed = parseSave(JSON.stringify({ ...legacy, saveVersion: 1 }), 500)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.saveVersion).toBe(3)
    expect(parsed.data.ownedIds).toEqual(current.ownedIds)
    expect(parsed.data.resources).toEqual(current.resources)
    expect(parsed.data.campaign.lastActiveAtMs).toBe(500)
    expect(parsed.data.campaign.lastFailure).toBeUndefined()
  })

  it('migrates v2 to v3 without dropping campaign progress or a failure reminder', () => {
    const current = createPlayerSave(100)
    const v2 = {
      ...current,
      saveVersion: 2 as const,
      campaign: {
        ...current.campaign,
        highestClearedStage: 4,
        stableStage: 4,
        mode: 'farm' as const,
        lastFailure: { stageNumber: 5, fallbackStage: 4, reason: '主将生元耗尽。', battleSequence: 8 },
      },
    }
    const parsed = parseSave(JSON.stringify(v2), 500)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.saveVersion).toBe(3)
    expect(parsed.data.resources).toEqual(current.resources)
    expect(parsed.data.ownedIds).toEqual(current.ownedIds)
    expect(parsed.data.campaign.highestClearedStage).toBe(4)
    expect(parsed.data.campaign.stableStage).toBe(4)
    expect(parsed.data.campaign.lastFailure).toEqual(v2.campaign.lastFailure)
  })

  it('starts a formal journey with only the sword build unlocked', () => {
    const save = createPlayerSave(0)
    expect(save.ownedIds).toHaveLength(17)
    expect(save.ownedIds).toContain('azure_wind_sword')
    expect(save.ownedIds).not.toContain('cinnabar_brush')
  })

  it('backs up a damaged local save and persists priority and upgrades', () => {
    const data = new Map([[SAVE_KEY, '{broken']])
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }
    expect(loadPlayerSave(storage).saveVersion).toBe(3)
    expect(data.get(BACKUP_SAVE_KEY)).toBe('{broken')

    const save = createPlayerSave()
    save.loadout.autoplayPriority = [...save.loadout.autoplayPriority].reverse()
    save.levels.guiding_edge = 3
    const content = battleContentFromSave(save)
    expect(content.builds[save.loadout.buildId].autoplayPriority).toEqual(save.loadout.autoplayPriority)
    expect(content.cards.guiding_edge.powerPercent).toBeGreaterThan(80)
  })
})
