import { describe, expect, it } from 'vitest'
import { M1_CONTENT } from '../content/m1'
import { createBattle, transitionBattle } from './battle'
import type { BattleState, CardId } from './types'

function withHand(state: BattleState, hand: CardId[], energy = 10): BattleState {
  return { ...state, hand, deck: [], discard: [], energy }
}

describe('deterministic battle', () => {
  it('creates the same opening hand from the same seed', () => {
    expect(createBattle(42)).toEqual(createBattle(42))
    expect(createBattle(42).hand).toHaveLength(4)
  })

  it('refuses unaffordable cards without changing state', () => {
    const state = withHand(createBattle(1), ['mountain_splitter'], 0)
    const result = transitionBattle(state, { type: 'play_card', cardId: 'mountain_splitter' })
    expect(result.state).toEqual(state)
    expect(result.events).toEqual([])
  })

  it('discards a played card and draws its replacement', () => {
    const initial = createBattle(5)
    const cardId = initial.hand.find((id) => M1_CONTENT.cards[id].cost <= initial.energy)
    expect(cardId).toBeDefined()
    const result = transitionBattle(initial, { type: 'play_card', cardId: cardId! })
    expect(result.state.discard).toContain(cardId)
    expect(result.state.hand).toHaveLength(4)
    expect(result.events.some((event) => event.type === 'card_drawn')).toBe(true)
  })

  it('reshuffles the discard pile deterministically', () => {
    const state = withHand(createBattle(7), ['guiding_edge'])
    state.discard = ['hidden_edge', 'returning_wind']
    const first = transitionBattle(state, { type: 'play_card', cardId: 'guiding_edge' })
    const second = transitionBattle(state, { type: 'play_card', cardId: 'guiding_edge' })
    expect(first).toEqual(second)
    expect(first.state.hand).toHaveLength(1)
  })

  it('absorbs incoming damage with shield before hp', () => {
    const state = withHand(createBattle(8), ['hidden_edge'])
    const shielded = transitionBattle(state, { type: 'play_card', cardId: 'hidden_edge' }).state
    const advanced = transitionBattle(shielded, { type: 'advance', elapsedMs: 3_000 })
    expect(advanced.state.leader.shield).toBeLessThan(22)
    expect(advanced.state.leader.hp).toBe(shielded.leader.hp)
  })

  it('armor break increases damage', () => {
    const base = createBattle(9)
    const unbroken = withHand(base, ['guiding_edge'])
    const broken = withHand(base, ['guiding_edge'])
    broken.enemy = { ...broken.enemy, armorBreak: 5 }
    const normalResult = transitionBattle(unbroken, { type: 'play_card', cardId: 'guiding_edge' })
    const brokenResult = transitionBattle(broken, { type: 'play_card', cardId: 'guiding_edge' })
    expect(brokenResult.state.enemy.hp).toBeLessThan(normalResult.state.enemy.hp)
  })

  it('gains sword intent and consumes it with the finisher', () => {
    let state = withHand(createBattle(10), ['guiding_edge', 'mountain_splitter'])
    state = transitionBattle(state, { type: 'play_card', cardId: 'guiding_edge' }).state
    expect(state.swordIntent).toBe(2)
    state.energy = 10
    state = transitionBattle(state, { type: 'play_card', cardId: 'mountain_splitter' }).state
    expect(state.swordIntent).toBe(0)
  })

  it('autoplay skips an unaffordable high priority card', () => {
    const base = withHand(createBattle(11), ['mountain_splitter', 'guiding_edge'], 1)
    const priority = ['mountain_splitter', 'guiding_edge', 'hidden_edge', 'returning_wind', 'armor_piercing_star', 'ten_thousand_blades'] as CardId[]
    let state = transitionBattle(base, { type: 'reorder_priority', cardIds: priority }).state
    state = transitionBattle(state, { type: 'set_autoplay', enabled: true }).state
    const result = transitionBattle(state, { type: 'advance', elapsedMs: 250 })
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'card_played', cardId: 'guiding_edge', automatic: true }),
    )
  })

  it('ends in victory and defeated units stop acting', () => {
    const state = withHand(createBattle(12), ['mountain_splitter'])
    state.enemy = { ...state.enemy, hp: 1 }
    const won = transitionBattle(state, { type: 'play_card', cardId: 'mountain_splitter' })
    expect(won.state.status).toBe('victory')
    const after = transitionBattle(won.state, { type: 'advance', elapsedMs: 10_000 })
    expect(after.state).toEqual(won.state)
    expect(after.events).toEqual([])
  })

  it('ends in defeat when the leader dies', () => {
    const state = createBattle(13)
    state.leader.hp = 1
    state.enemy.nextActionAtMs = 250
    const result = transitionBattle(state, { type: 'advance', elapsedMs: 250 })
    expect(result.state.status).toBe('defeat')
  })

  it('restarts into the same seeded opening state', () => {
    const state = transitionBattle(createBattle(14), { type: 'advance', elapsedMs: 2_000 }).state
    const restarted = transitionBattle(state, { type: 'restart' })
    expect(restarted.state).toEqual(createBattle(14))
  })

  it('completes the demo battle under default autoplay', () => {
    let state = transitionBattle(createBattle(20_260_827), {
      type: 'set_autoplay',
      enabled: true,
    }).state
    for (let step = 0; step < 600 && state.status === 'active'; step += 1) {
      state = transitionBattle(state, { type: 'advance', elapsedMs: 250 }).state
    }
    expect(state.status).toBe('victory')
  })
})
