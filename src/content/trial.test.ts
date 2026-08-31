import { describe, expect, it } from 'vitest'
import { CORE_COLLECTION_ART_KEYS, COLLECTION_BY_ID } from './collection'
import { ENEMY_LORE, EVENT_LORE, LORE_BY_ID } from './lore'
import {
  HUAI_MATRIARCH_CONTENT,
  TRIAL_BACKGROUND_ART_KEY,
  TRIAL_COMMON_ENCOUNTER_POOL,
  TRIAL_ELITE_ENCOUNTER_POOL,
  TRIAL_EVENTS,
  TRIAL_GRID_SIZE,
  TRIAL_REQUIRED_SEALS,
  TRIAL_TEMPORARY_DECK_LIMIT,
  TRIAL_TILE_DISTRIBUTION,
  TRIAL_TILE_KINDS,
  TRIAL_TILE_RANGES,
} from './trial'

describe('M5 trial content', () => {
  it('keeps the 7x7, 26-tile distribution inside the documented bounds', () => {
    expect(TRIAL_GRID_SIZE).toBe(7)
    expect(Object.values(TRIAL_TILE_DISTRIBUTION).reduce((sum, count) => sum + count, 0) + 1).toBe(26)
    expect(TRIAL_TILE_KINDS).toHaveLength(8)
    for (const kind of TRIAL_TILE_KINDS) {
      expect(TRIAL_TILE_DISTRIBUTION[kind]).toBeGreaterThanOrEqual(TRIAL_TILE_RANGES[kind].min)
      expect(TRIAL_TILE_DISTRIBUTION[kind]).toBeLessThanOrEqual(TRIAL_TILE_RANGES[kind].max)
    }
    expect(TRIAL_REQUIRED_SEALS).toBe(2)
    expect(TRIAL_TEMPORARY_DECK_LIMIT).toBe(12)
    expect(TRIAL_BACKGROUND_ART_KEY).toBe('bg_huaiyin_trial_map')
  })

  it('defines eight stable event IDs with three choices each', () => {
    expect(TRIAL_EVENTS).toHaveLength(8)
    expect(new Set(TRIAL_EVENTS.map((event) => event.id)).size).toBe(8)
    for (const event of TRIAL_EVENTS) {
      expect(event.id).toMatch(/^event_[a-z0-9_]+$/)
      expect(event.title).not.toHaveLength(0)
      expect(event.body).not.toHaveLength(0)
      expect(event.choices).toHaveLength(3)
      expect(new Set(event.choices.map((choice) => choice.id)).size).toBe(3)
    }
  })

  it('keeps common, elite and the Huai Matriarch pools distinct', () => {
    expect(TRIAL_COMMON_ENCOUNTER_POOL).toHaveLength(10)
    expect(TRIAL_ELITE_ENCOUNTER_POOL).toHaveLength(3)
    expect(new Set([...TRIAL_COMMON_ENCOUNTER_POOL, ...TRIAL_ELITE_ENCOUNTER_POOL]).size).toBe(13)
    expect(HUAI_MATRIARCH_CONTENT.id).toBe('ancient_huai_matriarch')
    expect(HUAI_MATRIARCH_CONTENT.phases).toHaveLength(3)
  })
})

describe('lore and collectible art keys', () => {
  it('indexes 14 enemies and eight events without duplicate IDs', () => {
    expect(ENEMY_LORE).toHaveLength(14)
    expect(EVENT_LORE).toHaveLength(8)
    expect(Object.keys(LORE_BY_ID)).toHaveLength(22)
    expect(LORE_BY_ID.ancient_huai_matriarch?.name).toBe('千年槐姥')
    expect(LORE_BY_ID.event_talking_stele?.name).toBe('会说话的石碑')
  })

  it('wires the 12 collectible keys plus the trial background key', () => {
    expect(Object.keys(CORE_COLLECTION_ART_KEYS)).toHaveLength(12)
    for (const [id, artKey] of Object.entries(CORE_COLLECTION_ART_KEYS)) {
      expect(COLLECTION_BY_ID[id]?.artKey).toBe(artKey)
    }
    expect(TRIAL_BACKGROUND_ART_KEY).toBe('bg_huaiyin_trial_map')
  })
})
