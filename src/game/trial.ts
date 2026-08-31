import { uniformInt } from 'pure-rand/distribution/uniformInt'
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import {
  HUAI_MATRIARCH_ID,
  TRIAL_COMMON_ENCOUNTER_POOL,
  TRIAL_ELITE_ENCOUNTER_POOL,
  TRIAL_EVENTS_BY_ID,
  TRIAL_INITIAL_ACTION_POINTS,
  TRIAL_MAX_ACTION_POINTS,
  TRIAL_REQUIRED_SEALS,
  TRIAL_TILE_DISTRIBUTION,
  TRIAL_TILE_KINDS,
  type TrialEncounterId,
  type TrialEventChoice,
  type TrialEventId,
  type TrialTileKind,
} from '../content/trial'
import { createBattle, createBattleCardInstance, getCardAvailability, getCardId, type CardAvailability } from './battle'
import type { Archetype, BattleCardInstance, BattleContent, BattleEvent, BattleState, BuildId, CardId, EnemyDefinition, EnemyId } from './types'
import { battleContentFromSave, type PlayerSave } from '../state/player'

export interface TrialTile {
  id: string
  x: number
  y: number
  kind: TrialTileKind | 'start'
  contentId?: string
  resolved: boolean
}

export interface TrialReward {
  id: string
  kind: 'currency' | 'material' | 'card' | 'upgrade' | 'lore' | 'charge'
  amount?: number
  resource?: 'cultivation' | 'spiritSand' | 'artifactEssence'
  cardId?: CardId
  instanceId?: string
  loreId?: string
  secured: boolean
}

export interface TrialCardRewardOption {
  id: string
  kind: 'add_card' | 'upgrade_card' | 'currency'
  cardId?: CardId
  instanceId?: string
  amount?: number
  label: string
  description: string
}

export type TrialPending =
  | { kind: 'battle'; tileId: string; encounterIds: TrialEncounterId[]; elite: boolean; boss: boolean; bonusSeals?: number }
  | { kind: 'event'; tileId: string; eventId: TrialEventId }
  | { kind: 'card_reward'; tileId: string; options: TrialCardRewardOption[] }
  | { kind: 'training'; tileId: string }
  | { kind: 'merchant'; tileId: string }
  | { kind: 'chest'; tileId: string }
  | { kind: 'camp'; tileId: string }

export interface TrialRun {
  runId: string
  seed: number
  buildId: BuildId
  buildTags: Archetype[]
  status: 'active' | 'success' | 'failure' | 'retreat'
  grid: TrialTile[]
  positionTileId: string
  revealedTileIds: string[]
  visitedTileIds: string[]
  actionPoints: number
  trialSeals: number
  cardInstances: BattleCardInstance[]
  temporaryCardInstanceIds: string[]
  temporaryUpgrades: string[]
  runCurrency: number
  partyHp: [number, number, number]
  partyMaxHp?: [number, number, number]
  treasureId?: string
  treasureCharge: number
  consumableUses: [number, number]
  battleSequence: number
  seenEventIds: TrialEventId[]
  discoveredLoreIds: string[]
  resourceBudget: { spiritSand: number; artifactEssence: number }
  resourceSpent: { spiritSand: number; artifactEssence: number }
  nextBattleAttackBonusPercent: number
  pending?: TrialPending
  pendingRewards: TrialReward[]
  securedRewards: TrialReward[]
  battleTimeMs: number
}

export interface TrialSettlement {
  sourceId: string
  seed: number
  result: TrialRun['status']
  rewards: TrialReward[]
  discoveredLoreIds: string[]
  resourceSpent: { spiritSand: number; artifactEssence: number }
  report: { battles: number; durationMs: number }
}

export type TrialCommand =
  | { type: 'move'; tileId: string }
  | { type: 'choose'; optionId: string; targetCardInstanceId?: string; replaceCardInstanceId?: string }
  | { type: 'resolve_battle'; battle: BattleState<BattleCardInstance>; events: BattleEvent[] }
  | { type: 'retreat' }

export type TrialEvent =
  | { type: 'map_generated'; tileCount: number }
  | { type: 'tile_revealed'; tileId: string }
  | { type: 'moved'; tileId: string; actionPoints: number }
  | { type: 'action_points_changed'; value: number }
  | { type: 'seal_gained'; value: number }
  | { type: 'currency_changed'; value: number }
  | { type: 'card_added'; cardId: CardId; instanceId: string }
  | { type: 'card_upgraded'; instanceId: string }
  | { type: 'card_removed'; instanceId: string }
  | { type: 'reward_added'; reward: TrialReward }
  | { type: 'reward_secured'; reward: TrialReward }
  | { type: 'battle_started'; tileId: string; encounterIds: TrialEncounterId[] }
  | { type: 'battle_resolved'; result: 'victory' | 'defeat'; tileId: string }
  | { type: 'lore_discovered'; loreId: string }
  | { type: 'run_ended'; result: TrialRun['status'] }
  | { type: 'message'; text: string }

export interface TrialTransition {
  run: TrialRun
  events: TrialEvent[]
  error?: string
}

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
const PATH: readonly [number, number][] = [[0, 3], [1, 3], [1, 2], [2, 2], [2, 3], [3, 3], [3, 4], [4, 4], [4, 3], [5, 3], [5, 2], [6, 2], [6, 3]]

function tileId(x: number, y: number) { return `tile_${x}_${y}` }
function hash(value: string) { let result = 0; for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0; return result }
function adjacent(a: TrialTile, b: TrialTile) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1 }
function shuffle<T>(values: readonly T[], seed: number) {
  const rng = xoroshiro128plus(seed)
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = uniformInt(rng, 0, index)
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

function neighbors(x: number, y: number) {
  return DIRECTIONS.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([nx, ny]) => nx >= 0 && nx < 7 && ny >= 0 && ny < 7)
}

function revealAround(grid: readonly TrialTile[], positionTileId: string, revealed: readonly string[]) {
  const current = grid.find((tile) => tile.id === positionTileId)
  if (!current) return [...revealed]
  const next = new Set(revealed)
  next.add(positionTileId)
  for (const tile of grid) if (adjacent(current, tile) || tile.kind === 'boss') next.add(tile.id)
  return [...next]
}

function encounterIds(run: TrialRun, tile: TrialTile): TrialEncounterId[] {
  if (tile.kind === 'boss') return [HUAI_MATRIARCH_ID]
  const pool = tile.kind === 'elite' ? TRIAL_ELITE_ENCOUNTER_POOL : TRIAL_COMMON_ENCOUNTER_POOL
  const picked = tile.contentId && pool.includes(tile.contentId as never) ? tile.contentId as TrialEncounterId : pool[(run.battleSequence + hash(tile.id) + run.seed) % pool.length]
  return tile.kind === 'elite' ? [picked] : [picked]
}

function distributionKinds(seed: number) {
  const kinds: TrialTileKind[] = []
  for (const kind of TRIAL_TILE_KINDS) for (let count = 0; count < TRIAL_TILE_DISTRIBUTION[kind]; count += 1) if (kind !== 'boss' && kind !== 'elite') kinds.push(kind)
  return shuffle(kinds, seed)
}

function generateGrid(seed: number) {
  const coords = new Set(PATH.map(([x, y]) => `${x},${y}`))
  const rng = xoroshiro128plus(seed)
  while (coords.size < 26) {
    const existing = shuffle([...coords], uniformInt(rng, 0, 2 ** 31 - 1))[0].split(',').map(Number)
    const candidates = neighbors(existing[0], existing[1]).filter(([x, y]) => !coords.has(`${x},${y}`))
    if (candidates.length) {
      const [x, y] = candidates[uniformInt(rng, 0, candidates.length - 1)]
      coords.add(`${x},${y}`)
    }
  }
  const pathIds = new Set(PATH.map(([x, y]) => tileId(x, y)))
  const startId = tileId(PATH[0][0], PATH[0][1])
  const bossId = tileId(PATH.at(-1)![0], PATH.at(-1)![1])
  const otherCoords = [...coords].filter((key) => !pathIds.has(tileId(...key.split(',').map(Number) as [number, number])))
  const pathElite = new Set([tileId(PATH[3][0], PATH[3][1]), tileId(PATH[8][0], PATH[8][1])])
  const kinds = distributionKinds(seed + 17)
  const tiles: TrialTile[] = []
  const allCoords = [...PATH.map(([x, y]) => `${x},${y}`), ...otherCoords]
  let kindIndex = 0
  for (const key of allCoords) {
    const [x, y] = key.split(',').map(Number)
    const id = tileId(x, y)
    const kind = id === startId ? 'start' : id === bossId ? 'boss' : pathElite.has(id) ? 'elite' : kinds[kindIndex++]
    tiles.push({ id, x, y, kind, resolved: kind === 'start' })
  }
  const eventIds = shuffle(Object.keys(TRIAL_EVENTS_BY_ID) as TrialEventId[], seed + 31)
  let eventIndex = 0
  let commonIndex = 0
  let eliteIndex = 0
  for (const tile of tiles) {
    if (tile.kind === 'event') tile.contentId = eventIds[eventIndex++ % eventIds.length]
    if (tile.kind === 'combat') tile.contentId = TRIAL_COMMON_ENCOUNTER_POOL[commonIndex++ % TRIAL_COMMON_ENCOUNTER_POOL.length]
    if (tile.kind === 'elite') tile.contentId = TRIAL_ELITE_ENCOUNTER_POOL[eliteIndex++ % TRIAL_ELITE_ENCOUNTER_POOL.length]
  }
  return tiles
}

function addLore(run: TrialRun, loreId: string, events: TrialEvent[]) {
  if (run.discoveredLoreIds.includes(loreId)) return
  run.discoveredLoreIds.push(loreId)
  events.push({ type: 'lore_discovered', loreId })
}

function addReward(run: TrialRun, reward: TrialReward, events: TrialEvent[]) {
  run.pendingRewards.push(reward)
  events.push({ type: 'reward_added', reward })
  if (reward.secured) {
    run.securedRewards.push(reward)
    events.push({ type: 'reward_secured', reward })
  }
}

function markResolved(run: TrialRun, tileId: string) {
  const tile = run.grid.find((item) => item.id === tileId)
  if (tile) tile.resolved = true
}

function cardCount(run: TrialRun, cardId: CardId) { return run.cardInstances.filter((instance) => instance.cardId === cardId).length }

function cardRewardOptions(run: TrialRun, tileId: string): TrialCardRewardOption[] {
  const tags = new Set<Archetype>(run.buildTags)
  const candidates = Object.values(PROTOTYPE_CONTENT.cards).filter((card) => card.tags.some((tag) => tags.has(tag)) && cardCount(run, card.id) < 2)
  const cards = shuffle(candidates, run.seed + run.battleSequence + hash(tileId)).slice(0, 1)
  const upgrade = run.cardInstances.find((instance) => !instance.upgraded)
  return [
    ...(cards.length && run.cardInstances.length < TRIAL_TILE_DISTRIBUTION.combat + 3 ? [{ id: 'add_card', kind: 'add_card' as const, cardId: cards[0].id, label: `收录「${cards[0].name}」`, description: '加入一张本局临时牌。' }] : []),
    ...(upgrade ? [{ id: 'upgrade_card', kind: 'upgrade_card' as const, instanceId: upgrade.instanceId, label: '锻成一张牌', description: '选择一张未强化牌，费用降低 1 点。' }] : []),
    { id: 'take_currency', kind: 'currency' as const, amount: 15, label: '收下劫尘', description: '获得 15 点本局货币。' },
  ]
}

function activateTile(run: TrialRun, tile: TrialTile, events: TrialEvent[]): TrialTransition {
  if (tile.kind === 'combat' || tile.kind === 'elite' || tile.kind === 'boss') {
    const pending: TrialPending = { kind: 'battle', tileId: tile.id, encounterIds: encounterIds(run, tile), elite: tile.kind === 'elite', boss: tile.kind === 'boss' }
    run.pending = pending
    events.push({ type: 'battle_started', tileId: tile.id, encounterIds: pending.encounterIds })
  } else if (tile.kind === 'event') run.pending = { kind: 'event', tileId: tile.id, eventId: tile.contentId as TrialEventId }
  else if (tile.kind === 'training') run.pending = { kind: 'training', tileId: tile.id }
  else if (tile.kind === 'merchant') run.pending = { kind: 'merchant', tileId: tile.id }
  else if (tile.kind === 'chest') run.pending = { kind: 'chest', tileId: tile.id }
  else if (tile.kind === 'camp') run.pending = { kind: 'camp', tileId: tile.id }
  else markResolved(run, tile.id)
  return { run, events }
}

function meets(requirements: readonly { kind: string; minimum?: number; resource?: string; tag?: Archetype }[], run: TrialRun) {
  return requirements.every((requirement) => requirement.kind === 'action_points' ? run.actionPoints >= (requirement.minimum ?? 0) : requirement.kind === 'resource' ? (requirement.resource === 'runCurrency' ? run.runCurrency : run.resourceBudget[requirement.resource as keyof typeof run.resourceBudget] ?? 0) >= (requirement.minimum ?? 0) : requirement.kind === 'tag' ? run.buildTags.includes(requirement.tag!) : true)
}

function pay(costs: readonly { resource: string; amount: number }[], run: TrialRun) {
  for (const cost of costs) {
    if (cost.resource === 'actionPoints') run.actionPoints = Math.max(0, run.actionPoints - cost.amount)
    else if (cost.resource === 'runCurrency') run.runCurrency = Math.max(0, run.runCurrency - cost.amount)
    else {
      const key = cost.resource as keyof typeof run.resourceBudget
      run.resourceBudget[key] = Math.max(0, run.resourceBudget[key] - cost.amount)
      run.resourceSpent[key] += cost.amount
    }
  }
}

function revealRandom(run: TrialRun, amount: number) {
  const candidates = run.grid.filter((tile) => !run.revealedTileIds.includes(tile.id))
  const picks = shuffle(candidates, run.seed + run.battleSequence).slice(0, amount)
  run.revealedTileIds.push(...picks.map((tile) => tile.id))
}

function applyOutcome(run: TrialRun, outcome: { kind: string; amount?: number; id?: string; exhaust?: boolean; text: string }, events: TrialEvent[]) {
  const amount = outcome.amount ?? 0
  if (outcome.kind === 'action_points') run.actionPoints = Math.max(0, Math.min(TRIAL_MAX_ACTION_POINTS, run.actionPoints + amount))
  if (outcome.kind === 'run_currency') run.runCurrency += amount
  if (outcome.kind === 'damage_leader') run.partyHp[0] = Math.max(1, run.partyHp[0] - amount)
  if (outcome.kind === 'heal_leader') run.partyHp[0] = Math.min(PROTOTYPE_CONTENT.leader.maxHp, run.partyHp[0] + amount)
  if (outcome.kind === 'reveal_tiles') revealRandom(run, amount)
  if (outcome.kind === 'grant_seal') run.trialSeals = Math.min(TRIAL_REQUIRED_SEALS, run.trialSeals + amount)
  if (outcome.kind === 'treasure_charge') run.treasureCharge += amount
  if (outcome.kind === 'enemy_attack_bonus') run.nextBattleAttackBonusPercent = Math.max(run.nextBattleAttackBonusPercent, amount)
  if (outcome.kind === 'lore' && outcome.id) addLore(run, outcome.id, events)
  if (outcome.kind === 'temporary_card' && outcome.id) {
    const cardId = outcome.id as CardId
    if (run.cardInstances.length < TRIAL_TILE_DISTRIBUTION.combat + 3 && cardCount(run, cardId) < 2) {
      const instance = createBattleCardInstance(cardId, `${run.runId}:temp:${run.cardInstances.length}`, false, outcome.exhaust ?? false)
      run.cardInstances.push(instance); run.temporaryCardInstanceIds.push(instance.instanceId)
      events.push({ type: 'card_added', cardId, instanceId: instance.instanceId })
    }
  }
}

function chooseEvent(run: TrialRun, pending: Extract<TrialPending, { kind: 'event' }>, choice: TrialEventChoice, command: Extract<TrialCommand, { type: 'choose' }>, events: TrialEvent[]): TrialTransition {
  if (run.seenEventIds.includes(pending.eventId)) return { run, events, error: '此怪谈本局已经处理过。' }
  if (!meets(choice.requirements, run)) return { run, events, error: '条件不足。' }
  if (choice.costs.some((cost) => cost.resource === 'actionPoints' && run.actionPoints < cost.amount)) return { run, events, error: '行炁不足。' }
  if (choice.costs.some((cost) => cost.resource === 'runCurrency' && run.runCurrency < cost.amount)) return { run, events, error: '劫尘不足。' }
  if (choice.costs.some((cost) => cost.resource !== 'actionPoints' && cost.resource !== 'runCurrency' && run.resourceBudget[cost.resource as keyof typeof run.resourceBudget] < cost.amount)) return { run, events, error: '永久材料不足。' }
  const needsCopy = choice.outcomes.some((outcome) => outcome.kind === 'copy_temporary_card')
  const needsUpgrade = choice.outcomes.some((outcome) => outcome.kind === 'upgrade_temporary_card')
  const selectedCard = run.cardInstances.find((item) => item.instanceId === command.targetCardInstanceId)
  if ((needsCopy || needsUpgrade) && (!selectedCard || !run.temporaryCardInstanceIds.includes(selectedCard.instanceId) || (needsUpgrade && selectedCard.upgraded))) return { run, events, error: '请选择一张可用的本局临时牌。' }
  if (needsCopy && (run.cardInstances.length >= 12 || cardCount(run, selectedCard!.cardId) >= 2)) return { run, events, error: '临时牌组已满或同名牌已达上限。' }
  pay(choice.costs, run)
  run.seenEventIds.push(pending.eventId)
  addLore(run, pending.eventId, events)
  let followUp: TrialPending | undefined
  let bonusSeals = 0
  for (const outcome of choice.outcomes) {
    if (outcome.kind === 'grant_seal' && choice.outcomes.some((item) => item.kind === 'encounter')) {
      bonusSeals += outcome.amount ?? 0
      continue
    }
    applyOutcome(run, outcome, events)
    if (outcome.kind === 'copy_temporary_card' || outcome.kind === 'upgrade_temporary_card') {
      const selected = run.cardInstances.find((item) => item.instanceId === command.targetCardInstanceId)
      if (outcome.kind === 'upgrade_temporary_card' && selected && run.temporaryCardInstanceIds.includes(selected.instanceId) && !selected.upgraded) {
        selected.upgraded = true; run.temporaryUpgrades.push(selected.instanceId); events.push({ type: 'card_upgraded', instanceId: selected.instanceId })
      }
      if (outcome.kind === 'copy_temporary_card' && selected && run.temporaryCardInstanceIds.includes(selected.instanceId) && run.cardInstances.length < 12 && cardCount(run, selected.cardId) < 2) {
        const instance = createBattleCardInstance(selected.cardId, `${run.runId}:temp:${run.cardInstances.length}`)
        run.cardInstances.push(instance); run.temporaryCardInstanceIds.push(instance.instanceId); events.push({ type: 'card_added', cardId: instance.cardId, instanceId: instance.instanceId })
      }
    }
    if (outcome.kind === 'encounter' && outcome.id) followUp = { kind: 'battle', tileId: pending.tileId, encounterIds: [outcome.id as EnemyId], elite: false, boss: false, bonusSeals }
  }
  if (followUp?.kind === 'battle' && bonusSeals > 0) followUp = { ...followUp, bonusSeals }
  run.pending = followUp
  if (followUp && followUp.kind === 'battle') events.push({ type: 'battle_started', tileId: pending.tileId, encounterIds: followUp.encounterIds })
  else markResolved(run, pending.tileId)
  return { run, events }
}

export function canChooseTrialEvent(run: TrialRun, eventId: TrialEventId, choiceId: string) {
  const choice = TRIAL_EVENTS_BY_ID[eventId]?.choices.find((item) => item.id === choiceId)
  if (!choice || run.seenEventIds.includes(eventId) || !meets(choice.requirements, run)) return false
  return choice.costs.every((cost) => cost.resource === 'actionPoints' ? run.actionPoints >= cost.amount : cost.resource === 'runCurrency' ? run.runCurrency >= cost.amount : run.resourceBudget[cost.resource as keyof typeof run.resourceBudget] >= cost.amount)
}

function choosePending(run: TrialRun, command: Extract<TrialCommand, { type: 'choose' }>, events: TrialEvent[]): TrialTransition {
  if (!run.pending) return { run, events, error: '当前没有待处理事项。' }
  if (run.pending.kind === 'event') {
    const event = TRIAL_EVENTS_BY_ID[run.pending.eventId]
    const choice = event.choices.find((item) => item.id === command.optionId)
    return choice ? chooseEvent(run, run.pending, choice, command, events) : { run, events, error: '无效的事件选项。' }
  }
  if (run.pending.kind === 'card_reward') {
    const option = run.pending.options.find((item) => item.id === command.optionId)
    if (!option) return { run, events, error: '无效的奖励选项。' }
    if (option.kind === 'currency') run.runCurrency += option.amount ?? 0
    if (option.kind === 'upgrade_card') {
      const instance = run.cardInstances.find((item) => item.instanceId === (command.targetCardInstanceId ?? option.instanceId) && !item.upgraded)
      if (!instance) return { run, events, error: '请选择一张未强化牌。' }
      instance.upgraded = true; run.temporaryUpgrades.push(instance.instanceId); events.push({ type: 'card_upgraded', instanceId: instance.instanceId })
    }
    if (option.kind === 'add_card') {
      const cardId = option.cardId!
      if (run.cardInstances.length >= 12 || cardCount(run, cardId) >= 2) return { run, events, error: '牌组已满或同名牌已达上限。' }
      const instance = createBattleCardInstance(cardId, `${run.runId}:temp:${run.cardInstances.length}`)
      run.cardInstances.push(instance); run.temporaryCardInstanceIds.push(instance.instanceId); events.push({ type: 'card_added', cardId, instanceId: instance.instanceId })
    }
    markResolved(run, run.pending.tileId); run.pending = undefined
    return { run, events }
  }
  const tileId = run.pending.tileId
  if (run.pending.kind === 'training') {
    const instance = run.cardInstances.find((item) => item.instanceId === command.targetCardInstanceId && run.temporaryCardInstanceIds.includes(item.instanceId))
    if (command.optionId === 'upgrade' && instance && !instance.upgraded) { instance.upgraded = true; run.temporaryUpgrades.push(instance.instanceId); events.push({ type: 'card_upgraded', instanceId: instance.instanceId }) }
    else if (command.optionId === 'remove' && instance) { run.cardInstances = run.cardInstances.filter((item) => item.instanceId !== instance.instanceId); run.temporaryCardInstanceIds = run.temporaryCardInstanceIds.filter((id) => id !== instance.instanceId); events.push({ type: 'card_removed', instanceId: instance.instanceId }) }
    else return { run, events, error: '修炼需要选择本局新增的牌。' }
  } else if (run.pending.kind === 'merchant') {
    if (command.optionId === 'card') {
      if (run.runCurrency < 25 || run.cardInstances.length >= 12 || cardCount(run, 'guiding_edge') >= 2) return { run, events, error: '劫尘不足、牌组已满或同名牌已达上限。' }
      run.runCurrency -= 25; const cardId = 'guiding_edge' as CardId; const instance = createBattleCardInstance(cardId, `${run.runId}:merchant:${run.cardInstances.length}`); run.cardInstances.push(instance); run.temporaryCardInstanceIds.push(instance.instanceId); events.push({ type: 'card_added', cardId, instanceId: instance.instanceId })
    } else if (command.optionId === 'heal' && run.runCurrency >= 20) { run.runCurrency -= 20; run.partyHp = [Math.min(PROTOTYPE_CONTENT.leader.maxHp, run.partyHp[0] + 48), ...run.partyHp.slice(1)] as [number, number, number] }
    else if (command.optionId === 'reveal' && run.runCurrency >= 30) { run.runCurrency -= 30; revealRandom(run, 3) }
    else return { run, events, error: '商人交易条件不足。' }
  } else if (run.pending.kind === 'chest') {
    if (command.optionId === 'charge') run.treasureCharge += 2
    else if (command.optionId === 'material') addReward(run, { id: `${run.runId}:chest`, kind: 'material', resource: 'spiritSand', amount: 10, secured: true }, events)
    else return { run, events, error: '无效的宝箱选项。' }
  } else if (run.pending.kind === 'camp') {
    if (command.optionId === 'heal') {
      const maxHp = run.partyMaxHp ?? [PROTOTYPE_CONTENT.leader.maxHp, PROTOTYPE_CONTENT.spirits.mountain_child.maxHp, PROTOTYPE_CONTENT.spirits.dream_tapir.maxHp]
      run.partyHp = run.partyHp.map((hp, index) => Math.min(maxHp[index] ?? hp, hp + Math.floor((maxHp[index] ?? hp) * 0.35))) as [number, number, number]
    }
    else if (command.optionId === 'action_points') run.actionPoints = Math.min(TRIAL_MAX_ACTION_POINTS, run.actionPoints + 4)
    else return { run, events, error: '无效的营地选项。' }
  }
  markResolved(run, tileId); run.pending = undefined
  return { run, events }
}

export function createTrial(seed: number, save: PlayerSave): TrialRun {
  const runId = `trial_${seed}_${save.campaign.battleSequence}`
  const content = battleContentFromSave(save)
  const cardInstances = save.loadout.cardIds.map((cardId, index) => createBattleCardInstance(cardId, `${runId}:start:${index}`))
  const partyHp: [number, number, number] = [content.leader.maxHp, content.spirits[save.loadout.spiritIds[0]].maxHp, content.spirits[save.loadout.spiritIds[1]].maxHp]
  const grid = generateGrid(seed)
  const start = grid.find((tile) => tile.kind === 'start')!
  const run: TrialRun = {
    runId, seed, buildId: save.loadout.buildId, buildTags: [content.weapons[save.loadout.weaponId].tag, content.techniques[save.loadout.techniqueId].tag, ...save.loadout.spiritIds.flatMap((id) => content.spirits[id].tags), ...save.loadout.cardIds.flatMap((id) => content.cards[id].tags)], status: 'active', grid, positionTileId: start.id, revealedTileIds: [], visitedTileIds: [start.id], actionPoints: TRIAL_INITIAL_ACTION_POINTS, trialSeals: 0,
    cardInstances, temporaryCardInstanceIds: [], temporaryUpgrades: [], runCurrency: 0, partyHp, partyMaxHp: [content.leader.maxHp, content.spirits[save.loadout.spiritIds[0]].maxHp, content.spirits[save.loadout.spiritIds[1]].maxHp], treasureId: save.loadout.treasureId, treasureCharge: 0, consumableUses: [2, 2], battleSequence: 0,
    seenEventIds: [], discoveredLoreIds: [], resourceBudget: { spiritSand: save.resources.spiritSand, artifactEssence: save.resources.artifactEssence }, resourceSpent: { spiritSand: 0, artifactEssence: 0 }, nextBattleAttackBonusPercent: 0, pendingRewards: [], securedRewards: [], battleTimeMs: 0,
  }
  run.revealedTileIds = revealAround(grid, start.id, [])
  return run
}

export function isTrialTileVisible(run: TrialRun, tileId: string) { return run.revealedTileIds.includes(tileId) }

export function createTrialBattle(run: TrialRun, save: PlayerSave): BattleState<BattleCardInstance> {
  if (!run.pending || run.pending.kind !== 'battle') throw new Error('当前没有待处理战斗。')
  const base = battleContentFromSave(save)
  const enemies = run.pending.encounterIds.map((id) => base.enemyDefinitions[id === HUAI_MATRIARCH_ID ? 'ancient_huai_matriarch' : id])
  const attackBonus = run.nextBattleAttackBonusPercent
  const content: BattleContent = { ...base, enemies: enemies.filter(Boolean).map((enemy) => ({ ...enemy, attack: Math.floor(enemy.attack * (100 + attackBonus) / 100) })) as EnemyDefinition[] }
  const battle = createBattle(run.seed + run.battleSequence * 997 + hash(run.pending.tileId), content, {
    buildId: save.loadout.buildId, cardInstances: run.cardInstances, treasureId: run.treasureId, treasureCharge: run.treasureCharge, treasureMaxCharge: 3,
    consumableIds: save.loadout.consumableIds, consumableUses: Object.fromEntries(save.loadout.consumableIds.map((id, index) => [id, run.consumableUses[index]])),
  })
  battle.leader.hp = Math.min(battle.leader.maxHp, run.partyHp[0]); battle.spirits[0].hp = Math.min(battle.spirits[0].maxHp, run.partyHp[1]); battle.spirits[1].hp = Math.min(battle.spirits[1].maxHp, run.partyHp[2]); battle.autoplay = true
  return battle
}

export function resolveTrialBattle(run: TrialRun, battle: BattleState<BattleCardInstance>, _battleEvents: readonly BattleEvent[]): TrialTransition {
  const next = structuredClone(run) as TrialRun
  if (!next.pending || next.pending.kind !== 'battle') return { run: next, events: [], error: '当前没有待处理战斗。' }
  next.partyHp = [battle.leader.hp, battle.spirits[0].hp, battle.spirits[1].hp]
  next.battleTimeMs += battle.timeMs
  next.battleSequence += 1
  next.nextBattleAttackBonusPercent = 0
  const pending = next.pending
  const won = battle.status === 'victory'
  const output: TrialEvent[] = [{ type: 'battle_resolved', result: won ? 'victory' : 'defeat', tileId: pending.tileId }]
  for (const encounterId of pending.encounterIds) if (!next.discoveredLoreIds.includes(encounterId)) { next.discoveredLoreIds.push(encounterId); output.push({ type: 'lore_discovered', loreId: encounterId }) }
  if (!won) { next.status = 'failure'; next.pending = undefined; output.push({ type: 'run_ended', result: 'failure' }); return { run: next, events: output } }
  next.treasureCharge = Math.min(3, battle.treasureCharge + (pending.elite ? 2 : 1))
  const consumableValues = Object.values(battle.consumableUses)
  if (consumableValues.length >= 2) next.consumableUses = [consumableValues[0], consumableValues[1]]
  const gainedSeals = (pending.elite ? 1 : 0) + (pending.bonusSeals ?? 0)
  if (gainedSeals) { next.trialSeals = Math.min(TRIAL_REQUIRED_SEALS, next.trialSeals + gainedSeals); output.push({ type: 'seal_gained', value: next.trialSeals }) }
  if (pending.boss) { next.status = 'success'; next.pending = undefined; markResolved(next, pending.tileId); output.push({ type: 'run_ended', result: 'success' }); return { run: next, events: output } }
  next.runCurrency += pending.elite ? 30 : 10
  next.pending = { kind: 'card_reward', tileId: pending.tileId, options: cardRewardOptions(next, pending.tileId) }
  return { run: next, events: output }
}

export function transitionTrial(current: TrialRun, command: TrialCommand, _content = PROTOTYPE_CONTENT): TrialTransition {
  const run = structuredClone(current) as TrialRun
  const events: TrialEvent[] = []
  if (run.status !== 'active' && command.type !== 'retreat') return { run, events, error: '本局已经结束。' }
  if (command.type === 'retreat') { run.status = 'retreat'; run.pending = undefined; events.push({ type: 'run_ended', result: 'retreat' }); return { run, events } }
  if (command.type === 'resolve_battle') return resolveTrialBattle(run, command.battle, command.events)
  if (command.type === 'choose') return choosePending(run, command, events)
  if (run.pending) return { run, events, error: '请先处理当前格子。' }
  const currentTile = run.grid.find((tile) => tile.id === run.positionTileId)
  const target = run.grid.find((tile) => tile.id === command.tileId)
  if (!currentTile || !target || !adjacent(currentTile, target)) return { run, events, error: '只能移动到相邻格子。' }
  if (!run.revealedTileIds.includes(target.id)) return { run, events, error: '迷雾尚未散开。' }
  if (run.actionPoints <= 0) { run.status = 'failure'; events.push({ type: 'run_ended', result: 'failure' }); return { run, events }
  }
  if (target.kind === 'boss' && run.trialSeals < TRIAL_REQUIRED_SEALS) return { run, events, error: '首领门需要两枚劫印。' }
  run.actionPoints -= 1; run.positionTileId = target.id; run.visitedTileIds = [...new Set([...run.visitedTileIds, target.id])]; run.revealedTileIds = revealAround(run.grid, target.id, run.revealedTileIds)
  events.push({ type: 'moved', tileId: target.id, actionPoints: run.actionPoints }, { type: 'action_points_changed', value: run.actionPoints })
  return activateTile(run, target, events)
}

export function trialPendingOptions(run: TrialRun): TrialCardRewardOption[] {
  if (!run.pending) return []
  if (run.pending.kind === 'card_reward') return run.pending.options
  if (run.pending.kind === 'training') return [{ id: 'upgrade', kind: 'upgrade_card', label: '临时锻造', description: '强化一张本局新增牌。' }, { id: 'remove', kind: 'currency', label: '删去杂念', description: '移除一张本局新增牌。' }]
  if (run.pending.kind === 'merchant') return [{ id: 'card', kind: 'add_card', label: '购入临时牌 · 25 劫尘', description: '获得一张引锋式。' }, { id: 'heal', kind: 'currency', label: '疗伤 · 20 劫尘', description: '恢复主将生元。' }, { id: 'reveal', kind: 'currency', label: '问路 · 30 劫尘', description: '揭示三格迷雾。' }]
  if (run.pending.kind === 'chest') return [{ id: 'charge', kind: 'currency', label: '灌注法宝', description: '法宝充能 +2。' }, { id: 'material', kind: 'currency', label: '收下材料', description: '获得可带回的基础材料。' }]
  if (run.pending.kind === 'camp') return [{ id: 'heal', kind: 'currency', label: '调息', description: '恢复队伍生元。' }, { id: 'action_points', kind: 'currency', label: '纳气', description: '恢复 4 点行炁。' }]
  return []
}

export function cardAvailabilityForTrial(battle: BattleState<BattleCardInstance>, cardId: CardId, instanceId?: string): CardAvailability {
  const card = PROTOTYPE_CONTENT.cards[cardId]
  const instance = battle.hand.find((ref) => typeof ref !== 'string' && ref.instanceId === instanceId) ?? battle.hand.find((ref) => getCardId(ref) === cardId)
  return getCardAvailability(battle, card, undefined, false, instance)
}

export function createTrialSettlement(run: TrialRun, result: TrialRun['status'] = run.status): TrialSettlement {
  const rewards = result === 'success'
    ? [...run.securedRewards, { id: `${run.runId}:breakthrough`, kind: 'material' as const, resource: 'cultivation' as const, amount: 600, secured: true }, { id: `${run.runId}:sand`, kind: 'material' as const, resource: 'spiritSand' as const, amount: 2_000, secured: true }]
    : run.securedRewards
  const unique = [...new Map(rewards.map((reward) => [reward.id, reward])).values()]
  return { sourceId: `${run.runId}:${result}`, seed: run.seed, result, rewards: unique, discoveredLoreIds: [...run.discoveredLoreIds], resourceSpent: { ...run.resourceSpent }, report: { battles: run.battleSequence, durationMs: run.battleTimeMs } }
}
