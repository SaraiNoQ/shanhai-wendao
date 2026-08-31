import { uniformInt } from 'pure-rand/distribution/uniformInt'
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus'
import { COLLECTION } from '../content/collection'
import { getStage, getStageWaveEnemies, type StageDefinition } from '../content/stages'
import { createBattle, startNextWave, transitionBattle } from './battle'
import type { BattleContent, BattleEvent, BattleState, ComboId, UnitId } from './types'
import { battleContentFromSave, receiveCollectible, type PlayerSave } from '../state/player'

const STEP_MS = 250
const WAVE_TIMEOUT_MS = 180_000
const OFFLINE_CAP_MS = 86_400_000

export interface BattleReport {
  result: 'victory' | 'defeat'
  durationMs: number
  damageBySource: Record<string, number>
  healingBySource: Record<string, number>
  shieldBySource: Record<string, number>
  actionsByUnit: Record<string, number>
  comboCounts: Partial<Record<ComboId, number>>
  failureReason?: string
}

export interface CampaignFailure {
  stageNumber: number
  fallbackStage: number
  reason: string
  battleSequence: number
}

export interface CampaignProgress {
  highestClearedStage: number
  stableStage: number
  mode: 'advance' | 'farm' | 'paused'
  campaignSeed: number
  battleSequence: number
  duplicateDropStreak: number
  trialUnlocked: boolean
  lastActiveAtMs: number
  settledRewardSourceIds: string[]
  lastFailure?: CampaignFailure
  latestReport?: BattleReport
  pendingOfflineSettlement?: PendingOfflineSettlement
}

export interface StageSession {
  stageNumber: number
  waveIndex: number
  waveStartedAtMs: number
  status: 'active' | 'victory' | 'defeat'
  battle: BattleState
  events: BattleEvent[]
}

export interface PendingOfflineSettlement {
  reportId: string
  durationMs: number
  battles: number
  clearedStages: number[]
  failedStage?: number
  firstFailureReason?: string
  resourceDelta: { cultivation: number; spiritSand: number; daoEssence: number; spiritEssence: number; artifactEssence: number }
  newOwnedIds: string[]
  result: Pick<CampaignProgress, 'highestClearedStage' | 'stableStage' | 'mode' | 'battleSequence' | 'duplicateDropStreak' | 'trialUnlocked' | 'lastFailure'>
  rewardSourceIds: string[]
  contribution: BattleReport
}

function add(map: Record<string, number>, id: string, value: number) { map[id] = (map[id] ?? 0) + value }

export function summarizeBattle(events: readonly BattleEvent[], battle: BattleState): BattleReport {
  const report: BattleReport = { result: battle.status === 'victory' ? 'victory' : 'defeat', durationMs: battle.timeMs, damageBySource: {}, healingBySource: {}, shieldBySource: {}, actionsByUnit: {}, comboCounts: {} }
  for (const event of events) {
    if (event.type === 'damage') add(report.damageBySource, event.sourceId, event.amount + event.shieldAbsorbed)
    else if (event.type === 'heal') add(report.healingBySource, event.sourceId, event.amount)
    else if (event.type === 'shield') add(report.shieldBySource, event.sourceId, event.amount)
    else if (event.type === 'unit_action') add(report.actionsByUnit, event.unitId, 1)
    else if (event.type === 'combo_triggered') report.comboCounts[event.comboId] = (report.comboCounts[event.comboId] ?? 0) + 1
    else if (event.type === 'battle_timeout') report.failureReason = '输出不足，单波超过 180 秒。'
  }
  if (battle.status === 'defeat' && !report.failureReason) {
    const lastDamage = [...events].reverse().find((event) => event.type === 'damage' && event.targetId === 'leader') as Extract<BattleEvent, { type: 'damage' }> | undefined
    report.failureReason = lastDamage ? `主将被「${lastDamage.sourceId}」击败。` : '主将生元耗尽。'
  }
  return report
}

function mergeReports(total: BattleReport | undefined, next: BattleReport): BattleReport {
  if (!total) return structuredClone(next)
  const mergeMap = (target: Record<string, number>, source: Record<string, number>) => { for (const [id, value] of Object.entries(source)) add(target, id, value) }
  mergeMap(total.damageBySource, next.damageBySource)
  mergeMap(total.healingBySource, next.healingBySource)
  mergeMap(total.shieldBySource, next.shieldBySource)
  mergeMap(total.actionsByUnit, next.actionsByUnit)
  mergeMap(total.comboCounts as Record<string, number>, next.comboCounts as Record<string, number>)
  total.durationMs += next.durationMs
  total.result = total.result === 'defeat' || next.result === 'defeat' ? 'defeat' : 'victory'
  total.failureReason ??= next.failureReason
  return total
}

function stageContent(save: PlayerSave, stage: StageDefinition, waveIndex: number): BattleContent {
  const content = battleContentFromSave(save)
  return { ...content, enemies: getStageWaveEnemies(stage, waveIndex) }
}

export function createStageSession(save: PlayerSave, stageNumber: number): StageSession {
  const stage = getStage(stageNumber)
  const seed = save.campaign.campaignSeed + save.campaign.battleSequence * 97 + stageNumber * 1_009
  const content = stageContent(save, stage, 0)
  const battle = transitionBattle(createBattle(seed, content, save.loadout.buildId), { type: 'set_autoplay', enabled: true }, content).state
  return { stageNumber, waveIndex: 0, waveStartedAtMs: 0, status: 'active', battle, events: [{ type: 'battle_started', seed, buildId: battle.buildId, atMs: 0 }, { type: 'wave_started', waveNumber: 1, atMs: 0 }] }
}

export function advanceStageSession(current: StageSession, elapsedMs: number, save: PlayerSave): StageSession {
  if (current.status !== 'active') return current
  const stage = getStage(current.stageNumber)
  const content = stageContent(save, stage, current.waveIndex)
  const result = transitionBattle(current.battle, { type: 'advance', elapsedMs }, content)
  let next: StageSession = { ...current, battle: result.state, events: [...current.events, ...result.events] }
  if (next.battle.status === 'active' && next.battle.timeMs - next.waveStartedAtMs >= WAVE_TIMEOUT_MS) {
    next = { ...next, status: 'defeat', battle: { ...next.battle, status: 'defeat' }, events: [...next.events, { type: 'battle_timeout', atMs: next.battle.timeMs }, { type: 'battle_ended', result: 'defeat', atMs: next.battle.timeMs }] }
  } else if (next.battle.status === 'defeat') next.status = 'defeat'
  else if (next.battle.status === 'victory') {
    const nextWaveIndex = next.waveIndex + 1
    if (nextWaveIndex >= stage.waves.length) next.status = 'victory'
    else {
      const wave = startNextWave(next.battle, getStageWaveEnemies(stage, nextWaveIndex), nextWaveIndex + 1)
      next = { ...next, waveIndex: nextWaveIndex, waveStartedAtMs: wave.state.timeMs, battle: { ...wave.state, autoplay: true }, events: [...next.events, ...wave.events] }
    }
  }
  return next
}

function randomDrop(save: PlayerSave, stageNumber: number) {
  const rng = xoroshiro128plus(save.campaign.campaignSeed + save.campaign.battleSequence * 31 + stageNumber)
  if (uniformInt(rng, 0, 99) >= 20) return { save, dropId: undefined }
  const unowned = COLLECTION.filter((item) => !save.ownedIds.includes(item.id))
  const pool = save.campaign.duplicateDropStreak >= 5 && unowned.length ? unowned : COLLECTION
  const item = pool[uniformInt(rng, 0, pool.length - 1)]
  const duplicate = save.ownedIds.includes(item.id)
  const next = receiveCollectible(save, item.id)
  return { save: { ...next, campaign: { ...next.campaign, duplicateDropStreak: duplicate ? save.campaign.duplicateDropStreak + 1 : 0 } }, dropId: item.id }
}

export function settleStage(save: PlayerSave, session: StageSession): PlayerSave {
  const stage = getStage(session.stageNumber)
  const report = summarizeBattle(session.events, session.battle)
  if (session.status === 'defeat') {
    const fallback = save.campaign.mode === 'farm' ? Math.max(0, save.campaign.stableStage - 1) : save.campaign.stableStage
    const battleSequence = save.campaign.battleSequence + 1
    return {
      ...save,
      campaign: {
        ...save.campaign,
        stableStage: fallback,
        mode: fallback > 0 ? 'farm' : 'paused',
        battleSequence,
        lastFailure: { stageNumber: session.stageNumber, fallbackStage: fallback, reason: report.failureReason ?? '战斗失败。', battleSequence },
        latestReport: report,
      },
    }
  }
  const firstClear = session.stageNumber > save.campaign.highestClearedStage
  const sourceId = firstClear ? `${stage.id}_first` : `${stage.id}_farm_${save.campaign.battleSequence}`
  if (save.campaign.settledRewardSourceIds.includes(sourceId)) return save
  const reward = firstClear ? stage.firstClearReward : stage.repeatReward
  let next: PlayerSave = { ...save, resources: { ...save.resources, cultivation: save.resources.cultivation + reward.cultivation, spiritSand: save.resources.spiritSand + reward.spiritSand } }
  if (firstClear) for (const id of stage.unlockIds) next = receiveCollectible(next, id)
  else next = randomDrop(next, stage.stageNumber).save
  const highest = Math.max(next.campaign.highestClearedStage, firstClear ? stage.stageNumber : 0)
  let campaign: CampaignProgress = {
    ...next.campaign,
    highestClearedStage: highest,
    stableStage: Math.max(next.campaign.stableStage, highest),
    mode: stage.isRealmGate ? 'paused' : next.campaign.mode,
    trialUnlocked: next.campaign.trialUnlocked || stage.isRealmGate,
    battleSequence: next.campaign.battleSequence + 1,
    settledRewardSourceIds: [...next.campaign.settledRewardSourceIds, sourceId],
    latestReport: report,
  }
  if (campaign.lastFailure && session.stageNumber >= campaign.lastFailure.stageNumber) {
    const { lastFailure: _lastFailure, ...withoutLastFailure } = campaign
    campaign = withoutLastFailure
  }
  next = { ...next, campaign }
  return next
}

export function nextCampaignStage(save: PlayerSave) {
  if (save.campaign.mode === 'advance') return Math.min(30, save.campaign.highestClearedStage + 1)
  return Math.max(1, save.campaign.stableStage)
}

export function simulateCampaign(save: PlayerSave, elapsedMs: number, nowMs: number): PendingOfflineSettlement | undefined {
  if (save.campaign.mode === 'paused' || save.campaign.pendingOfflineSettlement) return undefined
  const durationMs = clampOfflineDuration(elapsedMs)
  if (durationMs < STEP_MS) return undefined
  let working = structuredClone(save)
  let session: StageSession | undefined
  let consumedMs = 0
  let battles = 0
  const clearedStages: number[] = []
  let failedStage: number | undefined
  let firstFailureReason: string | undefined
  let contribution: BattleReport | undefined
  while (consumedMs + STEP_MS <= durationMs && working.campaign.mode !== 'paused') {
    session ??= createStageSession(working, nextCampaignStage(working))
    session = advanceStageSession(session, STEP_MS, working)
    consumedMs += STEP_MS
    if (session.status !== 'active') {
      battles += 1
      const report = summarizeBattle(session.events, session.battle)
      contribution = mergeReports(contribution, report)
      if (session.status === 'victory' && session.stageNumber > working.campaign.highestClearedStage) clearedStages.push(session.stageNumber)
      if (session.status === 'defeat' && failedStage === undefined) { failedStage = session.stageNumber; firstFailureReason = report.failureReason }
      working = settleStage(working, session)
      if (session.status === 'defeat' && working.campaign.mode !== 'paused') working = { ...working, campaign: { ...working.campaign, mode: 'farm' } }
      session = undefined
    }
  }
  if (!battles || !contribution) return undefined
  const resourceDelta = {
    cultivation: working.resources.cultivation - save.resources.cultivation,
    spiritSand: working.resources.spiritSand - save.resources.spiritSand,
    daoEssence: working.resources.daoEssence - save.resources.daoEssence,
    spiritEssence: working.resources.spiritEssence - save.resources.spiritEssence,
    artifactEssence: working.resources.artifactEssence - save.resources.artifactEssence,
  }
  return {
    reportId: `offline_${save.campaign.lastActiveAtMs}_${nowMs}_${save.campaign.battleSequence}`,
    durationMs: consumedMs, battles, clearedStages, failedStage, firstFailureReason, resourceDelta,
    newOwnedIds: working.ownedIds.filter((id) => !save.ownedIds.includes(id)),
    result: { highestClearedStage: working.campaign.highestClearedStage, stableStage: working.campaign.stableStage, mode: working.campaign.mode, battleSequence: working.campaign.battleSequence, duplicateDropStreak: working.campaign.duplicateDropStreak, trialUnlocked: working.campaign.trialUnlocked, lastFailure: working.campaign.lastFailure },
    rewardSourceIds: working.campaign.settledRewardSourceIds.filter((id) => !save.campaign.settledRewardSourceIds.includes(id)), contribution,
  }
}

export function setCampaignMode(save: PlayerSave, mode: CampaignProgress['mode']): PlayerSave { return { ...save, campaign: { ...save.campaign, mode } } }
export const OFFLINE_LIMIT_MS = OFFLINE_CAP_MS
export const LOGIC_STEP_MS = STEP_MS
export function clampOfflineDuration(elapsedMs: number) { return Math.max(0, Math.min(OFFLINE_CAP_MS, elapsedMs)) }
export type ReportSourceId = UnitId | string
