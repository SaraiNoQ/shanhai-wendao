import { describe, expect, it } from 'vitest'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import { STAGES, getStageWaveEnemies } from '../content/stages'
import { attachOfflineSettlement, claimOfflineSettlement, createPlayerSave } from '../state/player'
import {
  OFFLINE_LIMIT_MS,
  LOGIC_STEP_MS,
  advanceStageSession,
  clampOfflineDuration,
  createStageSession,
  nextCampaignStage,
  settleStage,
  setCampaignMode,
  simulateCampaign,
  summarizeBattle,
  type StageSession,
} from './campaign'
import type { BattleEvent } from './types'

function runStage(stageNumber: number, maxSteps = 2_000) {
  const save = createPlayerSave(0)
  let session = createStageSession(save, stageNumber)
  for (let step = 0; step < maxSteps && session.status === 'active'; step += 1) {
    session = advanceStageSession(session, LOGIC_STEP_MS, save)
  }
  return session
}

function withStatus(session: StageSession, status: 'victory' | 'defeat'): StageSession {
  return { ...session, status, battle: { ...session.battle, status } }
}

describe('M4 campaign content and sessions', () => {
  it('defines 30 valid stages with the intended one-to-three wave shape', () => {
    expect(STAGES).toHaveLength(30)
    expect(STAGES.map((stage) => stage.id)).toEqual(Array.from({ length: 30 }, (_, index) => `stage_${String(index + 1).padStart(3, '0')}`))
    expect(STAGES[0].waves).toHaveLength(1)
    expect(STAGES[3].waves).toHaveLength(2)
    expect(STAGES[20].waves).toHaveLength(3)
    expect(STAGES[29].isRealmGate).toBe(true)
    expect(STAGES[3].waves[1]).toHaveLength(1)
    expect(STAGES[5].waves[1]).toHaveLength(1)
    for (const stage of STAGES) {
      expect(stage.waves.length).toBeGreaterThanOrEqual(1)
      expect(stage.waves.length).toBeLessThanOrEqual(3)
      for (const wave of stage.waves) for (const enemyId of wave) expect(PROTOTYPE_CONTENT.enemyDefinitions[enemyId]).toBeDefined()
    }
  })

  it('scales stage enemies with the documented integer formulas', () => {
    const stage = STAGES[29]
    const enemies = getStageWaveEnemies(stage, 2)
    const base = PROTOTYPE_CONTENT.enemyDefinitions.paper_armor_envoy
    expect(enemies[0]).toMatchObject({
      id: 'paper_armor_envoy',
      maxHp: Math.floor(base.maxHp * 332 / 100),
      attack: Math.floor(base.attack * 245 / 100),
      defense: base.defense + 2 * Math.floor(29 / 3),
    })
  })

  it('runs a multi-wave stage to victory and records each wave', () => {
    const session = runStage(4)
    expect(session.status).toBe('victory')
    expect(session.waveIndex).toBe(1)
    expect(session.events.filter((event) => event.type === 'wave_started')).toHaveLength(2)
    expect(session.events).toContainEqual(expect.objectContaining({ type: 'battle_ended', result: 'victory' }))
  })

  it('replays the same stage session and report deterministically', () => {
    const first = runStage(4)
    const second = runStage(4)
    expect(second).toEqual(first)
    expect(summarizeBattle(second.events, second.battle)).toEqual(summarizeBattle(first.events, first.battle))
  })

  it('falls back from advance failure to the stable farming stage', () => {
    const base = createPlayerSave(0)
    const save = {
      ...base,
      campaign: { ...base.campaign, highestClearedStage: 4, stableStage: 4, mode: 'advance' as const, battleSequence: 7 },
    }
    const afterAdvanceFailure = settleStage(save, withStatus(createStageSession(save, 5), 'defeat'))
    expect(afterAdvanceFailure.campaign.stableStage).toBe(4)
    expect(afterAdvanceFailure.campaign.mode).toBe('farm')
    expect(afterAdvanceFailure.campaign.lastFailure).toEqual({ stageNumber: 5, fallbackStage: 4, reason: '主将生元耗尽。', battleSequence: 8 })
    expect(nextCampaignStage(afterAdvanceFailure)).toBe(4)

    const afterFarmFailure = settleStage(afterAdvanceFailure, withStatus(createStageSession(afterAdvanceFailure, 4), 'defeat'))
    expect(afterFarmFailure.campaign.stableStage).toBe(3)
    expect(afterFarmFailure.campaign.mode).toBe('farm')
    expect(afterFarmFailure.campaign.lastFailure).toEqual({ stageNumber: 4, fallbackStage: 3, reason: '主将生元耗尽。', battleSequence: 9 })
  })

  it('keeps the failure reminder while farming a stable stage', () => {
    const base = createPlayerSave(0)
    const save = {
      ...base,
      campaign: {
        ...base.campaign,
        highestClearedStage: 4,
        stableStage: 4,
        mode: 'farm' as const,
        lastFailure: { stageNumber: 5, fallbackStage: 4, reason: '输出不足，单波超过 180 秒。', battleSequence: 3 },
      },
    }
    const settled = settleStage(save, withStatus(createStageSession(save, 4), 'victory'))
    expect(settled.campaign.lastFailure).toEqual(save.campaign.lastFailure)
    expect(settled.campaign.mode).toBe('paused')
  })

  it('returns to the blocked next stage after an explicit advance action', () => {
    const base = createPlayerSave(0)
    const save = { ...base, campaign: { ...base.campaign, highestClearedStage: 16, stableStage: 16, mode: 'farm' as const } }
    expect(nextCampaignStage(setCampaignMode(save, 'advance'))).toBe(17)
  })

  it('clears the failure reminder after successfully passing the blocked stage', () => {
    const base = createPlayerSave(0)
    const save = {
      ...base,
      campaign: {
        ...base.campaign,
        highestClearedStage: 4,
        stableStage: 4,
        mode: 'advance' as const,
        lastFailure: { stageNumber: 5, fallbackStage: 4, reason: '主将生元耗尽。', battleSequence: 3 },
      },
    }
    const settled = settleStage(save, withStatus(createStageSession(save, 5), 'victory'))
    expect(settled.campaign.lastFailure).toBeUndefined()
  })

  it('pauses after the first-stage failure while retaining its fallback', () => {
    const save = createPlayerSave(0)
    const settled = settleStage(save, withStatus(createStageSession(save, 1), 'defeat'))
    expect(settled.campaign.stableStage).toBe(0)
    expect(settled.campaign.mode).toBe('paused')
    expect(settled.campaign.lastFailure).toEqual({ stageNumber: 1, fallbackStage: 0, reason: '主将生元耗尽。', battleSequence: 1 })
  })

  it('stops at stage 30 while unlocking, but not completing, the trial', () => {
    const save = createPlayerSave(0)
    const settled = settleStage(save, withStatus(createStageSession(save, 30), 'victory'))
    expect(settled.campaign.highestClearedStage).toBe(30)
    expect(settled.campaign.stableStage).toBe(30)
    expect(settled.campaign.trialUnlocked).toBe(true)
    expect(settled.campaign.mode).toBe('paused')
    expect(simulateCampaign(settled, LOGIC_STEP_MS * 4, 10_000)).toBeUndefined()
  })

  it('prioritizes an unowned collectible after five duplicate drops', () => {
    const base = createPlayerSave(0)
    let save: ReturnType<typeof createPlayerSave> = { ...base, campaign: { ...base.campaign, highestClearedStage: 1, stableStage: 1, mode: 'farm', duplicateDropStreak: 5 } }
    const ownedBefore = new Set(save.ownedIds)
    for (let attempt = 0; attempt < 100 && save.ownedIds.length === ownedBefore.size; attempt += 1) {
      save = settleStage(save, withStatus(createStageSession(save, 1), 'victory'))
    }
    expect(save.ownedIds.length).toBeGreaterThan(ownedBefore.size)
    expect(save.campaign.duplicateDropStreak).toBe(0)
  })
})

describe('M4 reports and offline settlement', () => {
  it('attributes damage, healing, shields, actions and combos without loss', () => {
    const battle = createStageSession(createPlayerSave(0), 1).battle
    const events: BattleEvent[] = [
      { type: 'damage', sourceId: 'leader', targetId: 'shadow_civet', amount: 12, shieldAbsorbed: 3, atMs: 250 },
      { type: 'heal', sourceId: 'life_talisman', targetId: 'leader', amount: 8, atMs: 500 },
      { type: 'shield', sourceId: 'hidden_edge', targetId: 'leader', amount: 22, atMs: 750 },
      { type: 'unit_action', unitId: 'leader', action: '青岚剑', atMs: 1_000 },
      { type: 'combo_triggered', comboId: 'flying_sword_seal', atMs: 1_250 },
    ]
    const report = summarizeBattle(events, { ...battle, status: 'victory' })
    expect(report.damageBySource).toEqual({ leader: 15 })
    expect(report.healingBySource).toEqual({ life_talisman: 8 })
    expect(report.shieldBySource).toEqual({ hidden_edge: 22 })
    expect(report.actionsByUnit).toEqual({ leader: 1 })
    expect(report.comboCounts).toEqual({ flying_sword_seal: 1 })
  })

  it('uses display names in defeat feedback', () => {
    const battle = createStageSession(createPlayerSave(0), 1).battle
    const report = summarizeBattle([{ type: 'damage', sourceId: 'headless_woodcutter', targetId: 'leader', amount: 190, shieldAbsorbed: 0, atMs: 250 }], { ...battle, status: 'defeat' })
    expect(report.failureReason).toBe('主将被「无首樵夫」击败。')
  })

  it('keeps an aggregate report marked as defeat when a later farm battle wins', () => {
    const base = createPlayerSave(0)
    const save = { ...base, campaign: { ...base.campaign, highestClearedStage: 16, stableStage: 16, mode: 'advance' as const } }
    const pending = simulateCampaign(save, 60_000, 60_000)
    expect(pending?.failedStage).toBe(17)
    expect(pending?.contribution.result).toBe('defeat')
  })

  it('caps offline input at 24 hours and keeps short simulations deterministic', () => {
    expect(clampOfflineDuration(OFFLINE_LIMIT_MS + LOGIC_STEP_MS)).toBe(OFFLINE_LIMIT_MS)
    expect(clampOfflineDuration(-1)).toBe(0)
    const first = simulateCampaign(createPlayerSave(0), 20_000, 100_000)
    const second = simulateCampaign(createPlayerSave(0), 20_000, 100_000)
    expect(first).toBeDefined()
    expect(second).toEqual(first)
  })

  it('claims one offline report once, even when the result is submitted twice', () => {
    const save = createPlayerSave(0)
    const settlement = simulateCampaign(save, 20_000, 20_000)
    expect(settlement).toBeDefined()
    if (!settlement) return
    const attached = attachOfflineSettlement(save, settlement, 20_000)
    const claimed = claimOfflineSettlement(attached, 20_001)
    const claimedAgain = claimOfflineSettlement(claimed, 20_002)
    expect(claimed.campaign.pendingOfflineSettlement).toBeUndefined()
    expect(claimedAgain).toEqual(claimed)
    expect(claimed.resources).toEqual({
      cultivation: save.resources.cultivation + settlement.resourceDelta.cultivation,
      spiritSand: save.resources.spiritSand + settlement.resourceDelta.spiritSand,
      daoEssence: save.resources.daoEssence + settlement.resourceDelta.daoEssence,
      spiritEssence: save.resources.spiritEssence + settlement.resourceDelta.spiritEssence,
      artifactEssence: save.resources.artifactEssence + settlement.resourceDelta.artifactEssence,
    })
  })

  it('carries the failure reminder through an offline settlement claim', () => {
    const save = createPlayerSave(0)
    const pending = simulateCampaign(save, 20_000, 20_000)
    expect(pending).toBeDefined()
    if (!pending) return
    const reminder = { stageNumber: 5, fallbackStage: 4, reason: '主将生元耗尽。', battleSequence: 6 }
    pending.result.lastFailure = reminder
    const claimed = claimOfflineSettlement(attachOfflineSettlement(save, pending, 1_000), 1_001)
    expect(claimed.campaign.lastFailure).toEqual(reminder)
  })
})
