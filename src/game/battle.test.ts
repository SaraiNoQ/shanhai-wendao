import { describe, expect, it } from 'vitest'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import { createBattle, createBattleCardInstance, getCardAvailability, getEffectiveCardCost, transitionBattle } from './battle'
import type { BattleContent, BattleSetup, BattleState, BuildId, CardId, EnemyId } from './types'

function withHand(state: BattleState, hand: CardId[], energy = 10): BattleState {
  return { ...state, hand, deck: [], discard: [], energy }
}

function play(state: BattleState, cardId: CardId, targetId?: BattleState['spirits'][number]['id']) {
  return transitionBattle({ ...state, hand: [cardId], deck: [], discard: [], energy: 10 }, { type: 'play_card', cardId, targetId }).state
}

function enemyBattle(...ids: EnemyId[]) {
  const content: BattleContent = { ...PROTOTYPE_CONTENT, enemies: ids.map((id) => PROTOTYPE_CONTENT.enemyDefinitions[id]) }
  const state = createBattle(99, content)
  state.leader.nextActionAtMs = 999_999
  state.spirits.forEach((spirit) => { spirit.nextActionAtMs = 999_999 })
  return { state, content }
}

describe('deterministic M2 battle', () => {
  it('creates the same four-card opening from the same seed and build', () => {
    expect(createBattle(42, PROTOTYPE_CONTENT, 'pure_talisman')).toEqual(createBattle(42, PROTOTYPE_CONTENT, 'pure_talisman'))
    expect(createBattle(42).hand).toHaveLength(4)
  })

  it('refuses unaffordable cards without changing state', () => {
    const state = withHand(createBattle(1), ['mountain_splitter'], 0)
    expect(transitionBattle(state, { type: 'play_card', cardId: 'mountain_splitter' })).toEqual({ state, events: [] })
  })

  it('discards a played card, draws a replacement, and reshuffles deterministically', () => {
    const initial = createBattle(5)
    const cardId = initial.hand.find((id) => PROTOTYPE_CONTENT.cards[id].cost <= initial.energy)!
    const result = transitionBattle(initial, { type: 'play_card', cardId })
    expect(result.state.discard).toContain(cardId)
    expect(result.state.hand).toHaveLength(4)

    const reshuffle = withHand(createBattle(7), ['guiding_edge'])
    reshuffle.discard = ['hidden_edge', 'returning_wind']
    expect(transitionBattle(reshuffle, { type: 'play_card', cardId: 'guiding_edge' })).toEqual(transitionBattle(reshuffle, { type: 'play_card', cardId: 'guiding_edge' }))
  })

  it('absorbs damage with shield and armor break increases damage', () => {
    const shielded = play(createBattle(8), 'hidden_edge')
    const advanced = transitionBattle(shielded, { type: 'advance', elapsedMs: 3_250 }).state
    expect(advanced.leader.hp).toBe(shielded.leader.hp)
    expect(advanced.leader.shield).toBeLessThan(shielded.leader.shield)

    const base = createBattle(9)
    const normal = play(base, 'guiding_edge')
    const broken = createBattle(9)
    broken.enemies[0].armorBreak = 5
    expect(play(broken, 'guiding_edge').enemies[0].hp).toBeLessThan(normal.enemies[0].hp)
  })

  it('refreshes talisman marks, expires them after ten seconds, and burns every two seconds', () => {
    let state = play(createBattle(10, PROTOTYPE_CONTENT, 'pure_sword'), 'fire_talisman')
    expect(state.enemies[0].talismanMarks).toBe(2)
    expect(state.enemies[0].talismanExpiresAtMs).toBe(10_000)
    state = transitionBattle(state, { type: 'advance', elapsedMs: 2_000 }).state
    expect(state.enemies[0].burnStacks).toBe(0)
    const hpAfterBurn = state.enemies[0].hp
    state = play(state, 'fire_talisman')
    expect(state.enemies[0].talismanExpiresAtMs).toBe(12_000)
    state = transitionBattle(state, { type: 'advance', elapsedMs: 10_000 }).state
    expect(state.enemies[0].talismanMarks).toBe(0)
    expect(state.enemies[0].hp).toBeLessThan(hpAfterBurn)
  })

  it('requires a legal chosen spirit for manual cards', () => {
    const state = withHand(createBattle(11, PROTOTYPE_CONTENT, 'pure_spirit'), ['protect_master'])
    expect(transitionBattle(state, { type: 'play_card', cardId: 'protect_master' })).toEqual({ state, events: [] })
    const result = transitionBattle(state, { type: 'play_card', cardId: 'protect_master', targetId: state.spirits[1].id })
    expect(result.state.spiritBonds[1]).toBe(1)
    expect(result.state.leader.shield).toBeGreaterThan(0)
  })

  it('only exposes living chosen spirits as legal targets', () => {
    const state = withHand(createBattle(25, PROTOTYPE_CONTENT, 'pure_spirit'), ['protect_master'])
    state.spirits[0].hp = 0
    const card = PROTOTYPE_CONTENT.cards.protect_master
    expect(getCardAvailability(state, card, state.spirits[0].id)).toMatchObject({ available: false, cost: 2, reason: 'target_dead' })
    expect(getCardAvailability(state, card, state.spirits[1].id)).toMatchObject({ available: true, cost: 2, targetId: state.spirits[1].id })
    expect(transitionBattle(state, { type: 'play_card', cardId: card.id, targetId: state.spirits[0].id }).events).toEqual([])
  })

  it('autoplay resolves a chosen-spirit card to a living target', () => {
    const state = withHand(createBattle(26, PROTOTYPE_CONTENT, 'pure_spirit'), ['protect_master'])
    state.spirits[0].hp = 0
    state.autoplayPriority = ['protect_master']
    const automatic = transitionBattle(state, { type: 'set_autoplay', enabled: true }).state
    const result = transitionBattle(automatic, { type: 'advance', elapsedMs: 250 })
    expect(getCardAvailability(automatic, PROTOTYPE_CONTENT.cards.protect_master, undefined, true)).toMatchObject({ available: true, targetId: state.spirits[1].id })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'card_played', cardId: 'protect_master', automatic: true, targetId: state.spirits[1].id }))
    expect(result.state.spiritBonds).toEqual([0, 1])
  })

  it('autoplay skips a chosen-spirit card when all spirits are dead and continues', () => {
    const state = withHand(createBattle(27), ['protect_master', 'guiding_edge'])
    state.spirits.forEach((spirit) => { spirit.hp = 0 })
    state.autoplayPriority = ['protect_master', 'guiding_edge']
    const automatic = transitionBattle(state, { type: 'set_autoplay', enabled: true }).state
    const result = transitionBattle(automatic, { type: 'advance', elapsedMs: 250 })
    expect(getCardAvailability(automatic, PROTOTYPE_CONTENT.cards.protect_master)).toMatchObject({ available: false, reason: 'no_living_spirit' })
    expect(getCardAvailability(automatic, PROTOTYPE_CONTENT.cards.protect_master, undefined, true)).toMatchObject({ available: false, reason: 'no_living_spirit' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'card_played', cardId: 'guiding_edge', automatic: true }))
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: 'card_played', cardId: 'protect_master' }))
  })

  it('gives lowest bond to a living spirit instead of a dead one', () => {
    const state = withHand(createBattle(28, PROTOTYPE_CONTENT, 'pure_spirit'), ['call_true_name'])
    state.spirits[0].hp = 0
    state.spiritBonds = [0, 1]
    const result = transitionBattle(state, { type: 'play_card', cardId: 'call_true_name' })
    expect(result.state.spiritBonds).toEqual([0, 2])
  })

  it('triggers spirit combo at three bonds', () => {
    let state = createBattle(12, PROTOTYPE_CONTENT, 'pure_spirit')
    for (let index = 0; index < 5; index += 1) state = play(state, 'call_true_name')
    expect(state.totalSpiritCombos).toBe(1)
    expect(state.spiritComboCounts[0]).toBe(1)
  })

  it('derives the three mixed combos from loadout tags', () => {
    expect(createBattle(1, PROTOTYPE_CONTENT, 'flying_sword_seal').activeCombos).toContain('flying_sword_seal')
    expect(createBattle(1, PROTOTYPE_CONTENT, 'spirit_edict').activeCombos).toContain('spirit_edict')
    expect(createBattle(1, PROTOTYPE_CONTENT, 'dual_spirit_sword').activeCombos).toContain('dual_spirit_sword')
  })

  it('fires flying sword seal and spirit edict effects', () => {
    let sword = createBattle(13, PROTOTYPE_CONTENT, 'flying_sword_seal')
    sword.swordIntent = 6
    sword.enemies[0].talismanMarks = 3
    sword.enemies[0].talismanExpiresAtMs = 10_000
    const swordResult = transitionBattle(withHand(sword, ['mountain_splitter']), { type: 'play_card', cardId: 'mountain_splitter' })
    expect(swordResult.state.enemies[0].talismanMarks).toBe(1)
    expect(swordResult.events).toContainEqual(expect.objectContaining({ type: 'combo_triggered', comboId: 'flying_sword_seal' }))

    let edict = createBattle(14, PROTOTYPE_CONTENT, 'spirit_edict')
    edict.enemies[0].talismanMarks = 1
    edict.enemies[0].talismanExpiresAtMs = 10_000
    edict.spiritBonds = [2, 2]
    const edictResult = transitionBattle(withHand(edict, ['call_true_name']), { type: 'play_card', cardId: 'call_true_name' })
    expect(edictResult.state.nextEdictDiscount).toBe(1)
    expect(edictResult.events).toContainEqual(expect.objectContaining({ type: 'combo_triggered', comboId: 'spirit_edict' }))
  })

  it('fires dual spirit sword with a six-second cooldown', () => {
    let state = createBattle(15, PROTOTYPE_CONTENT, 'dual_spirit_sword')
    state = play(state, 'guiding_edge')
    expect(state.spiritBonds).toEqual([1, 0])
    state = play(state, 'guiding_edge')
    expect(state.spiritBonds).toEqual([1, 0])
    state = transitionBattle(state, { type: 'advance', elapsedMs: 6_000 }).state
    state = play(state, 'guiding_edge')
    expect(state.spiritBonds.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(1)
  })

  it('implements the three weapon passives', () => {
    let sword = createBattle(16, PROTOTYPE_CONTENT, 'pure_sword')
    sword = transitionBattle(sword, { type: 'advance', elapsedMs: 7_500 }).state
    expect(sword.swordIntent).toBeGreaterThan(0)

    const brush = createBattle(17, PROTOTYPE_CONTENT, 'pure_talisman')
    brush.enemies[0].talismanMarks = 1
    brush.enemies[0].talismanExpiresAtMs = 10_000
    brush.leader.nextActionAtMs = 250
    expect(transitionBattle(brush, { type: 'advance', elapsedMs: 250 }).state.enemies[0].talismanExpiresAtMs).toBe(11_000)

    const bell = createBattle(18, PROTOTYPE_CONTENT, 'pure_spirit')
    expect(bell.spirits[0].nextActionAtMs).toBeLessThan(bell.spirits[0].attackIntervalMs)
  })

  it('implements technique discounts and refunds', () => {
    let sword = createBattle(19, PROTOTYPE_CONTENT, 'pure_sword')
    sword = play(sword, 'guiding_edge')
    sword = play(sword, 'returning_wind')
    sword = play(sword, 'armor_piercing_star')
    expect(getEffectiveCardCost(sword, PROTOTYPE_CONTENT.cards.mountain_splitter)).toBe(4)

    let talisman = createBattle(20, PROTOTYPE_CONTENT, 'pure_talisman')
    talisman.energy = 1
    talisman.enemies[0].talismanMarks = 3
    talisman.enemies[0].talismanExpiresAtMs = 10_000
    talisman = play(talisman, 'urgent_edict')
    expect(talisman.energy).toBe(10)

    let spirit = createBattle(21, PROTOTYPE_CONTENT, 'pure_spirit')
    spirit.spiritBonds = [2, 2]
    spirit = play(spirit, 'call_true_name')
    expect(spirit.spiritBonds[0]).toBe(1)
  })

  it('autoplay skips an unaffordable high-priority card', () => {
    const base = withHand(createBattle(22), ['mountain_splitter', 'guiding_edge'], 1)
    let state = transitionBattle(base, { type: 'set_autoplay', enabled: true }).state
    const result = transitionBattle(state, { type: 'advance', elapsedMs: 250 })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'card_played', cardId: 'guiding_edge', automatic: true }))
  })

  it.each(Object.keys(PROTOTYPE_CONTENT.builds) as BuildId[])('%s autoplay reaches a result', (buildId) => {
    let state = transitionBattle(createBattle(23, PROTOTYPE_CONTENT, buildId), { type: 'set_autoplay', enabled: true }).state
    for (let step = 0; step < 800 && state.status === 'active'; step += 1) state = transitionBattle(state, { type: 'advance', elapsedMs: 250 }).state
    expect(state.status).not.toBe('active')
    if (buildId.startsWith('pure_')) expect(state.status).toBe('victory')
  })

  it('keeps speed batching and restart deterministic', () => {
    const state = transitionBattle(createBattle(24), { type: 'set_autoplay', enabled: true }).state
    const batched = transitionBattle(state, { type: 'advance', elapsedMs: 1_000 })
    let stepped = { state, events: [] as ReturnType<typeof transitionBattle>['events'] }
    for (let index = 0; index < 4; index += 1) {
      const result = transitionBattle(stepped.state, { type: 'advance', elapsedMs: 250 })
      stepped = { state: result.state, events: [...stepped.events, ...result.events] }
    }
    expect(batched).toEqual(stepped)
    expect(transitionBattle(batched.state, { type: 'restart' }).state).toEqual(createBattle(24))
  })

  it('implements the common enemy teaching behaviors', () => {
    const vine = enemyBattle('withered_vine_spirit')
    vine.state.enemies[0].actionCount = 1
    vine.state.enemies[0].nextActionAtMs = 250
    expect(transitionBattle(vine.state, { type: 'advance', elapsedMs: 250 }, vine.content).state.enemies[0].shield).toBeGreaterThan(0)

    const moth = enemyBattle('corpse_lantern_moth')
    moth.state.enemies[0].nextActionAtMs = 250
    expect(transitionBattle(moth.state, { type: 'advance', elapsedMs: 250 }, moth.content).state.leader.burnStacks).toBe(1)

    const immortal = enemyBattle('title_seeking_immortal')
    immortal.state.enemies[0].nextActionAtMs = 250
    expect(transitionBattle(immortal.state, { type: 'advance', elapsedMs: 250 }, immortal.content).state.enemies[0].attack).toBeGreaterThan(immortal.state.enemies[0].attack)

    const thrall = enemyBattle('night_wandering_thrall')
    thrall.state.spirits[1].hp = 10
    thrall.state.enemies[0].nextActionAtMs = 250
    expect(transitionBattle(thrall.state, { type: 'advance', elapsedMs: 250 }, thrall.content).state.spirits[1].hp).toBeLessThan(10)

    const crows = enemyBattle('grave_crow_flock')
    crows.state.enemies[0].nextActionAtMs = 250
    expect(transitionBattle(crows.state, { type: 'advance', elapsedMs: 250 }, crows.content).events.filter((event) => event.type === 'damage' && event.sourceId === 'grave_crow_flock')).toHaveLength(3)
  })

  it('implements elite reactions, summons, and death effects', () => {
    const coin = enemyBattle('coin_corpse', 'clay_idol')
    coin.state.enemies[0].hp = 1
    const coinResult = transitionBattle(withHand(coin.state, ['guiding_edge']), { type: 'play_card', cardId: 'guiding_edge' }, coin.content)
    expect(coinResult.state.enemies[1].attackBonusPercent).toBe(15)

    const crone = enemyBattle('borrowed_life_crone')
    crone.state.enemies[0].hp = 100
    crone.state.leader.hp = 80
    const croneResult = transitionBattle(withHand(crone.state, ['life_talisman']), { type: 'play_card', cardId: 'life_talisman' }, crone.content)
    expect(croneResult.state.enemies[0].hp).toBeGreaterThan(100)

    const branch = enemyBattle('hundred_eyed_branch')
    branch.state.enemies[0].hp = 9_999
    let branchState = branch.state
    let branchEvents = [] as ReturnType<typeof transitionBattle>['events']
    for (const cardId of ['hidden_edge', 'guiding_edge', 'returning_wind'] as CardId[]) { const result = transitionBattle(withHand(branchState, [cardId]), { type: 'play_card', cardId }, branch.content); branchState = result.state; branchEvents = result.events }
    expect(branchEvents).toContainEqual(expect.objectContaining({ type: 'enemy_buff', status: 'adaptation_shield' }))
    expect(branchState.enemies[0].shield).toBeGreaterThan(0)

    const envoy = enemyBattle('paper_armor_envoy')
    envoy.state.enemies[0].hp = Math.floor(envoy.state.enemies[0].maxHp * 0.6) + 1
    const envoyResult = transitionBattle(withHand(envoy.state, ['guiding_edge']), { type: 'play_card', cardId: 'guiding_edge' }, envoy.content)
    expect(envoyResult.events).toContainEqual(expect.objectContaining({ type: 'unit_summoned', unitId: 'paper_child' }))
    expect(envoyResult.state.enemies).toHaveLength(2)
  })
})

describe('battle card instances', () => {
  function setup(hand: BattleSetup['hand']): BattleSetup {
    return { buildId: 'pure_sword', deck: [], hand, discard: [] }
  }

  it('keeps duplicate cards addressable by instance and reports both ids', () => {
    const first = createBattleCardInstance('guiding_edge', 'edge-1')
    const second = createBattleCardInstance('guiding_edge', 'edge-2', true)
    const state = createBattle(30, PROTOTYPE_CONTENT, { ...setup([first, second]), deck: [createBattleCardInstance('hidden_edge', 'edge-draw')] })
    expect(state.hand).toEqual([first, second])
    expect(getEffectiveCardCost(state, PROTOTYPE_CONTENT.cards.guiding_edge, second)).toBe(0)

    const result = transitionBattle(state, { type: 'play_card', cardInstanceId: 'edge-2' })
    expect(result.state.hand.map((card) => card.instanceId)).toContain(first.instanceId)
    expect(result.state.hand.map((card) => card.instanceId)).not.toContain(second.instanceId)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'card_played', cardId: 'guiding_edge', instanceId: 'edge-2' }))
  })

  it('exhausts an instance for this battle and restores it from setup on restart', () => {
    const exhausted = createBattleCardInstance('guiding_edge', 'edge-exhaust', false, true)
    const state = createBattle(31, PROTOTYPE_CONTENT, setup([exhausted]))
    const played = transitionBattle(state, { type: 'play_card', cardInstanceId: exhausted.instanceId }).state
    expect(played.discard).toEqual([])
    expect(played.hand).toEqual([])

    const restarted = transitionBattle(played, { type: 'restart' }).state
    expect(restarted.hand).toEqual([exhausted])
  })

  it('uses charged treasures and limited consumables through the same transition', () => {
    const state = createBattle(32, PROTOTYPE_CONTENT, {
      buildId: 'pure_sword', cardInstances: [createBattleCardInstance('guiding_edge', 'edge-use')],
      treasureId: 'treasure_crescent_sword_case', treasureCharge: 3, treasureMaxCharge: 3,
      consumableIds: ['consumable_spring_return_pill'], consumableUses: { consumable_spring_return_pill: 1 },
    })
    const treasure = transitionBattle(state, { type: 'use_treasure' })
    expect(treasure.state.treasureCharge).toBe(0)
    expect(treasure.events).toContainEqual(expect.objectContaining({ type: 'treasure_used', treasureId: 'treasure_crescent_sword_case' }))
    treasure.state.leader.hp = 100
    const pill = transitionBattle(treasure.state, { type: 'use_consumable', slot: 0 })
    expect(pill.state.consumableUses.consumable_spring_return_pill).toBe(0)
    expect(pill.events).toContainEqual(expect.objectContaining({ type: 'consumable_used', consumableId: 'consumable_spring_return_pill' }))
  })

  it('automatically spends one meridian guard pill at the first low-health threshold', () => {
    const state = createBattle(32, PROTOTYPE_CONTENT, {
      buildId: 'pure_sword', cardInstances: [createBattleCardInstance('guiding_edge', 'guard-edge')],
      consumableIds: ['consumable_meridian_guard_pill'], consumableUses: { consumable_meridian_guard_pill: 2 },
    })
    state.leader.hp = Math.floor(state.leader.maxHp * 0.32)
    const enemy = state.enemies[0]
    enemy.nextActionAtMs = 250
    const first = transitionBattle(state, { type: 'advance', elapsedMs: 250 })
    expect(first.state.meridianGuardTriggered).toBe(true)
    expect(first.state.consumableUses.consumable_meridian_guard_pill).toBe(1)
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'consumable_used', consumableId: 'consumable_meridian_guard_pill' }))
    const second = transitionBattle(first.state, { type: 'advance', elapsedMs: 250 })
    expect(second.state.consumableUses.consumable_meridian_guard_pill).toBe(1)
  })

  it('moves the Huai Matriarch through its three deterministic phases', () => {
    const content: BattleContent = { ...PROTOTYPE_CONTENT, enemies: [PROTOTYPE_CONTENT.enemyDefinitions.ancient_huai_matriarch] }
    const state = createBattle(33, content, { cardInstances: [createBattleCardInstance('guiding_edge', 'boss-edge')] })
    state.enemies[0].hp = 1_200
    const reflection = transitionBattle(state, { type: 'play_card', cardInstanceId: 'boss-edge' }, content)
    expect(reflection.events).toContainEqual(expect.objectContaining({ type: 'boss_phase_changed', phase: 'reflection' }))
    const finalState = { ...reflection.state, enemies: reflection.state.enemies.map((enemy) => ({ ...enemy, hp: 200 })), hand: [createBattleCardInstance('guiding_edge', 'boss-edge-2')], deck: [], discard: [], energy: 10 }
    const final = transitionBattle(finalState, { type: 'play_card', cardInstanceId: 'boss-edge-2' }, content)
    expect(final.state.bossDominantTag).toBeDefined()
    expect(final.state.bossPhase).toBe('huai_trial')
  })

  it.each(Object.keys(PROTOTYPE_CONTENT.builds) as BuildId[])('can finish the Matriarch with %s autoplay', (buildId) => {
    const content: BattleContent = { ...PROTOTYPE_CONTENT, enemies: [PROTOTYPE_CONTENT.enemyDefinitions.ancient_huai_matriarch] }
    let state = transitionBattle(createBattle(34, content, buildId), { type: 'set_autoplay', enabled: true }, content).state
    for (let step = 0; step < 1_200 && state.status === 'active'; step += 1) state = transitionBattle(state, { type: 'advance', elapsedMs: 250 }, content).state
    expect(state.status).toBe('victory')
  })
})
