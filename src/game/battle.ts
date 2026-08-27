import { uniformInt } from 'pure-rand/distribution/uniformInt'
import {
  xoroshiro128plus,
  xoroshiro128plusFromState,
} from 'pure-rand/generator/xoroshiro128plus'
import { M1_CONTENT } from '../content/m1'
import type {
  BattleCommand,
  BattleContent,
  BattleEvent,
  BattleState,
  BattleTransition,
  CardDefinition,
  CardId,
  UnitId,
  UnitState,
} from './types'

const STEP_MS = 250
const MAX_HAND = 4
const MAX_ARMOR_BREAK = 5

function makeUnit(definition: BattleContent['leader']): UnitState {
  return {
    ...definition,
    hp: definition.maxHp,
    shield: 0,
    armorBreak: 0,
    nextActionAtMs: definition.attackIntervalMs,
  }
}

function shuffle(cards: readonly CardId[], rngState: readonly number[]) {
  const next = [...cards]
  const rng = xoroshiro128plusFromState(rngState)
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = uniformInt(rng, 0, index)
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return { cards: next, rngState: [...rng.getState()] }
}

function drawOne(state: BattleState, events: BattleEvent[]) {
  if (state.hand.length >= MAX_HAND) return
  if (state.deck.length === 0 && state.discard.length > 0) {
    const shuffled = shuffle(state.discard, state.rngState)
    state.deck = shuffled.cards
    state.rngState = shuffled.rngState
    state.discard = []
  }
  const cardId = state.deck.shift()
  if (!cardId) return
  state.hand.push(cardId)
  events.push({ type: 'card_drawn', cardId, atMs: state.timeMs })
}

function cloneState(state: BattleState): BattleState {
  return {
    ...state,
    rngState: [...state.rngState],
    leader: { ...state.leader },
    spirits: [{ ...state.spirits[0] }, { ...state.spirits[1] }],
    enemy: { ...state.enemy },
    deck: [...state.deck],
    hand: [...state.hand],
    discard: [...state.discard],
    autoplayPriority: [...state.autoplayPriority],
  }
}

export function createBattle(
  seed: number,
  content: BattleContent = M1_CONTENT,
): BattleState {
  const initialRng = xoroshiro128plus(seed)
  const shuffled = shuffle(content.startingDeck, initialRng.getState())
  const state: BattleState = {
    seed,
    rngState: shuffled.rngState,
    timeMs: 0,
    status: 'active',
    leader: makeUnit(content.leader),
    spirits: [makeUnit(content.spirits[0]), makeUnit(content.spirits[1])],
    enemy: makeUnit(content.enemy),
    energy: 3,
    maxEnergy: 10,
    energyProgressMs: 0,
    swordIntent: 0,
    swordIntentCap: 10,
    nextSwordIntentBonus: 0,
    cardsPlayed: 0,
    deck: shuffled.cards,
    hand: [],
    discard: [],
    autoplay: false,
    autoplayPriority: [...content.startingDeck],
  }
  const ignoredEvents: BattleEvent[] = []
  while (state.hand.length < MAX_HAND) drawOne(state, ignoredEvents)
  return state
}

function effectiveDefense(unit: UnitState) {
  const reduction = Math.floor(unit.defense * unit.armorBreak * 0.05)
  return Math.max(0, unit.defense - reduction)
}

function dealDamage(
  state: BattleState,
  sourceId: UnitId | CardId,
  sourceAttack: number,
  target: UnitState,
  powerPercent: number,
  events: BattleEvent[],
) {
  if (target.hp <= 0 || state.status !== 'active') return
  const raw = Math.floor(
    (sourceAttack * powerPercent * 100) / (100 * (100 + effectiveDefense(target))),
  )
  const incoming = Math.max(1, raw)
  const shieldAbsorbed = Math.min(target.shield, incoming)
  const hpDamage = incoming - shieldAbsorbed
  target.shield -= shieldAbsorbed
  target.hp = Math.max(0, target.hp - hpDamage)
  events.push({
    type: 'damage',
    sourceId,
    targetId: target.id,
    amount: hpDamage,
    shieldAbsorbed,
    atMs: state.timeMs,
  })
  finishIfNeeded(state, events)
}

function addShield(
  state: BattleState,
  sourceId: UnitId | CardId,
  target: UnitState,
  amount: number,
  events: BattleEvent[],
) {
  if (target.hp <= 0 || state.status !== 'active') return
  target.shield += amount
  events.push({
    type: 'shield',
    sourceId,
    targetId: target.id,
    amount,
    atMs: state.timeMs,
  })
}

function finishIfNeeded(state: BattleState, events: BattleEvent[]) {
  if (state.enemy.hp <= 0 && state.status === 'active') {
    state.status = 'victory'
    events.push({ type: 'battle_ended', result: 'victory', atMs: state.timeMs })
  } else if (state.leader.hp <= 0 && state.status === 'active') {
    state.status = 'defeat'
    events.push({ type: 'battle_ended', result: 'defeat', atMs: state.timeMs })
  }
}

function gainSwordIntent(
  state: BattleState,
  amount: number,
  events: BattleEvent[],
) {
  const bonus = state.nextSwordIntentBonus
  state.nextSwordIntentBonus = 0
  state.swordIntent = Math.min(state.swordIntentCap, state.swordIntent + amount + bonus)
  events.push({
    type: 'status_changed',
    targetId: 'battle',
    status: 'sword_intent',
    value: state.swordIntent,
    atMs: state.timeMs,
  })
}

function applyCardEffect(
  state: BattleState,
  card: CardDefinition,
  events: BattleEvent[],
) {
  const power = card.powerPercent ?? 100
  switch (card.effectId) {
    case 'damage_and_sword_intent':
      dealDamage(state, card.id, state.leader.attack, state.enemy, power, events)
      gainSwordIntent(state, card.swordIntent ?? 0, events)
      break
    case 'shield_and_prime_intent':
      addShield(state, card.id, state.leader, card.shield ?? 0, events)
      state.nextSwordIntentBonus = 1
      break
    case 'double_hit':
      for (let hit = 0; hit < (card.hits ?? 2); hit += 1) {
        dealDamage(state, card.id, state.leader.attack, state.enemy, power, events)
      }
      break
    case 'damage_and_armor_break':
      dealDamage(state, card.id, state.leader.attack, state.enemy, power, events)
      if (state.enemy.hp > 0) {
        state.enemy.armorBreak = Math.min(
          MAX_ARMOR_BREAK,
          state.enemy.armorBreak + (card.armorBreak ?? 0),
        )
        events.push({
          type: 'status_changed',
          targetId: state.enemy.id,
          status: 'armor_break',
          value: state.enemy.armorBreak,
          atMs: state.timeMs,
        })
      }
      break
    case 'sword_intent_multihit':
      for (let hit = 0; hit < Math.max(1, state.swordIntent); hit += 1) {
        dealDamage(state, card.id, state.leader.attack, state.enemy, power, events)
      }
      break
    case 'consume_sword_intent_finisher': {
      const consumed = state.swordIntent
      dealDamage(
        state,
        card.id,
        state.leader.attack,
        state.enemy,
        power + consumed * 45,
        events,
      )
      state.swordIntent = 0
      events.push({
        type: 'status_changed',
        targetId: 'battle',
        status: 'sword_intent',
        value: 0,
        atMs: state.timeMs,
      })
      state.spirits[1].nextActionAtMs = Math.max(
        state.timeMs,
        state.spirits[1].nextActionAtMs - 1_500,
      )
      break
    }
  }
}

function playCard(
  state: BattleState,
  cardId: CardId,
  content: BattleContent,
  events: BattleEvent[],
  automatic: boolean,
) {
  const handIndex = state.hand.indexOf(cardId)
  const card = content.cards[cardId]
  if (state.status !== 'active' || handIndex < 0 || state.energy < card.cost) return false

  state.energy -= card.cost
  state.hand.splice(handIndex, 1)
  state.discard.push(cardId)
  state.cardsPlayed += 1
  events.push({ type: 'energy_changed', value: state.energy, atMs: state.timeMs })
  events.push({ type: 'card_played', cardId, automatic, atMs: state.timeMs })
  applyCardEffect(state, card, events)

  if (state.status === 'active' && state.cardsPlayed % 3 === 0) {
    events.push({
      type: 'unit_action',
      unitId: state.spirits[0].id,
      action: '刃尾追击',
      atMs: state.timeMs,
    })
    dealDamage(
      state,
      state.spirits[0].id,
      state.spirits[0].attack,
      state.enemy,
      65,
      events,
    )
  }

  if (state.status === 'active') drawOne(state, events)
  return true
}

function autoAction(
  state: BattleState,
  unit: UnitState,
  events: BattleEvent[],
) {
  if (unit.hp <= 0 || state.status !== 'active') return
  if (unit.id === 'leader') {
    events.push({ type: 'unit_action', unitId: unit.id, action: '青岚剑', atMs: state.timeMs })
    dealDamage(state, unit.id, unit.attack, state.enemy, 100, events)
  } else if (unit.id === 'blade_tail_fox') {
    events.push({ type: 'unit_action', unitId: unit.id, action: '刃尾连袭', atMs: state.timeMs })
    dealDamage(state, unit.id, unit.attack, state.enemy, 55, events)
    dealDamage(state, unit.id, unit.attack, state.enemy, 55, events)
  } else if (unit.id === 'iron_beak_crane') {
    events.push({ type: 'unit_action', unitId: unit.id, action: '铁喙点穴', atMs: state.timeMs })
    dealDamage(state, unit.id, unit.attack, state.enemy, 150, events)
    if (state.enemy.hp > 0) {
      state.enemy.armorBreak = Math.min(MAX_ARMOR_BREAK, state.enemy.armorBreak + 1)
      events.push({
        type: 'status_changed',
        targetId: state.enemy.id,
        status: 'armor_break',
        value: state.enemy.armorBreak,
        atMs: state.timeMs,
      })
    }
  } else {
    events.push({ type: 'unit_action', unitId: unit.id, action: '泥拳', atMs: state.timeMs })
    dealDamage(state, unit.id, unit.attack, state.leader, 100, events)
  }
}

function advanceStep(state: BattleState, content: BattleContent, events: BattleEvent[]) {
  if (state.status !== 'active') return
  state.timeMs += STEP_MS

  if (state.energy < state.maxEnergy) {
    state.energyProgressMs += STEP_MS
    if (state.energyProgressMs >= 1_000) {
      state.energyProgressMs -= 1_000
      state.energy += 1
      events.push({ type: 'energy_changed', value: state.energy, atMs: state.timeMs })
    }
  } else {
    state.energyProgressMs = 0
  }

  const actors = [state.leader, ...state.spirits, state.enemy]
  for (const actor of actors) {
    if (state.status !== 'active') break
    if (actor.hp > 0 && state.timeMs >= actor.nextActionAtMs) {
      autoAction(state, actor, events)
      actor.nextActionAtMs += actor.attackIntervalMs
    }
  }

  if (state.autoplay && state.status === 'active') {
    const cardId = state.autoplayPriority.find(
      (id) => state.hand.includes(id) && content.cards[id].cost <= state.energy,
    )
    if (cardId) playCard(state, cardId, content, events, true)
  }
}

function validPriority(cardIds: CardId[], content: BattleContent) {
  return (
    cardIds.length === content.startingDeck.length &&
    new Set(cardIds).size === content.startingDeck.length &&
    content.startingDeck.every((id) => cardIds.includes(id))
  )
}

export function transitionBattle(
  current: BattleState,
  command: BattleCommand,
  content: BattleContent = M1_CONTENT,
): BattleTransition {
  if (command.type === 'restart') {
    const state = createBattle(command.seed ?? current.seed, content)
    return {
      state,
      events: [{ type: 'battle_started', seed: state.seed, atMs: 0 }],
    }
  }

  const state = cloneState(current)
  const events: BattleEvent[] = []
  switch (command.type) {
    case 'advance': {
      const steps = Math.max(0, Math.floor(command.elapsedMs / STEP_MS))
      for (let step = 0; step < steps; step += 1) advanceStep(state, content, events)
      break
    }
    case 'play_card':
      playCard(state, command.cardId, content, events, false)
      break
    case 'set_autoplay':
      state.autoplay = command.enabled
      break
    case 'reorder_priority':
      if (validPriority(command.cardIds, content)) {
        state.autoplayPriority = [...command.cardIds]
      }
      break
  }
  return { state, events }
}
