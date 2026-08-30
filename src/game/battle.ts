import { uniformInt } from 'pure-rand/distribution/uniformInt'
import { xoroshiro128plus, xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import type { Archetype, BattleCommand, BattleContent, BattleEvent, BattleState, BattleTransition, BuildId, CardDefinition, CardId, ComboId, EnemyDefinition, EnemyId, SpiritId, UnitDefinition, UnitId, UnitState } from './types'

const STEP_MS = 250
const MAX_HAND = 4
const MAX_ARMOR_BREAK = 5
const MAX_MARKS = 6
const MAX_BURN = 6
type SourceId = UnitId | CardId | 'burn'

function makeUnit(definition: UnitDefinition): UnitState {
  return { ...definition, hp: definition.maxHp, shield: 0, armorBreak: 0, nextActionAtMs: definition.attackIntervalMs, talismanMarks: 0, talismanExpiresAtMs: 0, burnStacks: 0, nextBurnAtMs: 0, actionCount: 0, attackBonusPercent: 0, deathEffectTriggered: false, summonTriggered: false }
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
    activeCombos: [...state.activeCombos],
    leader: { ...state.leader },
    spirits: [{ ...state.spirits[0] }, { ...state.spirits[1] }],
    enemies: state.enemies.map((enemy) => ({ ...enemy })),
    spiritBonds: [...state.spiritBonds],
    spiritComboCounts: [...state.spiritComboCounts],
    firstSpiritComboTriggered: [...state.firstSpiritComboTriggered],
    swordCardsPlayed: [...state.swordCardsPlayed],
    deck: [...state.deck],
    hand: [...state.hand],
    discard: [...state.discard],
    autoplayPriority: [...state.autoplayPriority],
  }
}

function buildTags(content: BattleContent, buildId: BuildId) {
  const build = content.builds[buildId]
  return new Set<Archetype>([
    content.weapons[build.weaponId].tag,
    content.techniques[build.techniqueId].tag,
    ...build.spiritIds.flatMap((id) => content.spirits[id].tags),
    ...build.cardIds.flatMap((id) => content.cards[id].tags),
  ])
}

function activeCombos(content: BattleContent, buildId: BuildId): ComboId[] {
  const tags = buildTags(content, buildId)
  const combos: ComboId[] = []
  if (tags.has('sword') && tags.has('talisman')) combos.push('flying_sword_seal')
  if (tags.has('talisman') && tags.has('spirit')) combos.push('spirit_edict')
  if (tags.has('spirit') && tags.has('sword')) combos.push('dual_spirit_sword')
  return combos
}

export function createBattle(seed: number, content: BattleContent = PROTOTYPE_CONTENT, buildId: BuildId = content.defaultBuildId): BattleState {
  const build = content.builds[buildId]
  const weapon = content.weapons[build.weaponId]
  const technique = content.techniques[build.techniqueId]
  const shuffled = shuffle(build.cardIds, xoroshiro128plus(seed).getState())
  const leader = makeUnit({ ...content.leader, title: `${weapon.name} · ${technique.name}`, attackIntervalMs: weapon.attackIntervalMs })
  const spirits = build.spiritIds.map((id) => makeUnit(content.spirits[id])) as [UnitState, UnitState]
  if (build.weaponId === 'spirit_bell') spirits.forEach((spirit) => { spirit.nextActionAtMs = Math.max(STEP_MS, spirit.attackIntervalMs - 1_500) })
  const state: BattleState = {
    seed, rngState: shuffled.rngState, timeMs: 0, status: 'active', buildId,
    weaponId: build.weaponId, techniqueId: build.techniqueId, activeCombos: activeCombos(content, buildId),
    leader, spirits, enemies: content.enemies.map(makeUnit),
    energy: 3, maxEnergy: 10, energyProgressMs: 0,
    swordIntent: 0, swordIntentCap: 10, nextSwordIntentBonus: 0, swordCardStreak: 0, nextFinisherDiscount: 0,
    talismanDiscountCharges: 0, nextEdictDiscount: 0,
    spiritBonds: [0, 0], spiritComboCounts: [0, 0], firstSpiritComboTriggered: [false, false], totalSpiritCombos: 0,
    spiritComboDamageBonus: 0, copyNextSpiritCombo: false, dualSpiritSwordReadyAtMs: 0,
    basicAttackCount: 0, cardsPlayed: 0, swordCardsPlayed: [], sameTagStreak: 0,
    deck: shuffled.cards, hand: [], discard: [], autoplay: false, autoplayPriority: [...(build.autoplayPriority ?? build.cardIds)],
  }
  const ignored: BattleEvent[] = []
  while (state.hand.length < MAX_HAND) drawOne(state, ignored)
  return state
}

function currentEnemy(state: BattleState) { return state.enemies.find((enemy) => enemy.hp > 0) }
function effectiveDefense(unit: UnitState) { return Math.max(0, unit.defense - Math.floor(unit.defense * unit.armorBreak * 0.05)) }

function finishIfNeeded(state: BattleState, events: BattleEvent[]) {
  if (state.status !== 'active') return
  if (state.enemies.every((enemy) => enemy.hp <= 0)) {
    state.status = 'victory'
    events.push({ type: 'battle_ended', result: 'victory', atMs: state.timeMs })
  } else if (state.leader.hp <= 0) {
    state.status = 'defeat'
    events.push({ type: 'battle_ended', result: 'defeat', atMs: state.timeMs })
  }
}

function applyIncoming(state: BattleState, sourceId: SourceId, target: UnitState, incoming: number, events: BattleEvent[]) {
  if (target.hp <= 0 || state.status !== 'active') return
  let damage = incoming
  const mountainIndex = state.spirits.findIndex((spirit) => spirit.id === 'mountain_child' && spirit.hp > 0)
  if (target.id === 'leader' && mountainIndex >= 0 && state.enemies.some((enemy) => enemy.id === sourceId)) {
    const guarded = Math.floor(damage * 0.2)
    damage -= guarded
    applyIncoming(state, sourceId, state.spirits[mountainIndex], guarded, events)
  }
  const shieldAbsorbed = Math.min(target.shield, damage)
  const hpDamage = damage - shieldAbsorbed
  target.shield -= shieldAbsorbed
  target.hp = Math.max(0, target.hp - hpDamage)
  events.push({ type: 'damage', sourceId, targetId: target.id, amount: hpDamage, shieldAbsorbed, atMs: state.timeMs })
  if (target.id === 'paper_armor_envoy' && !target.summonTriggered && target.hp > 0 && target.hp * 100 <= target.maxHp * 60) {
    target.summonTriggered = true
    const summoned = makeUnit(PROTOTYPE_CONTENT.enemyDefinitions.paper_child)
    summoned.nextActionAtMs += state.timeMs
    state.enemies.push(summoned)
    state.enemies.filter((enemy) => enemy.hp > 0 && enemy !== target).forEach((enemy) => { enemy.shield += 24 })
    events.push({ type: 'unit_summoned', unitId: 'paper_child', sourceId: 'paper_armor_envoy', atMs: state.timeMs })
  }
  if (target.id === 'coin_corpse' && target.hp <= 0 && !target.deathEffectTriggered) {
    target.deathEffectTriggered = true
    state.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
      const gained = Math.max(1, Math.floor(enemy.attack * 0.15))
      enemy.attack += gained
      enemy.attackBonusPercent += 15
      events.push({ type: 'enemy_buff', targetId: enemy.id as EnemyId, status: 'attack', value: enemy.attack, atMs: state.timeMs })
    })
  }
  finishIfNeeded(state, events)
}

function dealDamage(state: BattleState, sourceId: SourceId, sourceAttack: number, target: UnitState, powerPercent: number, events: BattleEvent[]) {
  const raw = Math.floor((sourceAttack * powerPercent) / (100 + effectiveDefense(target)))
  applyIncoming(state, sourceId, target, Math.max(1, raw), events)
}

function dealFlatDamage(state: BattleState, sourceId: SourceId, target: UnitState, amount: number, events: BattleEvent[]) {
  applyIncoming(state, sourceId, target, Math.max(1, amount), events)
}

function addShield(state: BattleState, sourceId: UnitId | CardId, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0 || state.status !== 'active') return
  target.shield += amount
  events.push({ type: 'shield', sourceId, targetId: target.id, amount, atMs: state.timeMs })
}

function heal(state: BattleState, sourceId: UnitId | CardId, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0 || state.status !== 'active') return
  const restored = Math.min(amount, target.maxHp - target.hp)
  target.hp += restored
  events.push({ type: 'heal', sourceId, targetId: target.id, amount: restored, atMs: state.timeMs })
  const crone = state.enemies.find((enemy) => enemy.id === 'borrowed_life_crone' && enemy.hp > 0)
  if (crone && restored > 0 && sourceId !== crone.id) {
    const stolen = Math.min(Math.floor(restored * 0.5), crone.maxHp - crone.hp)
    crone.hp += stolen
    if (stolen) events.push({ type: 'heal', sourceId: crone.id, targetId: crone.id, amount: stolen, atMs: state.timeMs })
  }
}

function gainEnergy(state: BattleState, amount: number, events: BattleEvent[]) {
  state.energy = Math.min(state.maxEnergy, state.energy + amount)
  events.push({ type: 'energy_changed', value: state.energy, atMs: state.timeMs })
}

function gainSwordIntent(state: BattleState, amount: number, events: BattleEvent[]) {
  const bonus = state.nextSwordIntentBonus
  state.nextSwordIntentBonus = 0
  state.swordIntent = Math.min(state.swordIntentCap, state.swordIntent + amount + bonus)
  events.push({ type: 'status_changed', targetId: 'battle', status: 'sword_intent', value: state.swordIntent, atMs: state.timeMs })
}

function addArmorBreak(state: BattleState, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0) return
  target.armorBreak = Math.min(MAX_ARMOR_BREAK, target.armorBreak + amount)
  events.push({ type: 'status_changed', targetId: target.id, status: 'armor_break', value: target.armorBreak, atMs: state.timeMs })
}

function addMarks(state: BattleState, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0) return
  target.talismanMarks = Math.min(MAX_MARKS, target.talismanMarks + amount)
  target.talismanExpiresAtMs = state.timeMs + 10_000
  events.push({ type: 'status_changed', targetId: target.id, status: 'talisman_mark', value: target.talismanMarks, atMs: state.timeMs })
}

function addBurn(state: BattleState, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0) return
  target.burnStacks = Math.min(MAX_BURN, target.burnStacks + amount)
  if (!target.nextBurnAtMs) target.nextBurnAtMs = state.timeMs + 2_000
  events.push({ type: 'status_changed', targetId: target.id, status: 'burn', value: target.burnStacks, atMs: state.timeMs })
}

function paperBrideShield(state: BattleState, sourceId: UnitId | CardId, stacks: number, events: BattleEvent[]) {
  if (state.spirits.some((spirit) => spirit.id === 'paper_bride' && spirit.hp > 0)) addShield(state, sourceId, state.leader, stacks * 3, events)
}

function detonateMarks(state: BattleState, sourceId: CardId, target: UnitState, limit: number, events: BattleEvent[]) {
  const consumed = Math.min(target.talismanMarks, limit)
  if (!consumed) return 0
  target.talismanMarks -= consumed
  if (!target.talismanMarks) target.talismanExpiresAtMs = 0
  events.push({ type: 'status_changed', targetId: target.id, status: 'talisman_mark', value: target.talismanMarks, atMs: state.timeMs })
  dealFlatDamage(state, sourceId, target, consumed * 14, events)
  paperBrideShield(state, sourceId, consumed, events)
  return consumed
}

function lowestBondIndex(state: BattleState) { return state.spiritBonds[0] <= state.spiritBonds[1] ? 0 : 1 }

function spiritComboBonus(state: BattleState, index: number, events: BattleEvent[]) {
  const spirit = state.spirits[index]
  const enemy = currentEnemy(state)
  if (!enemy) return
  switch (spirit.id) {
    case 'iron_beak_crane': addArmorBreak(state, enemy, 1, events); break
    case 'paper_bride': addShield(state, spirit.id, state.leader, 12, events); break
    case 'lantern_ghost': addBurn(state, enemy, 1, events); break
    case 'mountain_child': addShield(state, spirit.id, state.leader, 18, events); break
    case 'dream_tapir': {
      const highest = [...state.hand].sort((a, b) => PROTOTYPE_CONTENT.cards[b].cost - PROTOTYPE_CONTENT.cards[a].cost)[0]
      state.discountedCardId = highest
      break
    }
  }
}

function triggerSpiritCombo(state: BattleState, index: number, events: BattleEvent[]) {
  const spirit = state.spirits[index]
  const enemy = currentEnemy(state)
  if (!enemy || spirit.hp <= 0) return
  events.push({ type: 'unit_action', unitId: spirit.id, action: '灵契协击', atMs: state.timeMs })
  dealDamage(state, spirit.id, spirit.attack, enemy, 130 + state.spiritComboDamageBonus, events)
  state.spiritComboCounts[index] += 1
  state.totalSpiritCombos += 1
  spiritComboBonus(state, index, events)
  if (state.copyNextSpiritCombo) {
    state.copyNextSpiritCombo = false
    spiritComboBonus(state, index, events)
  }
  if (state.activeCombos.includes('spirit_edict') && enemy.talismanMarks > 0) {
    state.nextEdictDiscount = 1
    events.push({ type: 'combo_triggered', comboId: 'spirit_edict', atMs: state.timeMs })
  }
  if (state.activeCombos.includes('dual_spirit_sword')) {
    gainSwordIntent(state, 1, events)
    events.push({ type: 'combo_triggered', comboId: 'dual_spirit_sword', atMs: state.timeMs })
  }
  if (state.techniqueId === 'hundred_spirit_codex' && !state.firstSpiritComboTriggered[index]) {
    state.firstSpiritComboTriggered[index] = true
    gainBond(state, index, 1, events)
  }
}

function gainBond(state: BattleState, index: number, amount: number, events: BattleEvent[]) {
  if (state.spirits[index].hp <= 0) return
  state.spiritBonds[index] += amount
  while (state.spiritBonds[index] >= 3 && state.status === 'active') {
    state.spiritBonds[index] -= 3
    events.push({ type: 'status_changed', targetId: state.spirits[index].id, status: 'spirit_bond', value: state.spiritBonds[index], atMs: state.timeMs })
    triggerSpiritCombo(state, index, events)
  }
  events.push({ type: 'status_changed', targetId: state.spirits[index].id, status: 'spirit_bond', value: state.spiritBonds[index], atMs: state.timeMs })
}

function afterSwordHit(state: BattleState, events: BattleEvent[]) {
  if (!state.activeCombos.includes('dual_spirit_sword') || state.timeMs < state.dualSpiritSwordReadyAtMs) return
  gainBond(state, lowestBondIndex(state), 1, events)
  state.dualSpiritSwordReadyAtMs = state.timeMs + 6_000
  events.push({ type: 'combo_triggered', comboId: 'dual_spirit_sword', atMs: state.timeMs })
}

export function getEffectiveCardCost(state: BattleState, card: CardDefinition) {
  let discount = 0
  if (card.id === 'mountain_splitter') discount += state.nextFinisherDiscount
  if (card.tags.includes('talisman') && state.talismanDiscountCharges > 0) discount += 1
  if (card.kind === '敕令') discount += state.nextEdictDiscount
  if (card.id === state.discountedCardId) discount += 1
  return Math.max(0, card.cost - discount)
}

function validTarget(state: BattleState, card: CardDefinition, targetId: UnitId | undefined, automatic: boolean) {
  if (card.targetRule !== 'chosen_spirit') return true
  if (automatic && !targetId) return true
  return state.spirits.some((spirit) => spirit.id === targetId && spirit.hp > 0)
}

function applyCardEffect(state: BattleState, card: CardDefinition, targetId: UnitId | undefined, events: BattleEvent[]) {
  const enemy = currentEnemy(state)
  const power = card.powerPercent ?? 100
  switch (card.effectId) {
    case 'sword_strike':
      if (enemy) dealDamage(state, card.id, state.leader.attack, enemy, power, events)
      gainSwordIntent(state, card.swordIntent ?? 0, events)
      break
    case 'prime_sword_intent':
      addShield(state, card.id, state.leader, card.shield ?? 0, events)
      state.nextSwordIntentBonus = 1
      break
    case 'sword_multi_hit':
      if (enemy) for (let hit = 0; hit < (card.hits ?? 2); hit += 1) dealDamage(state, card.id, state.leader.attack, enemy, power + hit * (card.id === 'flowing_cloud_slashes' ? 15 : hit ? state.swordCardsPlayed.length * 10 : 0), events)
      break
    case 'armor_break_strike':
      if (enemy) { dealDamage(state, card.id, state.leader.attack, enemy, power, events); addArmorBreak(state, enemy, card.armorBreak ?? 0, events) }
      break
    case 'sword_refund':
      if (enemy) dealDamage(state, card.id, state.leader.attack, enemy, power, events)
      if (state.swordIntent >= 6) gainEnergy(state, 1, events)
      break
    case 'sword_intent_barrage':
      if (enemy) for (let hit = 0; hit < Math.max(1, state.swordIntent); hit += 1) dealDamage(state, card.id, state.leader.attack, enemy, power, events)
      break
    case 'sword_finisher': {
      const consumed = state.swordIntent
      if (enemy) {
        dealDamage(state, card.id, state.leader.attack, enemy, power + consumed * 45, events)
        if (state.activeCombos.includes('flying_sword_seal')) {
          detonateMarks(state, card.id, enemy, Math.floor(consumed / 3), events)
          events.push({ type: 'combo_triggered', comboId: 'flying_sword_seal', atMs: state.timeMs })
        }
      }
      state.swordIntent = 0
      events.push({ type: 'status_changed', targetId: 'battle', status: 'sword_intent', value: 0, atMs: state.timeMs })
      const crane = state.spirits.find((spirit) => spirit.id === 'iron_beak_crane')
      if (crane) crane.nextActionAtMs = Math.max(state.timeMs, crane.nextActionAtMs - 1_500)
      break
    }
    case 'apply_marks_and_burn': if (enemy) { addMarks(state, enemy, card.marks ?? 0, events); addBurn(state, enemy, card.burn ?? 0, events) }; break
    case 'shield_and_mark': if (enemy) addMarks(state, enemy, card.marks ?? 0, events); addShield(state, card.id, state.leader, card.shield ?? 0, events); break
    case 'mark_scaled_strike': if (enemy) dealDamage(state, card.id, state.leader.attack, enemy, power + enemy.talismanMarks * 25, events); break
    case 'bind_shadow': if (enemy) { addMarks(state, enemy, card.marks ?? 0, events); enemy.nextActionAtMs += card.delayMs ?? 0 }; break
    case 'life_from_mark': {
      const ally = [state.leader, ...state.spirits].filter((unit) => unit.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      let amount = card.heal ?? 0
      if (enemy?.talismanMarks) { enemy.talismanMarks -= 1; amount += 18; events.push({ type: 'status_changed', targetId: enemy.id, status: 'talisman_mark', value: enemy.talismanMarks, atMs: state.timeMs }) }
      heal(state, card.id, ally, amount, events)
      break
    }
    case 'prime_talisman_discount': state.talismanDiscountCharges = 2; break
    case 'detonate_marks': {
      const consumed = enemy ? detonateMarks(state, card.id, enemy, MAX_MARKS, events) : 0
      if (state.techniqueId === 'edict_talisman_codex' && consumed >= 3) gainEnergy(state, 1, events)
      const lantern = state.spirits.find((spirit) => spirit.id === 'lantern_ghost')
      if (enemy && lantern && enemy.burnStacks > 0) tickBurn(state, enemy, events)
      break
    }
    case 'storm_edict':
      state.enemies.filter((unit) => unit.hp > 0).forEach((unit) => { dealDamage(state, card.id, state.leader.attack, unit, power, events); detonateMarks(state, card.id, unit, 3, events) })
      break
    case 'gain_lowest_bond': gainBond(state, lowestBondIndex(state), 1, events); break
    case 'share_spirit_breath': state.spirits.forEach((spirit) => heal(state, card.id, spirit, card.heal ?? 0, events)); gainEnergy(state, 1, events); break
    case 'spirit_basic_attacks': if (enemy) state.spirits.forEach((spirit) => dealDamage(state, spirit.id, spirit.attack, enemy, power, events)); break
    case 'protect_master': {
      const index = Math.max(0, state.spirits.findIndex((spirit) => spirit.id === targetId))
      addShield(state, state.spirits[index].id, state.leader, card.shield ?? 0, events)
      gainBond(state, index, 1, events)
      break
    }
    case 'spirit_tide': if (enemy) state.spirits.forEach((spirit) => dealDamage(state, spirit.id, spirit.attack, enemy, power + (enemy.armorBreak || enemy.talismanMarks || enemy.burnStacks ? 40 : 0), events)); break
    case 'copy_spirit_combo': state.copyNextSpiritCombo = true; break
    case 'mass_spirit_bond': state.spiritComboDamageBonus += 20; gainBond(state, 0, 2, events); gainBond(state, 1, 2, events); break
    case 'spirit_combo_finisher':
      if (enemy) for (let hit = 0; hit < Math.max(2, state.totalSpiritCombos); hit += 1) dealDamage(state, card.id, state.leader.attack, enemy, power, events)
      gainBond(state, 0, 1, events); gainBond(state, 1, 1, events)
      break
  }
}

function consumeDiscounts(state: BattleState, card: CardDefinition) {
  if (card.id === 'mountain_splitter' && state.nextFinisherDiscount) state.nextFinisherDiscount = 0
  if (card.tags.includes('talisman') && state.talismanDiscountCharges > 0) state.talismanDiscountCharges -= 1
  if (card.kind === '敕令' && state.nextEdictDiscount) state.nextEdictDiscount = 0
  if (card.id === state.discountedCardId) state.discountedCardId = undefined
}

function playCard(state: BattleState, cardId: CardId, targetId: UnitId | undefined, content: BattleContent, events: BattleEvent[], automatic: boolean) {
  const handIndex = state.hand.indexOf(cardId)
  const card = content.cards[cardId]
  const resolvedTarget = targetId ?? (automatic && card.targetRule === 'chosen_spirit' ? state.spirits[lowestBondIndex(state)].id : undefined)
  const cost = getEffectiveCardCost(state, card)
  if (state.status !== 'active' || handIndex < 0 || state.energy < cost || !validTarget(state, card, resolvedTarget, automatic)) return false
  state.energy -= cost
  consumeDiscounts(state, card)
  state.hand.splice(handIndex, 1)
  state.discard.push(cardId)
  state.cardsPlayed += 1
  events.push({ type: 'energy_changed', value: state.energy, atMs: state.timeMs })
  events.push({ type: 'card_played', cardId, automatic, targetId: resolvedTarget, atMs: state.timeMs })
  applyCardEffect(state, card, resolvedTarget, events)

  const tag = card.tags[0]
  state.sameTagStreak = state.lastPlayerCardTag === tag ? state.sameTagStreak + 1 : 1
  state.lastPlayerCardTag = tag
  if (state.sameTagStreak >= 3) {
    state.sameTagStreak = 0
    state.enemies.filter((enemy) => enemy.id === 'hundred_eyed_branch' && enemy.hp > 0).forEach((enemy) => {
      enemy.shield += 25
      events.push({ type: 'enemy_buff', targetId: enemy.id as EnemyId, status: 'adaptation_shield', value: enemy.shield, atMs: state.timeMs })
    })
  }

  if (card.kind === '剑式') {
    if (!state.swordCardsPlayed.includes(cardId)) state.swordCardsPlayed.push(cardId)
    afterSwordHit(state, events)
    if (state.techniqueId === 'hidden_edge_art') {
      state.swordCardStreak += 1
      if (state.swordCardStreak >= 3) { state.swordCardStreak = 0; state.nextFinisherDiscount = 1 }
    }
  } else state.swordCardStreak = 0

  const fox = state.spirits.find((spirit) => spirit.id === 'blade_tail_fox' && spirit.hp > 0)
  if (fox && state.status === 'active' && state.cardsPlayed % 3 === 0) {
    events.push({ type: 'unit_action', unitId: fox.id, action: '刃尾追击', atMs: state.timeMs })
    const target = currentEnemy(state)
    if (target) dealDamage(state, fox.id, fox.attack, target, 65, events)
  }
  if (state.status === 'active') drawOne(state, events)
  return true
}

function autoAction(state: BattleState, unit: UnitState, events: BattleEvent[]) {
  if (unit.hp <= 0 || state.status !== 'active') return
  const enemy = currentEnemy(state)
  if (unit.id === 'leader') {
    if (!enemy) return
    const weaponName = PROTOTYPE_CONTENT.weapons[state.weaponId].name
    events.push({ type: 'unit_action', unitId: unit.id, action: weaponName, atMs: state.timeMs })
    dealDamage(state, unit.id, unit.attack, enemy, 100, events)
    state.basicAttackCount += 1
    if (state.weaponId === 'azure_wind_sword' && state.basicAttackCount % 4 === 0) gainSwordIntent(state, 1, events)
    if (state.weaponId === 'cinnabar_brush' && enemy.talismanMarks > 0) enemy.talismanExpiresAtMs = Math.min(enemy.talismanExpiresAtMs + 1_000, state.timeMs + 12_000)
  } else if (state.enemies.some((target) => target === unit)) {
    unit.actionCount += 1
    events.push({ type: 'unit_action', unitId: unit.id, action: unit.title, atMs: state.timeMs })
    switch (unit.behaviorId) {
      case 'withered_vine_spirit':
        dealDamage(state, unit.id, unit.attack, state.leader, 70, events)
        if (unit.actionCount % 2 === 0) addShield(state, unit.id, unit, Math.floor(unit.maxHp * 0.18), events)
        break
      case 'corpse_lantern_moth': {
        dealDamage(state, unit.id, unit.attack, state.leader, 70, events)
        const ally = [state.leader, ...state.spirits].filter((target) => target.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
        if (ally) addBurn(state, ally, 1, events)
        break
      }
      case 'title_seeking_immortal': {
        dealDamage(state, unit.id, unit.attack, state.leader, 90, events)
        if (unit.actionCount <= 5) {
          const gained = Math.max(1, Math.floor(unit.attack * 0.1))
          unit.attack += gained
          unit.attackBonusPercent += 10
          events.push({ type: 'enemy_buff', targetId: unit.id as EnemyId, status: 'attack', value: unit.attack, atMs: state.timeMs })
        }
        break
      }
      case 'night_wandering_thrall': {
        const target = state.spirits.filter((spirit) => spirit.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? state.leader
        dealDamage(state, unit.id, unit.attack, target, 110, events)
        break
      }
      case 'grave_crow_flock': for (let hit = 0; hit < 3; hit += 1) dealDamage(state, unit.id, unit.attack, state.leader, 45, events); break
      case 'headless_woodcutter': dealDamage(state, unit.id, unit.attack, state.leader, 220, events); break
      default: dealDamage(state, unit.id, unit.attack, state.leader, 100, events)
    }
  } else if (enemy) {
    events.push({ type: 'unit_action', unitId: unit.id, action: unit.title, atMs: state.timeMs })
    switch (unit.id as SpiritId) {
      case 'blade_tail_fox': dealDamage(state, unit.id, unit.attack, enemy, 55, events); dealDamage(state, unit.id, unit.attack, enemy, 55, events); break
      case 'iron_beak_crane': dealDamage(state, unit.id, unit.attack, enemy, 150, events); addArmorBreak(state, enemy, 1, events); break
      case 'paper_bride': addMarks(state, enemy, 1, events); addShield(state, unit.id, state.leader, 10, events); break
      case 'lantern_ghost': dealDamage(state, unit.id, unit.attack, enemy, 80, events); addBurn(state, enemy, 1, events); break
      case 'mountain_child': addShield(state, unit.id, state.leader, 18, events); break
      case 'dream_tapir': dealDamage(state, unit.id, unit.attack, enemy, 60, events); gainEnergy(state, 1, events); break
    }
  }
}

function tickBurn(state: BattleState, target: UnitState, events: BattleEvent[]) {
  if (!target.burnStacks || target.hp <= 0) return
  dealFlatDamage(state, 'burn', target, target.burnStacks * 5, events)
  target.burnStacks -= 1
  target.nextBurnAtMs = target.burnStacks ? state.timeMs + 2_000 : 0
  events.push({ type: 'status_changed', targetId: target.id, status: 'burn', value: target.burnStacks, atMs: state.timeMs })
}

function advanceStep(state: BattleState, content: BattleContent, events: BattleEvent[]) {
  if (state.status !== 'active') return
  state.timeMs += STEP_MS
  if (state.energy < state.maxEnergy) {
    state.energyProgressMs += STEP_MS
    if (state.energyProgressMs >= 1_000) { state.energyProgressMs -= 1_000; gainEnergy(state, 1, events) }
  } else state.energyProgressMs = 0

  for (const unit of [state.leader, ...state.spirits, ...state.enemies]) {
    if (unit.talismanMarks > 0 && state.timeMs >= unit.talismanExpiresAtMs) {
      unit.talismanMarks = 0
      unit.talismanExpiresAtMs = 0
      events.push({ type: 'status_changed', targetId: unit.id, status: 'talisman_mark', value: 0, atMs: state.timeMs })
    }
    if (unit.burnStacks > 0 && state.timeMs >= unit.nextBurnAtMs) tickBurn(state, unit, events)
  }

  for (const actor of [state.leader, ...state.spirits, ...state.enemies]) {
    if (state.status !== 'active') break
    if (actor.hp > 0 && state.timeMs >= actor.nextActionAtMs) { autoAction(state, actor, events); actor.nextActionAtMs += actor.attackIntervalMs }
  }

  if (state.autoplay && state.status === 'active') {
    const cardId = state.autoplayPriority.find((id) => state.hand.includes(id) && getEffectiveCardCost(state, content.cards[id]) <= state.energy)
    if (cardId) playCard(state, cardId, undefined, content, events, true)
  }
}

function validPriority(cardIds: CardId[], state: BattleState, content: BattleContent) {
  const deck = content.builds[state.buildId].cardIds
  return cardIds.length === deck.length && new Set(cardIds).size === deck.length && deck.every((id) => cardIds.includes(id))
}

export function transitionBattle(current: BattleState, command: BattleCommand, content: BattleContent = PROTOTYPE_CONTENT): BattleTransition {
  if (command.type === 'restart') {
    const state = createBattle(command.seed ?? current.seed, content, command.buildId ?? current.buildId)
    return { state, events: [{ type: 'battle_started', seed: state.seed, buildId: state.buildId, atMs: 0 }] }
  }
  const state = cloneState(current)
  const events: BattleEvent[] = []
  switch (command.type) {
    case 'advance':
      for (let step = 0; step < Math.max(0, Math.floor(command.elapsedMs / STEP_MS)); step += 1) advanceStep(state, content, events)
      break
    case 'play_card': playCard(state, command.cardId, command.targetId, content, events, false); break
    case 'set_autoplay': state.autoplay = command.enabled; break
    case 'reorder_priority': if (validPriority(command.cardIds, state, content)) state.autoplayPriority = [...command.cardIds]; break
  }
  return { state, events }
}

export function startNextWave(current: BattleState, enemies: readonly EnemyDefinition[], waveNumber: number): BattleTransition {
  const state = cloneState(current)
  state.status = 'active'
  state.enemies = enemies.map(makeUnit)
  state.enemies.forEach((enemy) => { enemy.nextActionAtMs += state.timeMs })
  return { state, events: [{ type: 'wave_started', waveNumber, atMs: state.timeMs }] }
}
