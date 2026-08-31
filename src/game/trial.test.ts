import { describe, expect, it } from 'vitest'
import { TRIAL_TILE_KINDS } from '../content/trial'
import { battleContentFromSave, createPlayerSave } from '../state/player'
import { createBattle } from './battle'
import { createTrial, resolveTrialBattle, transitionTrial, type TrialRun } from './trial'

describe('M5 trial core', () => {
  it('creates a deterministic connected 7x7 map with the planned tile distribution', () => {
    const save = createPlayerSave(0)
    const first = createTrial(2468, save)
    const second = createTrial(2468, save)
    expect(second).toEqual(first)
    expect(first.grid).toHaveLength(26)
    expect(first.grid.filter((tile) => tile.kind === 'start')).toHaveLength(1)
    expect(first.grid.filter((tile) => tile.kind === 'boss')).toHaveLength(1)
    for (const kind of TRIAL_TILE_KINDS) expect(first.grid.filter((tile) => tile.kind === kind)).toHaveLength(kind === 'elite' ? 2 : kind === 'event' ? 6 : kind === 'chest' ? 2 : ({ combat: 9, training: 2, merchant: 1, camp: 2, boss: 1 } as Record<string, number>)[kind])
    const seen = new Set<string>([first.grid.find((tile) => tile.kind === 'start')!.id])
    for (const tile of first.grid) if ([...seen].some((id) => { const from = first.grid.find((candidate) => candidate.id === id)!; return Math.abs(from.x - tile.x) + Math.abs(from.y - tile.y) === 1 })) seen.add(tile.id)
    expect(seen.has(first.grid.find((tile) => tile.kind === 'boss')!.id)).toBe(true)
  })

  it('only permits adjacent movement and gates the boss behind two seals', () => {
    const run = createTrial(7, createPlayerSave(0))
    const bad = transitionTrial(run, { type: 'move', tileId: run.grid.find((tile) => tile.kind === 'boss')!.id })
    expect(bad.error).toMatch(/相邻/)
    const boss = run.grid.find((tile) => tile.kind === 'boss')!
    const adjacentToBoss = run.grid.find((tile) => Math.abs(tile.x - boss.x) + Math.abs(tile.y - boss.y) === 1)
    if (!adjacentToBoss) throw new Error('expected a tile adjacent to the boss')
    const moved = transitionTrial({ ...run, positionTileId: adjacentToBoss.id, revealedTileIds: [...run.revealedTileIds, boss.id] }, { type: 'move', tileId: boss.id })
    expect(moved.error).toMatch(/劫印/)
  })

  it('resolves a victory into a reward choice and an elite seal', () => {
    const save = createPlayerSave(0)
    const base = createTrial(8, save)
    const elite = base.grid.find((tile) => tile.kind === 'elite')!
    const run: TrialRun = { ...base, positionTileId: elite.id, pending: { kind: 'battle', tileId: elite.id, encounterIds: ['borrowed_life_crone'], elite: true, boss: false } }
    const battle = { ...createBattle(8, battleContentFromSave(save), { cardInstances: run.cardInstances }), status: 'victory' as const }
    const result = resolveTrialBattle(run, battle, [])
    expect(result.run.trialSeals).toBe(1)
    expect(result.run.pending?.kind).toBe('card_reward')
    expect(result.run.runCurrency).toBe(30)
  })

  it('ends a trial without inventing a second battle rule', () => {
    const save = createPlayerSave(0)
    const base = createTrial(9, save)
    const battle = { ...createBattle(9, battleContentFromSave(save), { cardInstances: base.cardInstances }), status: 'defeat' as const }
    const run: TrialRun = { ...base, pending: { kind: 'battle', tileId: base.positionTileId, encounterIds: ['shadow_civet'], elite: false, boss: false } }
    const result = resolveTrialBattle(run, battle, [])
    expect(result.run.status).toBe('failure')
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'run_ended', result: 'failure' }))
  })

  it('defers event bonus seals until the follow-up battle is won', () => {
    const save = createPlayerSave(0)
    const base = createTrial(10, save)
    const eventTile = base.grid.find((tile) => tile.kind === 'event')!
    const run: TrialRun = { ...base, positionTileId: eventTile.id, pending: { kind: 'event', tileId: eventTile.id, eventId: 'event_lost_woodcutter' } }
    const encounter = transitionTrial(run, { type: 'choose', optionId: 'question_woodcutter' })
    expect(encounter.run.trialSeals).toBe(0)
    expect(encounter.run.pending?.kind).toBe('battle')
    const battle = { ...createBattle(10, battleContentFromSave(save), { cardInstances: run.cardInstances }), status: 'victory' as const }
    const resolved = resolveTrialBattle(encounter.run, battle, [])
    expect(resolved.run.trialSeals).toBe(1)
  })

  it('carries consumed items and treasure charge into the next encounter', () => {
    const save = createPlayerSave(0)
    const base = createTrial(11, save)
    const battle = { ...createBattle(11, battleContentFromSave(save), { cardInstances: base.cardInstances, treasureId: base.treasureId, treasureCharge: 0, consumableIds: save.loadout.consumableIds, consumableUses: { [save.loadout.consumableIds[0]]: 1, [save.loadout.consumableIds[1]]: 2 } }), status: 'victory' as const }
    battle.consumableUses[save.loadout.consumableIds[0]] = 1
    const run: TrialRun = { ...base, treasureCharge: 2, pending: { kind: 'battle', tileId: base.positionTileId, encounterIds: ['shadow_civet'], elite: false, boss: false } }
    const resolved = resolveTrialBattle(run, battle, [])
    expect(resolved.run.treasureCharge).toBe(1)
    expect(resolved.run.consumableUses).toEqual([1, 2])
  })
})
