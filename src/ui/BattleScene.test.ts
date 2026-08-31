import { describe, expect, it } from 'vitest'
import { battleEventsToVisualCues } from './BattleScene'
import type { BattleEvent } from '../game/types'

describe('battle scene cues', () => {
  it('maps combat events to deterministic visual cues without changing rules', () => {
    const events: BattleEvent[] = [
      { type: 'damage', sourceId: 'leader', targetId: 'clay_idol', amount: 12, shieldAbsorbed: 3, atMs: 250 },
      { type: 'heal', sourceId: 'life_talisman', targetId: 'leader', amount: 9, atMs: 500 },
      { type: 'shield', sourceId: 'hidden_edge', targetId: 'leader', amount: 22, atMs: 750 },
      { type: 'card_played', cardId: 'guiding_edge', automatic: true, atMs: 1_000 },
      { type: 'boss_phase_changed', phase: 'reflection', atMs: 1_250 },
    ]
    const first = battleEventsToVisualCues(events)
    expect(battleEventsToVisualCues(events)).toEqual(first)
    expect(first.map((cue) => cue.kind)).toEqual(['hit', 'heal', 'shield', 'card', 'phase'])
    expect(first[0]).toMatchObject({ sourceId: 'leader', targetId: 'clay_idol', amount: 15 })
  })
})
