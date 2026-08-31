import { uniformInt } from 'pure-rand/distribution/uniformInt'
import { xoroshiro128plus, xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import type { Archetype, BattleCardInstance, BattleCardReference, BattleCommand, BattleContent, BattleEvent, BattleSetup, BattleState, BattleTransition, BuildId, CardDefinition, CardId, ComboId, EnemyDefinition, EnemyId, SpiritId, UnitDefinition, UnitId, UnitState } from './types'

const STEP_MS = 250
const MAX_HAND = 4
const MAX_ARMOR_BREAK = 5
const MAX_MARKS = 6
const MAX_BURN = 6
type SourceId = string
type CardRef = BattleCardReference

export function isBattleCardInstance(value: CardRef): value is BattleCardInstance {
  return typeof value !== 'string'
}

export function getCardId(value: CardRef): CardId {
  return isBattleCardInstance(value) ? value.cardId : value
}

export function createBattleCardInstance(cardId: CardId, instanceId: string = cardId, upgraded = false, exhaust = false): BattleCardInstance {
  const instance = { instanceId, cardId, upgraded, exhaust }
  // Keep legacy object-key consumers working without putting a function in serialized state.
  Object.defineProperty(instance, 'toString', { value: () => cardId, enumerable: false })
  return instance
}

function cloneCardRef(value: CardRef): CardRef {
  return isBattleCardInstance(value) ? createBattleCardInstance(value.cardId, value.instanceId, value.upgraded, value.exhaust) : value
}

function cardRefAt<T extends CardRef>(cards: readonly T[], cardInstanceId: string | undefined, cardId: CardId | undefined) {
  if (cardInstanceId) {
    const index = cards.findIndex((value) => isBattleCardInstance(value) && value.instanceId === cardInstanceId)
    return index < 0 ? undefined : { value: cards[index], index }
  }
  if (!cardId) return undefined
  const index = cards.findIndex((value) => getCardId(value) === cardId)
  return index < 0 ? undefined : { value: cards[index], index }
}

function makeUnit(definition: UnitDefinition): UnitState {
  return { ...definition, hp: definition.maxHp, shield: 0, armorBreak: 0, nextActionAtMs: definition.attackIntervalMs, talismanMarks: 0, talismanExpiresAtMs: 0, burnStacks: 0, nextBurnAtMs: 0, actionCount: 0, attackBonusPercent: 0, deathEffectTriggered: false, summonTriggered: false }
}

function shuffle<T>(cards: readonly T[], rngState: readonly number[]) {
  const next = [...cards]
  const rng = xoroshiro128plusFromState(rngState)
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = uniformInt(rng, 0, index)
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return { cards: next, rngState: [...rng.getState()] }
}

function drawOne(state: BattleState<CardRef>, events: BattleEvent[]) {
  if (state.hand.length >= MAX_HAND) return
  if (state.deck.length === 0 && state.discard.length > 0) {
    const shuffled = shuffle(state.discard, state.rngState)
    state.deck = shuffled.cards
    state.rngState = shuffled.rngState
    state.discard = []
  }
  const card = state.deck.shift()
  if (!card) return
  state.hand.push(card)
  events.push({ type: 'card_drawn', cardId: getCardId(card), ...(isBattleCardInstance(card) ? { instanceId: card.instanceId } : {}), atMs: state.timeMs })
}

function cloneState(state: BattleState<CardRef>): BattleState<CardRef> {
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
    deck: state.deck.map(cloneCardRef),
    hand: state.hand.map(cloneCardRef),
    discard: state.discard.map(cloneCardRef),
    autoplayPriority: [...state.autoplayPriority],
    battleSetup: state.battleSetup && cloneSetup(state.battleSetup),
    consumableUses: { ...state.consumableUses },
    cardTagCounts: { ...state.cardTagCounts },
    equipmentIds: [...state.equipmentIds],
    affixIds: [...state.affixIds],
    playedCardIds: [...state.playedCardIds],
  }
}

function cloneSetup(setup: BattleSetup): BattleSetup {
  return {
    ...setup,
    deck: setup.deck?.map(cloneCardRef),
    hand: setup.hand?.map(cloneCardRef),
    discard: setup.discard?.map(cloneCardRef),
    cardInstances: setup.cardInstances?.map(cloneCardRef),
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

export function createBattle(seed: number, content?: BattleContent, buildId?: BuildId): BattleState<CardId>
export function createBattle(seed: number, content: BattleContent, setup: BattleSetup): BattleState<BattleCardInstance>
export function createBattle(seed: number, content: BattleContent = PROTOTYPE_CONTENT, buildOrSetup: BuildId | BattleSetup = content.defaultBuildId): BattleState<CardRef> {
  const setup = typeof buildOrSetup === 'string' ? undefined : buildOrSetup
  const buildId = setup?.buildId ?? (typeof buildOrSetup === 'string' ? buildOrSetup : content.defaultBuildId)
  const build = content.builds[buildId]
  const weapon = content.weapons[build.weaponId]
  const technique = content.techniques[build.techniqueId]
  const legacyCards = !setup
  const sourceCards = setup?.cardInstances ?? setup?.deck ?? build.cardIds
  const sourceInstances = setup ? sourceCards.map((value, index) => typeof value === 'string' ? createBattleCardInstance(value, `${value}:${index}`) : cloneCardRef(value)) : sourceCards
  const shuffled = shuffle(sourceInstances, xoroshiro128plus(seed).getState())
  const setupHand = setup?.hand?.map((value) => typeof value === 'string' ? createBattleCardInstance(value) : cloneCardRef(value))
  const setupDiscard = setup?.discard?.map((value) => typeof value === 'string' ? createBattleCardInstance(value) : cloneCardRef(value))
  const leader = makeUnit({ ...content.leader, title: `${weapon.name} · ${technique.name}`, attackIntervalMs: weapon.attackIntervalMs })
  const spirits = build.spiritIds.map((id) => makeUnit(content.spirits[id])) as [UnitState, UnitState]
  if (build.weaponId === 'spirit_bell') spirits.forEach((spirit) => { spirit.nextActionAtMs = Math.max(STEP_MS, spirit.attackIntervalMs - 1_500) })
  const normalizedSetup = setup && {
    ...cloneSetup(setup),
    buildId,
    deck: sourceInstances.map(cloneCardRef),
    hand: setupHand?.map(cloneCardRef),
    discard: setupDiscard?.map(cloneCardRef),
  }
  const modifiers = content.modifiers
  const equipmentIds = [...(modifiers?.equipmentIds ?? [])]
  const affixIds = [...(modifiers?.affixIds ?? [])]
  const has = (id: string) => equipmentIds.includes(id)
  const openingEnergy = affixIds.filter((id) => id === 'opening_energy').length
  const treasureId = setup?.treasureId ?? modifiers?.treasureId
  const consumableIds = setup?.consumableIds ?? modifiers?.consumableIds ?? []
  const consumableUses = Object.fromEntries(consumableIds.map((id) => [id, Math.max(0, setup?.consumableUses?.[id] ?? 2)]))
  const state: BattleState<CardRef> = {
    seed, rngState: shuffled.rngState, timeMs: 0, status: 'active', buildId,
    weaponId: build.weaponId, techniqueId: build.techniqueId, activeCombos: activeCombos(content, buildId),
    leader, spirits, enemies: content.enemies.map(makeUnit),
    energy: Math.min(10, 3 + openingEnergy), maxEnergy: 10, energyProgressMs: 0,
    swordIntent: 0, swordIntentCap: has('equipment_hidden_edge_jade') ? 12 : 10, nextSwordIntentBonus: 0, swordCardStreak: 0, nextFinisherDiscount: 0,
    talismanDiscountCharges: 0, nextEdictDiscount: 0,
    spiritBonds: [0, 0], spiritComboCounts: [0, 0], firstSpiritComboTriggered: [false, false], totalSpiritCombos: 0,
    spiritComboDamageBonus: 0, copyNextSpiritCombo: false, dualSpiritSwordReadyAtMs: 0,
    basicAttackCount: 0, cardsPlayed: 0, swordCardsPlayed: [], sameTagStreak: 0,
    deck: shuffled.cards,
    hand: setupHand ?? [],
    discard: setupDiscard ?? [],
    autoplay: false,
    autoplayPriority: [...(build.autoplayPriority ?? build.cardIds)],
    battleSetup: normalizedSetup,
    bossPhase: content.enemies.some((enemy) => enemy.id === 'ancient_huai_matriarch') ? 'rooted' : undefined,
    cardTagCounts: { sword: 0, talisman: 0, spirit: 0 },
    treasureId,
    treasureCharge: Math.max(0, setup?.treasureCharge ?? 0),
    treasureMaxCharge: Math.max(0, setup?.treasureMaxCharge ?? 3),
    consumableUses,
    equipmentIds,
    affixIds,
    cardDiscountCharges: (affixIds.includes('tag_discount') ? 1 : 0) + (has('equipment_wind_chasing_shoes') ? 1 : 0),
    playedCardIds: [],
    talismanCardStreak: 0,
    firstCardShieldGranted: false,
    meridianGuardTriggered: false,
    lastSpiritActionAtMs: -1_000_000_000,
  }
  if (has('equipment_hundred_beast_circlet')) state.spiritBonds = [1, 1]
  const ignored: BattleEvent[] = []
  if (!setupHand) while (state.hand.length < MAX_HAND && (state.deck.length > 0 || state.discard.length > 0)) drawOne(state, ignored)
  if (!legacyCards && normalizedSetup) {
    normalizedSetup.deck = state.deck.map(cloneCardRef)
    normalizedSetup.hand = state.hand.map(cloneCardRef)
    normalizedSetup.discard = state.discard.map(cloneCardRef)
  }
  return state
}

function currentEnemy(state: BattleState<CardRef>) { return state.enemies.find((enemy) => enemy.hp > 0) }
function effectiveDefense(unit: UnitState) { return Math.max(0, unit.defense - Math.floor(unit.defense * unit.armorBreak * 0.05)) }

function currentBoss(state: BattleState<CardRef>) { return state.enemies.find((enemy) => enemy.id === 'ancient_huai_matriarch' && enemy.hp > 0) }
function hasModifier(state: BattleState<CardRef>, id: string) { return state.equipmentIds.includes(id) || state.affixIds.includes(id) }

function updateBossPhase(state: BattleState<CardRef>, events: BattleEvent[]) {
  const boss = currentBoss(state)
  if (!boss) return
  const phase = boss.hp * 100 > boss.maxHp * 66 ? 'rooted' : boss.hp * 100 > boss.maxHp * 33 ? 'reflection' : 'huai_trial'
  if (state.bossPhase === phase) return
  state.bossPhase = phase
  if (phase === 'huai_trial') {
    state.bossDominantTag = (['sword', 'talisman', 'spirit'] as const).reduce((best, tag) => state.cardTagCounts[tag] > state.cardTagCounts[best] ? tag : best, 'sword')
  }
  events.push({ type: 'boss_phase_changed', phase, atMs: state.timeMs })
}

function sourceTag(state: BattleState<CardRef>, sourceId: string): Archetype | undefined {
  if (sourceId in PROTOTYPE_CONTENT.cards) return PROTOTYPE_CONTENT.cards[sourceId as CardId].tags[0]
  if (sourceId in PROTOTYPE_CONTENT.spirits) return PROTOTYPE_CONTENT.spirits[sourceId as SpiritId].tags[0]
  if (sourceId === state.leader.id) return PROTOTYPE_CONTENT.weapons[state.weaponId].tag
  return undefined
}

function finishIfNeeded(state: BattleState<CardRef>, events: BattleEvent[]) {
  if (state.status !== 'active') return
  if (state.enemies.every((enemy) => enemy.hp <= 0)) {
    state.status = 'victory'
    events.push({ type: 'battle_ended', result: 'victory', atMs: state.timeMs })
  } else if (state.leader.hp <= 0) {
    state.status = 'defeat'
    events.push({ type: 'battle_ended', result: 'defeat', atMs: state.timeMs })
  }
}

function applyIncoming(state: BattleState<CardRef>, sourceId: SourceId, target: UnitState, incoming: number, events: BattleEvent[]) {
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
  if (target.id === 'leader' && !state.meridianGuardTriggered && target.hp > 0 && target.hp * 100 <= target.maxHp * 30) {
    const consumableId = 'consumable_meridian_guard_pill'
    if ((state.consumableUses[consumableId] ?? 0) > 0) {
      state.meridianGuardTriggered = true
      state.consumableUses[consumableId] -= 1
      addShield(state, consumableId, target, 40, events)
      events.push({ type: 'consumable_used', consumableId, remainingUses: state.consumableUses[consumableId], targetId: target.id, atMs: state.timeMs })
    }
  }
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
  updateBossPhase(state, events)
  finishIfNeeded(state, events)
}

function dealDamage(state: BattleState<CardRef>, sourceId: SourceId, sourceAttack: number, target: UnitState, powerPercent: number, events: BattleEvent[]) {
  let adjustedPower = powerPercent
  if (target.id === 'ancient_huai_matriarch' && state.bossDominantTag) adjustedPower = sourceTag(state, sourceId) === state.bossDominantTag ? Math.floor(powerPercent * 75 / 100) : Math.floor(powerPercent * 110 / 100)
  const raw = Math.floor((sourceAttack * adjustedPower) / (100 + effectiveDefense(target)))
  applyIncoming(state, sourceId, target, Math.max(1, raw), events)
}

function dealFlatDamage(state: BattleState<CardRef>, sourceId: SourceId, target: UnitState, amount: number, events: BattleEvent[]) {
  applyIncoming(state, sourceId, target, Math.max(1, amount), events)
}

function addShield(state: BattleState<CardRef>, sourceId: string, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0 || state.status !== 'active') return
  if (hasModifier(state, 'shield_power')) amount = Math.floor(amount * 108 / 100)
  target.shield += amount
  events.push({ type: 'shield', sourceId, targetId: target.id, amount, atMs: state.timeMs })
}

function heal(state: BattleState<CardRef>, sourceId: string, target: UnitState, amount: number, events: BattleEvent[]) {
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

function gainEnergy(state: BattleState<CardRef>, amount: number, events: BattleEvent[]) {
  state.energy = Math.min(state.maxEnergy, state.energy + amount)
  events.push({ type: 'energy_changed', value: state.energy, atMs: state.timeMs })
}

function gainSwordIntent(state: BattleState<CardRef>, amount: number, events: BattleEvent[]) {
  const bonus = state.nextSwordIntentBonus
  state.nextSwordIntentBonus = 0
  state.swordIntent = Math.min(state.swordIntentCap, state.swordIntent + amount + bonus)
  events.push({ type: 'status_changed', targetId: 'battle', status: 'sword_intent', value: state.swordIntent, atMs: state.timeMs })
}

function addArmorBreak(state: BattleState<CardRef>, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0) return
  target.armorBreak = Math.min(MAX_ARMOR_BREAK, target.armorBreak + amount)
  events.push({ type: 'status_changed', targetId: target.id, status: 'armor_break', value: target.armorBreak, atMs: state.timeMs })
}

function addMarks(state: BattleState<CardRef>, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0) return
  const bonus = hasModifier(state, 'equipment_cinnabar_crown') && target.talismanMarks === 0 ? 1 : 0
  const overflow = Math.max(0, target.talismanMarks + amount + bonus - MAX_MARKS)
  target.talismanMarks = Math.min(MAX_MARKS, target.talismanMarks + amount + bonus)
  if (overflow && hasModifier(state, 'equipment_thunder_coin')) addBurn(state, target, overflow, events)
  target.talismanExpiresAtMs = state.timeMs + 10_000
  events.push({ type: 'status_changed', targetId: target.id, status: 'talisman_mark', value: target.talismanMarks, atMs: state.timeMs })
}

function addBurn(state: BattleState<CardRef>, target: UnitState, amount: number, events: BattleEvent[]) {
  if (target.hp <= 0) return
  target.burnStacks = Math.min(MAX_BURN, target.burnStacks + amount)
  if (!target.nextBurnAtMs) target.nextBurnAtMs = state.timeMs + 2_000
  events.push({ type: 'status_changed', targetId: target.id, status: 'burn', value: target.burnStacks, atMs: state.timeMs })
}

function paperBrideShield(state: BattleState<CardRef>, sourceId: string, stacks: number, events: BattleEvent[]) {
  if (state.spirits.some((spirit) => spirit.id === 'paper_bride' && spirit.hp > 0)) addShield(state, sourceId, state.leader, stacks * 3, events)
}

function detonateMarks(state: BattleState<CardRef>, sourceId: string, target: UnitState, limit: number, events: BattleEvent[]) {
  const consumed = Math.min(target.talismanMarks, limit)
  if (!consumed) return 0
  target.talismanMarks -= consumed
  if (!target.talismanMarks) target.talismanExpiresAtMs = 0
  events.push({ type: 'status_changed', targetId: target.id, status: 'talisman_mark', value: target.talismanMarks, atMs: state.timeMs })
  dealFlatDamage(state, sourceId, target, Math.floor(consumed * 14 * (hasModifier(state, 'mark_burst_power') || hasModifier(state, 'equipment_thunder_coin') ? 108 : 100) / 100), events)
  paperBrideShield(state, sourceId, consumed, events)
  if (hasModifier(state, 'equipment_talisman_silk_robe')) addShield(state, sourceId, state.leader, consumed * 2, events)
  return consumed
}

function lowestBondIndex(state: BattleState<CardRef>) {
  const firstAlive = state.spirits.findIndex((spirit) => spirit.hp > 0)
  if (firstAlive < 0) return 0
  return state.spirits.reduce((lowest, spirit, index) => spirit.hp > 0 && state.spiritBonds[index] < state.spiritBonds[lowest] ? index : lowest, firstAlive)
}

function spiritComboBonus(state: BattleState<CardRef>, index: number, events: BattleEvent[]) {
  const spirit = state.spirits[index]
  const enemy = currentEnemy(state)
  if (!enemy) return
  switch (spirit.id) {
    case 'iron_beak_crane': addArmorBreak(state, enemy, 1, events); break
    case 'paper_bride': addShield(state, spirit.id, state.leader, 12, events); break
    case 'lantern_ghost': addBurn(state, enemy, 1, events); break
    case 'mountain_child': addShield(state, spirit.id, state.leader, 18, events); break
    case 'dream_tapir': {
      const highest = [...state.hand].sort((a, b) => PROTOTYPE_CONTENT.cards[getCardId(b)].cost - PROTOTYPE_CONTENT.cards[getCardId(a)].cost)[0]
      state.discountedCardId = highest && getCardId(highest)
      break
    }
  }
}

function triggerSpiritCombo(state: BattleState<CardRef>, index: number, events: BattleEvent[]) {
  const spirit = state.spirits[index]
  const enemy = currentEnemy(state)
  if (!enemy || spirit.hp <= 0) return
  events.push({ type: 'unit_action', unitId: spirit.id, action: '灵契协击', atMs: state.timeMs })
  dealDamage(state, spirit.id, spirit.attack, enemy, Math.floor((130 + state.spiritComboDamageBonus) * (hasModifier(state, 'spirit_combo_power') ? 108 : 100) / 100), events)
  if (hasModifier(state, 'equipment_mountain_lord_pelt')) addShield(state, spirit.id, state.leader, 8, events)
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

function gainBond(state: BattleState<CardRef>, index: number, amount: number, events: BattleEvent[]) {
  if (state.spirits[index].hp <= 0) return
  state.spiritBonds[index] += amount
  while (state.spiritBonds[index] >= 3 && state.status === 'active') {
    state.spiritBonds[index] -= 3
    events.push({ type: 'status_changed', targetId: state.spirits[index].id, status: 'spirit_bond', value: state.spiritBonds[index], atMs: state.timeMs })
    triggerSpiritCombo(state, index, events)
  }
  events.push({ type: 'status_changed', targetId: state.spirits[index].id, status: 'spirit_bond', value: state.spiritBonds[index], atMs: state.timeMs })
}

function afterSwordHit(state: BattleState<CardRef>, events: BattleEvent[]) {
  if (!state.activeCombos.includes('dual_spirit_sword') || state.timeMs < state.dualSpiritSwordReadyAtMs) return
  gainBond(state, lowestBondIndex(state), 1, events)
  state.dualSpiritSwordReadyAtMs = state.timeMs + 6_000
  events.push({ type: 'combo_triggered', comboId: 'dual_spirit_sword', atMs: state.timeMs })
}

function resolveCardInstance(state: BattleState<CardRef>, value: CardRef | string | undefined): BattleCardInstance | undefined {
  if (!value) return undefined
  if (typeof value !== 'string') return value
  for (const ref of state.deck.concat(state.hand, state.discard)) if (isBattleCardInstance(ref) && ref.instanceId === value) return ref
  return undefined
}

export function getEffectiveCardCost(state: BattleState<CardRef>, card: CardDefinition, cardInstance?: CardRef | string) {
  let discount = 0
  if (card.id === 'mountain_splitter') discount += state.nextFinisherDiscount
  if (card.tags.includes('talisman') && state.talismanDiscountCharges > 0) discount += 1
  if (card.kind === '敕令') discount += state.nextEdictDiscount
  if (card.id === state.discountedCardId) discount += 1
  if (state.cardDiscountCharges > 0 && !state.playedCardIds.includes(card.id)) discount += 1
  if (resolveCardInstance(state, cardInstance)?.upgraded) discount += 1
  return Math.max(0, card.cost - discount)
}

export type CardAvailabilityReason = 'battle_ended' | 'not_in_hand' | 'insufficient_energy' | 'target_required' | 'invalid_target' | 'target_dead' | 'no_living_spirit'

export interface CardAvailability {
  available: boolean
  cost: number
  targetId?: UnitId
  instanceId?: string
  upgraded?: boolean
  reason?: CardAvailabilityReason
}

export function getCardAvailability(state: BattleState<CardRef>, card: CardDefinition, targetId?: UnitId, automatic = false, cardInstance?: CardRef | string): CardAvailability {
  const selected = cardInstance === undefined ? cardRefAt(state.hand, undefined, card.id)?.value : (typeof cardInstance === 'string' ? cardRefAt(state.hand, cardInstance, undefined)?.value : cardRefAt(state.hand, cardInstance.instanceId, undefined)?.value)
  const cost = getEffectiveCardCost(state, card, selected)
  if (state.status !== 'active') return { available: false, cost, reason: 'battle_ended' }
  if (!selected || getCardId(selected) !== card.id) return { available: false, cost, reason: 'not_in_hand' }
  if (state.energy < cost) return { available: false, cost, reason: 'insufficient_energy' }

  const resolvedTarget = targetId ?? (automatic && card.targetRule === 'chosen_spirit' && state.spirits.some((spirit) => spirit.hp > 0) ? state.spirits[lowestBondIndex(state)].id : undefined)
  const metadata = isBattleCardInstance(selected) ? { instanceId: selected.instanceId, upgraded: selected.upgraded } : {}
  if (card.targetRule !== 'chosen_spirit') return { available: true, cost, targetId: resolvedTarget, ...metadata }
  if (!resolvedTarget) return { available: false, cost, reason: state.spirits.some((spirit) => spirit.hp > 0) ? 'target_required' : 'no_living_spirit', ...metadata }
  const target = state.spirits.find((spirit) => spirit.id === resolvedTarget)
  if (!target) return { available: false, cost, reason: 'invalid_target', ...metadata }
  if (target.hp <= 0) return { available: false, cost, reason: 'target_dead', ...metadata }
  return { available: true, cost, targetId: resolvedTarget, ...metadata }
}

function applyCardEffect(state: BattleState<CardRef>, card: CardDefinition, targetId: UnitId | undefined, events: BattleEvent[]) {
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
        const finisherPower = Math.floor((power + consumed * 45) * (hasModifier(state, 'sword_finisher_power') || hasModifier(state, 'equipment_hidden_edge_jade') ? 108 : 100) / 100)
        dealDamage(state, card.id, state.leader.attack, enemy, finisherPower, events)
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

function consumeDiscounts(state: BattleState<CardRef>, card: CardDefinition) {
  if (card.id === 'mountain_splitter' && state.nextFinisherDiscount) state.nextFinisherDiscount = 0
  if (card.tags.includes('talisman') && state.talismanDiscountCharges > 0) state.talismanDiscountCharges -= 1
  if (card.kind === '敕令' && state.nextEdictDiscount) state.nextEdictDiscount = 0
  if (card.id === state.discountedCardId) state.discountedCardId = undefined
}

function playCard(state: BattleState<CardRef>, cardId: CardId | undefined, cardInstanceId: string | undefined, targetId: UnitId | undefined, content: BattleContent, events: BattleEvent[], automatic: boolean) {
  const selected = cardRefAt(state.hand, cardInstanceId, cardId)
  if (!selected) return false
  const selectedCardId = getCardId(selected.value)
  if (cardId && selectedCardId !== cardId) return false
  const handIndex = selected.index
  const card = content.cards[selectedCardId]
  const availability = getCardAvailability(state, card, targetId, automatic, isBattleCardInstance(selected.value) ? selected.value : undefined)
  if (handIndex < 0 || !availability.available) return false
  const resolvedTarget = availability.targetId
  const cost = availability.cost
  state.energy -= cost
  consumeDiscounts(state, card)
  state.hand.splice(handIndex, 1)
  const exhaust = isBattleCardInstance(selected.value) && (selected.value.exhaust || card.exhaust)
  if (exhaust) events.push({ type: 'card_exhausted', cardId: selectedCardId, instanceId: isBattleCardInstance(selected.value) ? selected.value.instanceId : undefined, atMs: state.timeMs })
  else state.discard.push(selected.value)
  state.cardsPlayed += 1
  if (state.cardDiscountCharges > 0 && !state.playedCardIds.includes(selectedCardId)) state.cardDiscountCharges -= 1
  if (!state.playedCardIds.includes(selectedCardId)) state.playedCardIds.push(selectedCardId)
  if (card.tags.includes('sword')) {
    state.talismanCardStreak = 0
    if (hasModifier(state, 'equipment_green_bamboo_crown') && state.cardsPlayed % 3 === 0) gainSwordIntent(state, 1, events)
  } else if (card.tags.includes('talisman')) {
    state.talismanCardStreak += 1
    if (hasModifier(state, 'equipment_star_treading_shoes') && state.talismanCardStreak >= 3) { state.talismanCardStreak = 0; gainEnergy(state, 1, events) }
  } else state.talismanCardStreak = 0
  if (hasModifier(state, 'equipment_wandering_cloud_robe') && !state.firstCardShieldGranted) { state.firstCardShieldGranted = true; addShield(state, 'equipment_wandering_cloud_robe', state.leader, 12, events) }
  events.push({ type: 'energy_changed', value: state.energy, atMs: state.timeMs })
  events.push({ type: 'card_played', cardId: selectedCardId, ...(isBattleCardInstance(selected.value) ? { instanceId: selected.value.instanceId } : {}), automatic, targetId: resolvedTarget, atMs: state.timeMs })
  applyCardEffect(state, card, resolvedTarget, events)

  const tag = card.tags[0]
  state.cardTagCounts[tag] += 1
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
    if (!state.swordCardsPlayed.includes(selectedCardId)) state.swordCardsPlayed.push(selectedCardId)
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

function applyTreasure(state: BattleState<CardRef>, treasureId: string | undefined, events: BattleEvent[]) {
  const id = treasureId ?? state.treasureId
  if (state.status !== 'active' || !id || id !== state.treasureId || state.treasureCharge < state.treasureMaxCharge) return false
  state.treasureCharge = 0
  events.push({ type: 'treasure_used', treasureId: id, remainingCharge: state.treasureCharge, atMs: state.timeMs })
  const enemy = currentEnemy(state)
  switch (id) {
    case 'treasure_crescent_sword_case': if (enemy) for (let hit = 0; hit < 3; hit += 1) dealDamage(state, id, state.leader.attack, enemy, 80 + state.swordIntent * 5, events); break
    case 'treasure_demon_revealing_mirror': if (enemy) { addArmorBreak(state, enemy, 2, events); addMarks(state, enemy, 1, events) }; break
    case 'treasure_primordial_gourd': gainEnergy(state, 3, events); state.nextFinisherDiscount = Math.max(state.nextFinisherDiscount, 2); break
    case 'treasure_demon_binding_rope': if (enemy) enemy.nextActionAtMs += 4_000; break
    case 'treasure_mountain_river_inkstone': [state.leader, ...state.spirits].forEach((unit) => addShield(state, id, unit, 36, events)); break
    case 'treasure_soul_summoning_banner': gainBond(state, 0, 2, events); gainBond(state, 1, 2, events); break
    default: return false
  }
  return true
}

function applyConsumable(state: BattleState<CardRef>, consumableId: string | undefined, slot: number | undefined, targetId: UnitId | undefined, events: BattleEvent[]) {
  if (state.status !== 'active') return false
  const id = consumableId ?? Object.keys(state.consumableUses)[slot ?? 0]
  if (!id || (state.consumableUses[id] ?? 0) <= 0) return false
  const target = targetId ? [state.leader, ...state.spirits].find((unit) => unit.id === targetId) : state.leader
  const enemy = currentEnemy(state)
  switch (id) {
    case 'consumable_spring_return_pill': heal(state, id, state.leader, Math.floor(state.leader.maxHp * 0.35), events); break
    case 'consumable_spirit_gathering_pill': gainEnergy(state, 3, events); break
    case 'consumable_meridian_guard_pill': addShield(state, id, state.leader, 40, events); break
    case 'consumable_evil_breaking_talisman': if (enemy) { enemy.attackBonusPercent = 0; addArmorBreak(state, enemy, 2, events) }; break
    case 'consumable_armor_escape_talisman': if (target && target.hp > 0) addShield(state, id, target, 50, events); else return false; break
    case 'consumable_thunder_summoning_talisman': state.enemies.filter((unit) => unit.hp > 0).forEach((unit) => { dealDamage(state, id, state.leader.attack, unit, 120, events); detonateMarks(state, id, unit, 1, events) }); break
    default: return false
  }
  state.consumableUses[id] -= 1
  events.push({ type: 'consumable_used', consumableId: id, remainingUses: state.consumableUses[id], targetId, atMs: state.timeMs })
  return true
}

function autoAction(state: BattleState<CardRef>, unit: UnitState, events: BattleEvent[]) {
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
      case 'ancient_huai_matriarch': {
        if (state.bossPhase === 'rooted' && unit.actionCount % 3 === 0) addShield(state, unit.id, unit, 50, events)
        else if (state.bossPhase === 'reflection' && unit.actionCount % 3 === 0) {
          const target = state.spirits.filter((spirit) => spirit.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
          if (target) { state.bossMarkedSpiritId = target.id as SpiritId; events.push({ type: 'message', text: `槐姥摄住了${target.name}的灵光。`, atMs: state.timeMs }); dealDamage(state, unit.id, unit.attack, target, 50, events) }
          else dealDamage(state, unit.id, unit.attack, state.leader, 110, events)
        } else dealDamage(state, unit.id, unit.attack, state.leader, 110, events)
        break
      }
      default: dealDamage(state, unit.id, unit.attack, state.leader, 100, events)
    }
  } else if (enemy) {
    const alternatingSpirit = state.lastSpiritActionId !== undefined && state.lastSpiritActionId !== unit.id && state.timeMs - state.lastSpiritActionAtMs <= 4_000
    events.push({ type: 'unit_action', unitId: unit.id, action: unit.title, atMs: state.timeMs })
    switch (unit.id as SpiritId) {
      case 'blade_tail_fox': dealDamage(state, unit.id, unit.attack, enemy, 55, events); dealDamage(state, unit.id, unit.attack, enemy, 55, events); break
      case 'iron_beak_crane': dealDamage(state, unit.id, unit.attack, enemy, 150, events); addArmorBreak(state, enemy, 1, events); break
      case 'paper_bride': addMarks(state, enemy, 1, events); addShield(state, unit.id, state.leader, 10, events); break
      case 'lantern_ghost': dealDamage(state, unit.id, unit.attack, enemy, 80, events); addBurn(state, enemy, 1, events); break
      case 'mountain_child': addShield(state, unit.id, state.leader, 18, events); break
      case 'dream_tapir': dealDamage(state, unit.id, unit.attack, enemy, 60, events); gainEnergy(state, 1, events); break
    }
    if (alternatingSpirit && hasModifier(state, 'equipment_tracking_straw_sandals') && enemy.hp > 0) dealDamage(state, unit.id, unit.attack, enemy, 25, events)
    if (alternatingSpirit && hasModifier(state, 'equipment_paired_bronze_bell')) { gainBond(state, 0, 1, events); gainBond(state, 1, 1, events) }
    state.lastSpiritActionId = unit.id as SpiritId
    state.lastSpiritActionAtMs = state.timeMs
    if (state.bossMarkedSpiritId === unit.id && state.status === 'active') {
      state.bossMarkedSpiritId = undefined
      dealDamage(state, unit.id, unit.attack, enemy, 50, events)
      events.push({ type: 'message', text: '槐姥复制了妖灵的下一次行动。', atMs: state.timeMs })
    }
  }
}

function tickBurn(state: BattleState<CardRef>, target: UnitState, events: BattleEvent[]) {
  if (!target.burnStacks || target.hp <= 0) return
  dealFlatDamage(state, 'burn', target, target.burnStacks * 5, events)
  target.burnStacks -= 1
  target.nextBurnAtMs = target.burnStacks ? state.timeMs + 2_000 : 0
  events.push({ type: 'status_changed', targetId: target.id, status: 'burn', value: target.burnStacks, atMs: state.timeMs })
}

function advanceStep(state: BattleState<CardRef>, content: BattleContent, events: BattleEvent[]) {
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
    let played = false
    for (const cardId of state.autoplayPriority) {
      const selected = state.hand.find((ref) => getCardId(ref) === cardId)
      if (selected && getCardAvailability(state, content.cards[cardId], undefined, true, isBattleCardInstance(selected) ? selected : undefined).available) {
        playCard(state, cardId, isBattleCardInstance(selected) ? selected.instanceId : undefined, undefined, content, events, true)
        played = true
        break
      }
    }
    if (!played) for (const selected of state.hand) {
      const cardId = getCardId(selected)
      if (getCardAvailability(state, content.cards[cardId], undefined, true, isBattleCardInstance(selected) ? selected : undefined).available) { playCard(state, cardId, isBattleCardInstance(selected) ? selected.instanceId : undefined, undefined, content, events, true); break }
    }
  }
}

function validPriority(cardIds: CardId[], state: BattleState<CardRef>, content: BattleContent) {
  const deck = content.builds[state.buildId].cardIds
  return cardIds.length === deck.length && new Set(cardIds).size === deck.length && deck.every((id) => cardIds.includes(id))
}

export function transitionBattle<CardReference extends CardRef>(current: BattleState<CardReference>, command: BattleCommand, content: BattleContent = PROTOTYPE_CONTENT): BattleTransition<CardReference> {
  if (command.type === 'restart') {
    const restartContent = current.battleSetup ? { ...content, enemies: current.enemies.map((enemy) => content.enemyDefinitions[enemy.id as EnemyId] ?? enemy) } : content
    const state = current.battleSetup
      ? createBattle(command.seed ?? current.seed, restartContent, { ...current.battleSetup, buildId: command.buildId ?? current.buildId })
      : createBattle(command.seed ?? current.seed, restartContent, command.buildId ?? current.buildId)
    return { state: state as BattleState<CardReference>, events: [{ type: 'battle_started', seed: state.seed, buildId: state.buildId, atMs: 0 }] }
  }
  const state = cloneState(current as BattleState<CardRef>)
  const events: BattleEvent[] = []
  switch (command.type) {
    case 'advance':
      for (let step = 0; step < Math.max(0, Math.floor(command.elapsedMs / STEP_MS)); step += 1) advanceStep(state, content, events)
      break
    case 'play_card': playCard(state, command.cardId, command.cardInstanceId, command.targetId, content, events, false); break
    case 'use_treasure': applyTreasure(state, command.treasureId, events); break
    case 'use_consumable': applyConsumable(state, command.consumableId, command.slot, command.targetId, events); break
    case 'set_autoplay': state.autoplay = command.enabled; break
    case 'reorder_priority': if (validPriority(command.cardIds, state, content)) state.autoplayPriority = [...command.cardIds]; break
  }
  return { state: state as BattleState<CardReference>, events }
}

export function startNextWave<CardReference extends CardRef>(current: BattleState<CardReference>, enemies: readonly EnemyDefinition[], waveNumber: number): BattleTransition<CardReference> {
  const state = cloneState(current as BattleState<CardRef>)
  state.status = 'active'
  state.enemies = enemies.map(makeUnit)
  state.enemies.forEach((enemy) => { enemy.nextActionAtMs += state.timeMs })
  return { state: state as BattleState<CardReference>, events: [{ type: 'wave_started', waveNumber, atMs: state.timeMs }] }
}
