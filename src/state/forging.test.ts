import { describe, expect, it } from 'vitest'
import { FORGE_NODES } from '../content/forging'
import { battleContentFromSave, createPlayerSave, parseSave, resetLevel, upgrade } from './player'
import { breakthroughForgeItem, getForgeStatus, getForgeTier, getTieredEffectParams, refineForgeItem, resetForgeItem } from './forging'

describe('weapon and equipment forging', () => {
  it('keeps legacy upgrade/reset calls on the shared Lv.1-10 path', () => {
    const save = createPlayerSave()
    save.resources = { ...save.resources, spiritSand: 1_000, artifactEssence: 100 }
    const upgraded = upgrade(save, 'azure_wind_sword')
    expect(upgraded.levels.azure_wind_sword).toBe(2)
    expect(upgraded.resources).toMatchObject({ spiritSand: 900, artifactEssence: 90 })
    expect(resetLevel(upgraded, 'azure_wind_sword').resources).toEqual(save.resources)
  })

  it('requires Lv.10, foundation, and fixed materials for breakthrough', () => {
    const save = createPlayerSave()
    save.resources = { ...save.resources, spiritSand: 2_000, artifactEssence: 200 }
    save.levels.azure_wind_sword = 10
    expect(getForgeStatus(save, 'azure_wind_sword')).toMatchObject({ tier: 1, levelCap: 10, canBreakthrough: false, reason: '突破需要先完成筑基。' })
    save.realmId = 'foundation_established'
    const result = breakthroughForgeItem(save, 'azure_wind_sword')
    expect(result.changed).toBe(true)
    expect(result.save.forgeTiers.azure_wind_sword).toBe(2)
    expect(result.save.levels.azure_wind_sword).toBe(10)
    expect(result.save.resources).toMatchObject({ spiritSand: 1_000, artifactEssence: 100 })
    expect(getForgeStatus(result.save, 'azure_wind_sword')).toMatchObject({ tier: 2, levelCap: 20, refineCost: { spiritSand: 1_000, artifactEssence: 100 } })
    const duplicate = breakthroughForgeItem(result.save, 'azure_wind_sword')
    expect(duplicate).toMatchObject({ save: result.save, changed: false })
  })

  it('refunds refinement and breakthrough materials without touching affixes', () => {
    const save = createPlayerSave()
    save.realmId = 'foundation_established'
    save.resources = { ...save.resources, spiritSand: 100_000, artifactEssence: 10_000 }
    let levelled = save
    for (let level = 1; level < 10; level += 1) levelled = refineForgeItem(levelled, 'azure_wind_sword').save
    const broken = breakthroughForgeItem(levelled, 'azure_wind_sword').save
    const refined = refineForgeItem(refineForgeItem(broken, 'azure_wind_sword').save, 'azure_wind_sword').save
    const reset = resetForgeItem(refined, 'azure_wind_sword')
    expect(reset.changed).toBe(true)
    expect(reset.save.levels.azure_wind_sword).toBe(1)
    expect(getForgeTier(reset.save, 'azure_wind_sword')).toBe(1)
    expect(reset.save.resources).toEqual(save.resources)
    expect(reset.save.equipmentAffixes).toEqual(save.equipmentAffixes)
  })

  it('blocks all forge actions during read-only states', () => {
    const save = createPlayerSave()
    save.resources = { ...save.resources, spiritSand: 1_000, artifactEssence: 100 }
    save.trialRun = {} as never
    expect(refineForgeItem(save, 'azure_wind_sword')).toMatchObject({ save, changed: false })
    expect(resetForgeItem(save, 'azure_wind_sword')).toMatchObject({ save, changed: false })
  })

  it('shares all 15 tier-two nodes with the battle projection', () => {
    expect(Object.keys(FORGE_NODES)).toHaveLength(15)
    expect(getTieredEffectParams('azure_wind_sword', { attackEvery: 4 }, 2).attackEvery).toBe(3)
    const save = createPlayerSave()
    save.forgeTiers = { azure_wind_sword: 2 }
    const content = battleContentFromSave(save)
    expect(content.modifiers?.forgeTiers).toEqual({ azure_wind_sword: 2 })
    expect(content.weapons.azure_wind_sword.effectParams?.attackEvery).toBe(3)
  })

  it('uses the rarity cost curve for equipment and keeps weapon cost fixed', () => {
    const save = createPlayerSave()
    save.realmId = 'foundation_established'
    save.ownedIds = [...save.ownedIds, 'equipment_cinnabar_crown', 'equipment_mountain_lord_pelt']
    save.levels = { ...save.levels, equipment_cinnabar_crown: 10, equipment_mountain_lord_pelt: 10 }
    expect(getForgeStatus(save, 'equipment_cinnabar_crown').breakthroughCost).toEqual({ spiritSand: 800, artifactEssence: 80 })
    expect(getForgeStatus(save, 'equipment_mountain_lord_pelt').breakthroughCost).toEqual({ spiritSand: 1_000, artifactEssence: 100 })
    expect(getForgeStatus(save, 'azure_wind_sword').breakthroughCost).toEqual({ spiritSand: 1_000, artifactEssence: 100 })
    save.forgeTiers = { equipment_cinnabar_crown: 2 }
    expect(getForgeStatus(save, 'equipment_cinnabar_crown').refineCost).toEqual({ spiritSand: 1_000, artifactEssence: 100 })
  })

  it('exposes every fixed node through tiered params', () => {
    for (const [id, node] of Object.entries(FORGE_NODES)) {
      const base = Object.fromEntries(Object.keys(node.params).map((key) => [key, 0]))
      expect(getTieredEffectParams(id, base, 2), id).toMatchObject(node.params)
    }
  })

  it('migrates v4 saves and rejects invalid forge records', () => {
    const save = createPlayerSave()
    const { forgeTiers: _forgeTiers, ...v4 } = save
    const migrated = parseSave(JSON.stringify({ ...v4, saveVersion: 4 }))
    expect(migrated.success).toBe(true)
    if (!migrated.success) return
    expect(migrated.data.saveVersion).toBe(5)
    expect(migrated.data.forgeTiers).toEqual({})
    expect(parseSave(JSON.stringify({ ...save, forgeTiers: { guiding_edge: 2 } })).success).toBe(false)
    expect(parseSave(JSON.stringify({ ...save, forgeTiers: { unknown_item: 1 } })).success).toBe(false)
    expect(parseSave(JSON.stringify({ ...save, forgeTiers: { cinnabar_brush: 1 } })).success).toBe(false)
    expect(parseSave(JSON.stringify({ ...save, forgeTiers: { azure_wind_sword: 3 } })).success).toBe(false)
    expect(parseSave(JSON.stringify({ ...save, forgeTiers: { azure_wind_sword: 2 }, levels: { ...save.levels, azure_wind_sword: 9 } })).success).toBe(false)
    expect(parseSave(JSON.stringify({ ...save, levels: { ...save.levels, azure_wind_sword: 11 } })).success).toBe(false)
  })
})
