import { describe, expect, it } from 'vitest'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import { createBattle } from '../game/battle'
import { battleEventsToVisualCues } from './battle-visuals'
import { getBattleUnitLayout } from './BattleScene'
import type { BattleEvent } from '../game/types'

describe('battle scene cues', () => {
  it('maps combat events to deterministic visual cues without changing rules', () => {
    const events: BattleEvent[] = [
      { type: 'damage', sourceId: 'leader', targetId: 'clay_idol', amount: 12, shieldAbsorbed: 3, atMs: 250 },
      { type: 'heal', sourceId: 'life_talisman', targetId: 'leader', amount: 9, atMs: 500 },
      { type: 'shield', sourceId: 'hidden_edge', targetId: 'leader', amount: 22, atMs: 750 },
      { type: 'card_played', cardId: 'guiding_edge', automatic: true, atMs: 1_000 },
      { type: 'unit_summoned', unitId: 'paper_child', sourceId: 'paper_armor_envoy', atMs: 1_125 },
      { type: 'boss_phase_changed', phase: 'reflection', atMs: 1_250 },
      { type: 'status_changed', targetId: 'leader', status: 'armor_break', value: 1, atMs: 1_500 },
      { type: 'enemy_buff', targetId: 'clay_idol', status: 'attack', value: 2, atMs: 1_750 },
      { type: 'combo_triggered', comboId: 'flying_sword_seal', atMs: 2_000 },
      { type: 'wave_started', waveNumber: 2, atMs: 2_250 },
      { type: 'battle_timeout', atMs: 2_500 },
    ]
    const first = battleEventsToVisualCues(events)
    expect(battleEventsToVisualCues(events)).toEqual(first)
    expect(first.map((cue) => cue.kind)).toEqual(['hit', 'heal', 'shield', 'card', 'summon', 'phase', 'status', 'buff', 'combo', 'wave', 'end'])
    expect(first[0]).toMatchObject({ sourceId: 'leader', targetId: 'clay_idol', amount: 15 })
  })

  it('keeps a deterministic side layout with unique keys for repeated enemies', () => {
    const battle = createBattle(41, PROTOTYPE_CONTENT, 'pure_sword')
    battle.enemies = [
      { ...PROTOTYPE_CONTENT.enemyDefinitions.clay_idol, hp: 1, shield: 0, armorBreak: 0, nextActionAtMs: 1_000, talismanMarks: 0, talismanExpiresAtMs: 0, burnStacks: 0, nextBurnAtMs: 0, actionCount: 0, attackBonusPercent: 0, deathEffectTriggered: false, summonTriggered: false },
      { ...PROTOTYPE_CONTENT.enemyDefinitions.clay_idol, hp: 1, shield: 0, armorBreak: 0, nextActionAtMs: 1_000, talismanMarks: 0, talismanExpiresAtMs: 0, burnStacks: 0, nextBurnAtMs: 0, actionCount: 0, attackBonusPercent: 0, deathEffectTriggered: false, summonTriggered: false },
    ]
    const layout = getBattleUnitLayout(battle)
    const enemies = layout.filter((unit) => unit.side === 'enemy')
    expect(enemies).toHaveLength(2)
    expect(new Set(enemies.map((unit) => unit.key)).size).toBe(2)
    expect(enemies.map((unit) => unit.index)).toEqual([0, 1])
    expect(enemies.every((unit) => unit.x >= 0.6)).toBe(true)
    expect(layout.filter((unit) => unit.side === 'ally')).toHaveLength(3)
  })

  it('spreads a three-enemy wave across the right side without duplicate anchors', () => {
    const enemy = PROTOTYPE_CONTENT.enemyDefinitions.clay_idol
    const battle = createBattle(43, { ...PROTOTYPE_CONTENT, enemies: [enemy, enemy, enemy] }, 'pure_sword')
    const enemies = getBattleUnitLayout(battle).filter((unit) => unit.side === 'enemy')
    expect(enemies).toHaveLength(3)
    expect(new Set(enemies.map((unit) => `${unit.x}:${unit.y}`)).size).toBe(3)
    expect(enemies.every((unit) => unit.x >= 0.6 && unit.x <= 1 && unit.y >= 0 && unit.y <= 1)).toBe(true)
  })

  it('uses a larger scale for the single breakthrough boss', () => {
    const battle = createBattle(42, { ...PROTOTYPE_CONTENT, enemies: [PROTOTYPE_CONTENT.enemyDefinitions.ancient_huai_matriarch] }, 'pure_sword')
    const boss = getBattleUnitLayout(battle).find((unit) => unit.unitId === 'ancient_huai_matriarch')
    expect(boss).toMatchObject({ side: 'enemy', index: 0, scale: 0.3 })
  })
})
